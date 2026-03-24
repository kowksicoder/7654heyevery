import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const X_API_BASE_URLS = ["https://api.x.com/2", "https://api.twitter.com/2"];

const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const jsonResponse = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
    });

    request.on("end", () => {
      if (!rawBody.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });

const normalizeHandle = (value) =>
  (value || "").trim().toLowerCase().replace(/^@+/, "").replace(/\s+/g, "");

const extractTweetId = (value) => {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{6,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/status(?:es)?\/(\d+)/i);

    return match?.[1] || null;
  } catch {
    const match = trimmed.match(/status(?:es)?\/(\d+)/i);
    return match?.[1] || null;
  }
};

const fetchXPostById = async (tweetId, bearerToken) => {
  const errors = [];
  const searchParams = new URLSearchParams({
    expansions: "author_id",
    "tweet.fields": "author_id,created_at,text",
    "user.fields": "id,name,profile_image_url,username"
  });

  for (const baseUrl of X_API_BASE_URLS) {
    try {
      const response = await fetch(
        `${baseUrl}/tweets/${tweetId}?${searchParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "content-type": "application/json"
          },
          method: "GET"
        }
      );

      if (!response.ok) {
        throw new Error(
          `X API request failed with status ${response.status} at ${baseUrl}`
        );
      }

      const payload = await response.json();
      const tweet = payload?.data || null;
      const author =
        payload?.includes?.users?.find(
          (user) => user.id === tweet?.author_id
        ) || null;

      if (!tweet) {
        throw new Error("X API did not return a tweet for that post.");
      }

      return {
        author: author
          ? {
              id: author.id || null,
              name: author.name || null,
              profileImageUrl: author.profile_image_url || null,
              username: author.username || null
            }
          : null,
        id: tweet.id || tweetId,
        text: tweet.text || null
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Unknown X API error."
      );
    }
  }

  throw new Error(errors[0] || "Failed to verify the X proof post.");
};

export const createVerificationRuntime = ({ rootDir }) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const xBearerToken =
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN ||
    process.env.X_BEARER_TOKEN ||
    null;

  const runtimeEnabled = Boolean(supabaseUrl && serviceRoleKey);
  const xVerificationEnabled = Boolean(runtimeEnabled && xBearerToken);
  const supabase = runtimeEnabled
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;

  const handleApiRequest = async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (!requestUrl.pathname.startsWith("/api/verification/")) {
      return false;
    }

    if (requestUrl.pathname === "/api/verification/config") {
      jsonResponse(response, 200, {
        enabled: runtimeEnabled,
        xVerificationEnabled
      });
      return true;
    }

    if (!runtimeEnabled || !supabase) {
      jsonResponse(response, 503, {
        error: "Verification runtime is not enabled on this server."
      });
      return true;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/verification/x/verify"
    ) {
      try {
        if (!xVerificationEnabled || !xBearerToken) {
          jsonResponse(response, 503, {
            error: "X verification is not configured on this server."
          });
          return true;
        }

        const body = await readJsonBody(request);
        const profileId = body?.profileId?.trim();
        const requestId = body?.requestId?.trim();
        const postUrl = body?.postUrl?.trim();
        const linkedHandle = normalizeHandle(body?.linkedHandle || "");
        const linkedSubject = body?.linkedSubject?.trim() || null;
        const linkedDisplayName = body?.linkedDisplayName?.trim() || null;
        const linkedProfileImageUrl =
          body?.linkedProfileImageUrl?.trim() || null;

        if (!profileId || !requestId || !postUrl) {
          jsonResponse(response, 400, {
            error: "Missing profileId, requestId, or postUrl."
          });
          return true;
        }

        const tweetId = extractTweetId(postUrl);

        if (!tweetId) {
          jsonResponse(response, 400, {
            error: "Enter a valid X post URL."
          });
          return true;
        }

        const { data: requestRecord, error: requestError } = await supabase
          .from("profile_verification_requests")
          .select(
            "id, profile_id, provider, claimed_handle, verification_code, status"
          )
          .eq("id", requestId)
          .maybeSingle();

        if (requestError) {
          throw requestError;
        }

        if (!requestRecord || requestRecord.profile_id !== profileId) {
          jsonResponse(response, 404, {
            error: "Verification request not found."
          });
          return true;
        }

        if (requestRecord.provider !== "x") {
          jsonResponse(response, 400, {
            error: "Only X requests can use proof-post verification right now."
          });
          return true;
        }

        if (requestRecord.status === "verified") {
          jsonResponse(response, 200, {
            alreadyVerified: true,
            status: "verified",
            verified: true
          });
          return true;
        }

        const claimedHandle = normalizeHandle(requestRecord.claimed_handle);

        if (!linkedHandle) {
          jsonResponse(response, 400, {
            error: "Link your X account first before verifying."
          });
          return true;
        }

        if (linkedHandle !== claimedHandle) {
          await supabase.rpc("complete_profile_verification_proof", {
            input_avatar_url: linkedProfileImageUrl,
            input_display_name: linkedDisplayName,
            input_error:
              "The linked X account does not match the handle on this verification request.",
            input_profile_url: `https://x.com/${linkedHandle}`,
            input_proof_handle: linkedHandle,
            input_proof_post_id: tweetId,
            input_proof_post_url: postUrl,
            input_provider_user_id: linkedSubject,
            input_request_id: requestId,
            input_verified: false
          });

          jsonResponse(response, 400, {
            error:
              "The linked X account does not match the handle on this verification request."
          });
          return true;
        }

        const tweet = await fetchXPostById(tweetId, xBearerToken);
        const authorHandle = normalizeHandle(tweet.author?.username || "");
        const authorId = tweet.author?.id || null;
        const verificationCode = (requestRecord.verification_code || "").trim();
        const tweetText = (tweet.text || "").trim();

        let failureReason = null;

        if (!authorHandle || authorHandle !== claimedHandle) {
          failureReason =
            "That X post was not authored by the linked handle on this request.";
        } else if (linkedSubject && authorId && linkedSubject !== authorId) {
          failureReason =
            "The X post author does not match the linked X account.";
        } else if (
          !tweetText.toUpperCase().includes(verificationCode.toUpperCase())
        ) {
          failureReason =
            "The X post does not contain the current EV1 verification code.";
        }

        const rpcArgs = {
          input_avatar_url:
            tweet.author?.profileImageUrl || linkedProfileImageUrl,
          input_display_name:
            tweet.author?.name ||
            linkedDisplayName ||
            requestRecord.claimed_handle,
          input_error: failureReason,
          input_profile_url: authorHandle
            ? `https://x.com/${authorHandle}`
            : null,
          input_proof_handle: authorHandle || linkedHandle || claimedHandle,
          input_proof_post_id: tweet.id,
          input_proof_post_text: tweetText,
          input_proof_post_url: postUrl,
          input_provider_user_id: authorId || linkedSubject,
          input_request_id: requestId,
          input_verified: !failureReason
        };

        const { data: proofResult, error: proofError } = await supabase.rpc(
          "complete_profile_verification_proof",
          rpcArgs
        );

        if (proofError) {
          throw proofError;
        }

        if (failureReason) {
          jsonResponse(response, 400, {
            error: failureReason,
            proof: proofResult || null,
            verified: false
          });
          return true;
        }

        jsonResponse(response, 200, {
          proof: proofResult || null,
          verified: true
        });
      } catch (error) {
        jsonResponse(response, 500, {
          error:
            error instanceof Error
              ? error.message
              : "X verification failed unexpectedly."
        });
      }

      return true;
    }

    jsonResponse(response, 404, { error: "Verification route not found." });
    return true;
  };

  return {
    handleApiRequest,
    start() {}
  };
};
