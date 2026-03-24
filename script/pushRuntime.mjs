import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

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

const normalizeOrigin = () => {
  const configuredOrigin =
    process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return "http://localhost:4783";
};

const toAbsoluteUrl = (origin, value) => {
  if (!value) {
    return `${origin}/`;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
};

const normalizeTargetUrl = (origin, targetKey, data = {}) => {
  const rawTarget =
    (typeof targetKey === "string" && targetKey.trim()) ||
    (typeof data.targetKey === "string" && data.targetKey.trim()) ||
    (typeof data.url === "string" && data.url.trim()) ||
    "/";

  if (/^https?:\/\//i.test(rawTarget)) {
    return rawTarget;
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(rawTarget)) {
    return `${origin}/coins/${rawTarget.toLowerCase()}`;
  }

  return toAbsoluteUrl(origin, rawTarget);
};

const createPushPayload = (origin, delivery) => {
  const notification = delivery.notifications || {};
  const data = notification.data || {};
  const title = notification.title || "Every1";
  const body = notification.body || "Open Every1 to see what you missed.";
  const url = normalizeTargetUrl(origin, notification.target_key, data);
  const icon = toAbsoluteUrl(
    origin,
    data.bannerUrl ||
      data.actorAvatarUrl ||
      data.image ||
      data.avatarUrl ||
      "/evlogo.jpg"
  );

  return JSON.stringify({
    badge: toAbsoluteUrl(origin, "/favicon.ico"),
    body,
    icon,
    tag: delivery.notification_id || notification.id || "every1-push",
    title,
    url
  });
};

export const createPushRuntime = ({ rootDir }) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const origin = normalizeOrigin();
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const configuredPublicKey =
    process.env.WEB_PUSH_PUBLIC_KEY || process.env.VITE_WEB_PUSH_PUBLIC_KEY;
  const configuredPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const vapidKeys =
    configuredPublicKey && configuredPrivateKey
      ? {
          privateKey: configuredPrivateKey,
          publicKey: configuredPublicKey
        }
      : webPush.generateVAPIDKeys();
  const pushEnabled = Boolean(supabaseUrl && serviceRoleKey);
  const vapidSubject =
    process.env.WEB_PUSH_SUBJECT || "mailto:support@every1.app";
  const supabase = pushEnabled
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;
  let deliveryInterval = null;
  let isDispatching = false;

  if (pushEnabled) {
    webPush.setVapidDetails(
      vapidSubject,
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }

  const dispatchPendingPushes = async () => {
    if (!pushEnabled || !supabase || isDispatching) {
      return;
    }

    isDispatching = true;

    try {
      const { data, error } = await supabase
        .from("notification_push_deliveries")
        .select(
          `
            id,
            notification_id,
            subscription_id,
            notifications!inner (
              id,
              title,
              body,
              target_key,
              data
            ),
            push_subscriptions!inner (
              id,
              endpoint,
              p256dh,
              auth,
              is_active
            )
          `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(25);

      if (error) {
        throw error;
      }

      for (const delivery of data || []) {
        const subscription = delivery.push_subscriptions;

        if (!subscription?.is_active) {
          await supabase
            .from("notification_push_deliveries")
            .update({
              error_message: "Subscription inactive",
              response_payload: { reason: "inactive" },
              status: "failed"
            })
            .eq("id", delivery.id);
          continue;
        }

        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh
              }
            },
            createPushPayload(origin, delivery)
          );

          const sentAt = new Date().toISOString();

          await Promise.all([
            supabase
              .from("notification_push_deliveries")
              .update({
                error_message: null,
                response_payload: { delivered: true },
                sent_at: sentAt,
                status: "sent"
              })
              .eq("id", delivery.id),
            supabase
              .from("push_subscriptions")
              .update({
                is_active: true,
                last_error: null,
                last_seen_at: sentAt,
                last_success_at: sentAt
              })
              .eq("id", subscription.id)
          ]);
        } catch (error) {
          const statusCode = error?.statusCode || null;
          const errorMessage =
            error instanceof Error ? error.message : "Push delivery failed";

          await Promise.all([
            supabase
              .from("notification_push_deliveries")
              .update({
                error_message: errorMessage,
                response_payload: {
                  message: errorMessage,
                  statusCode
                },
                status: "failed"
              })
              .eq("id", delivery.id),
            supabase
              .from("push_subscriptions")
              .update({
                is_active: !(statusCode === 404 || statusCode === 410),
                last_error: errorMessage,
                last_seen_at: new Date().toISOString()
              })
              .eq("id", subscription.id)
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to dispatch web push notifications", error);
    } finally {
      isDispatching = false;
    }
  };

  const start = () => {
    if (!pushEnabled || deliveryInterval) {
      return;
    }

    if (!configuredPublicKey || !configuredPrivateKey) {
      console.warn(
        "Every1 web push is using an ephemeral VAPID key pair. Set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY for stable subscriptions."
      );
    }

    void dispatchPendingPushes();
    deliveryInterval = setInterval(() => {
      void dispatchPendingPushes();
    }, 15000);
  };

  const handleApiRequest = async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (!requestUrl.pathname.startsWith("/api/push/")) {
      return false;
    }

    if (requestUrl.pathname === "/api/push/public-key") {
      jsonResponse(response, 200, {
        enabled: pushEnabled,
        publicKey: pushEnabled ? vapidKeys.publicKey : null
      });
      return true;
    }

    if (!pushEnabled || !supabase) {
      jsonResponse(response, 503, {
        error: "Browser push is not enabled on this server."
      });
      return true;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/push/subscribe"
    ) {
      try {
        const body = await readJsonBody(request);
        const profileId = body?.profileId?.trim();
        const endpoint = body?.subscription?.endpoint?.trim();
        const p256dh = body?.subscription?.keys?.p256dh?.trim();
        const auth = body?.subscription?.keys?.auth?.trim();

        if (!profileId || !endpoint || !p256dh || !auth) {
          jsonResponse(response, 400, {
            error: "Missing profileId or subscription payload."
          });
          return true;
        }

        const { error } = await supabase.from("push_subscriptions").upsert(
          {
            auth,
            endpoint,
            is_active: true,
            last_error: null,
            last_seen_at: new Date().toISOString(),
            p256dh,
            profile_id: profileId,
            user_agent: body?.userAgent?.trim() || null
          },
          { onConflict: "endpoint" }
        );

        if (error) {
          throw error;
        }

        jsonResponse(response, 200, { ok: true });
      } catch (error) {
        jsonResponse(response, 500, {
          error: error instanceof Error ? error.message : "Subscribe failed."
        });
      }

      return true;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/push/unsubscribe"
    ) {
      try {
        const body = await readJsonBody(request);
        const profileId = body?.profileId?.trim();
        const endpoint = body?.endpoint?.trim();

        if (!profileId || !endpoint) {
          jsonResponse(response, 400, {
            error: "Missing profileId or endpoint."
          });
          return true;
        }

        const { error } = await supabase
          .from("push_subscriptions")
          .update({
            is_active: false,
            last_seen_at: new Date().toISOString()
          })
          .eq("profile_id", profileId)
          .eq("endpoint", endpoint);

        if (error) {
          throw error;
        }

        jsonResponse(response, 200, { ok: true });
      } catch (error) {
        jsonResponse(response, 500, {
          error: error instanceof Error ? error.message : "Unsubscribe failed."
        });
      }

      return true;
    }

    jsonResponse(response, 404, { error: "Push route not found." });
    return true;
  };

  return {
    handleApiRequest,
    publicKey: vapidKeys.publicKey,
    pushEnabled,
    start
  };
};
