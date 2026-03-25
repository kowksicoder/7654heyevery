import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createClient } from "@supabase/supabase-js";

const LENS_API_URL = "https://api.lens.xyz/graphql";
const IPFS_GATEWAY = "https://gw.ipfs-lens.dev/ipfs/";
const STORAGE_NODE_URL = "https://api.grove.storage/";
const CARD_HEIGHT = 630;
const CARD_WIDTH = 1200;

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

const normalizeHandle = (value) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const lastSegment = withoutPrefix.split("/").pop()?.trim() || withoutPrefix;

  return lastSegment || null;
};

const normalizeAddress = (value) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null;
};

const sanitizeStorageUrl = (value) => {
  if (!value) {
    return "";
  }

  if (/^Qm[1-9A-Za-z]{44}/.test(value)) {
    return `${IPFS_GATEWAY}${value}`;
  }

  return value
    .replace("https://ipfs.io/ipfs/", IPFS_GATEWAY)
    .replace("ipfs://ipfs/", IPFS_GATEWAY)
    .replace("ipfs://", IPFS_GATEWAY)
    .replace("lens://", STORAGE_NODE_URL)
    .replace("ar://", "https://gateway.arweave.net/");
};

const cleanWhitespace = (value) => value?.replace(/\s+/g, " ").trim() || "";

const truncateText = (value, characterLimit) => {
  const cleaned = cleanWhitespace(value);

  if (!cleaned || cleaned.length <= characterLimit) {
    return cleaned;
  }

  return `${cleaned.slice(0, Math.max(0, characterLimit - 1)).trim()}...`;
};

const formatShortAddress = (value) => {
  if (!value || value.length < 10) {
    return value || "";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const escapeXml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const splitLines = (value, maxCharacters, maxLines) => {
  const words = cleanWhitespace(value).split(" ").filter(Boolean);

  if (!words.length) {
    return [];
  }

  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxCharacters) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (
    lines.length === maxLines &&
    words.join(" ").length > lines.join(" ").length
  ) {
    lines[maxLines - 1] = truncateText(lines[maxLines - 1], maxCharacters);
  }

  return lines;
};

const buildProfileShareCardPath = ({ address, handle }) => {
  const params = new URLSearchParams();
  const normalizedHandle = normalizeHandle(handle);
  const normalizedAddress = normalizeAddress(address);

  if (normalizedHandle) {
    params.set("username", normalizedHandle);
  } else if (normalizedAddress) {
    params.set("address", normalizedAddress);
  }

  const query = params.toString();

  return query ? `/og/profile.png?${query}` : "/og/profile.png";
};

const queryLens = async (query, variables) => {
  const response = await fetch(LENS_API_URL, {
    body: JSON.stringify({ query, variables }),
    headers: {
      "content-type": "application/json",
      origin: "https://hey.xyz"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Lens request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Lens request failed.");
  }

  return payload.data;
};

const fetchImageDataUri = async (value) => {
  const url = sanitizeStorageUrl(value);

  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") ||
      (url.endsWith(".png")
        ? "image/png"
        : url.endsWith(".jpg") || url.endsWith(".jpeg")
          ? "image/jpeg"
          : url.endsWith(".webp")
            ? "image/webp"
            : "image/png");
    const buffer = Buffer.from(await response.arrayBuffer());

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
};

const getInitials = (input) => {
  const cleaned = cleanWhitespace(input);

  if (!cleaned) {
    return "E1";
  }

  const words = cleaned.split(" ").filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0]?.[0] || ""}${words[1]?.[0] || ""}`.toUpperCase();
};

const renderLines = (lines, startY, lineHeight, className) =>
  lines
    .map(
      (line, index) =>
        `<text class="${className}" x="372" y="${startY + index * lineHeight}">${escapeXml(line)}</text>`
    )
    .join("");

const buildProfileCardSvg = async (profile) => {
  const displayHandle = profile.handle
    ? `@${profile.handle}`
    : formatShortAddress(profile.address || profile.walletAddress);
  const titleName = profile.displayName || displayHandle || "Every1 profile";
  const bioLines = splitLines(
    profile.bio || "Public creator profile on Every1.",
    42,
    3
  );
  const footerLabel = profile.walletAddress
    ? `Wallet ${formatShortAddress(profile.walletAddress)}`
    : "Every1 public profile";
  const avatarDataUri = await fetchImageDataUri(profile.avatarUrl);
  const initials = getInitials(titleName || displayHandle);
  const tickerLabel = profile.creatorCoinTicker
    ? `${profile.creatorCoinTicker.toUpperCase()} coin live`
    : "Creator profile";
  const verificationLabel = profile.verificationStatus === "verified";
  const avatarMarkup = avatarDataUri
    ? `<image
        clip-path="url(#avatar-clip)"
        height="156"
        href="${avatarDataUri}"
        preserveAspectRatio="xMidYMid slice"
        width="156"
        x="120"
        y="172"
      />`
    : `<text
        fill="#f8fafc"
        font-family="Arial, Helvetica, sans-serif"
        font-size="58"
        font-weight="700"
        text-anchor="middle"
        x="198"
        y="265"
      >${escapeXml(initials)}</text>`;

  return `
    <svg
      width="${CARD_WIDTH}"
      height="${CARD_HEIGHT}"
      viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="page-bg" x1="94" y1="54" x2="1090" y2="598" gradientUnits="userSpaceOnUse">
          <stop stop-color="#020617" />
          <stop offset="0.56" stop-color="#111827" />
          <stop offset="1" stop-color="#1d4ed8" />
        </linearGradient>
        <linearGradient id="panel-bg" x1="68" y1="72" x2="1134" y2="554" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0f172a" stop-opacity="0.94" />
          <stop offset="1" stop-color="#101826" stop-opacity="0.9" />
        </linearGradient>
        <linearGradient id="accent-pill" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#60a5fa" />
          <stop offset="1" stop-color="#22c55e" />
        </linearGradient>
        <clipPath id="avatar-clip">
          <rect x="120" y="172" width="156" height="156" rx="42" />
        </clipPath>
      </defs>

      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#page-bg)" />
      <circle cx="1084" cy="82" r="224" fill="#38bdf8" fill-opacity="0.16" />
      <circle cx="1000" cy="550" r="180" fill="#22c55e" fill-opacity="0.12" />
      <rect
        x="44"
        y="40"
        width="1112"
        height="550"
        rx="38"
        fill="url(#panel-bg)"
        stroke="#FFFFFF"
        stroke-opacity="0.14"
        stroke-width="2"
      />

      <rect x="84" y="84" width="146" height="38" rx="19" fill="#111827" fill-opacity="0.72" />
      <text
        fill="#E2E8F0"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="700"
        letter-spacing="1.8"
        x="106"
        y="109"
      >EVERY1</text>
      <text
        fill="#93C5FD"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="700"
        x="187"
        y="109"
      >PROFILE</text>

      <rect x="120" y="172" width="156" height="156" rx="42" fill="#1E293B" />
      ${avatarMarkup}

      <rect x="372" y="118" width="176" height="36" rx="18" fill="url(#accent-pill)" fill-opacity="0.95" />
      <text
        fill="#08111f"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="700"
        x="398"
        y="141"
      >${escapeXml(tickerLabel)}</text>

      <text
        fill="#F8FAFC"
        font-family="Arial, Helvetica, sans-serif"
        font-size="64"
        font-weight="700"
        x="372"
        y="248"
      >${escapeXml(titleName)}</text>

      <text
        fill="#CBD5E1"
        font-family="Arial, Helvetica, sans-serif"
        font-size="32"
        font-weight="600"
        x="372"
        y="294"
      >${escapeXml(displayHandle || "Every1")}</text>

      ${
        verificationLabel
          ? `<rect x="372" y="320" width="126" height="34" rx="17" fill="#1D4ED8" fill-opacity="0.22" stroke="#60A5FA" stroke-opacity="0.7" />
      <text
        fill="#BFDBFE"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="700"
        x="402"
        y="342"
      >VERIFIED</text>`
          : ""
      }

      ${renderLines(bioLines, 404, 42, "bio-line")}

      <rect x="84" y="506" width="1032" height="1" fill="#FFFFFF" fill-opacity="0.12" />
      <text
        fill="#94A3B8"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24"
        font-weight="500"
        x="84"
        y="554"
      >${escapeXml(footerLabel)}</text>
      <text
        fill="#E2E8F0"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24"
        font-weight="700"
        text-anchor="end"
        x="1116"
        y="554"
      >every1.app</text>

      <style>
        .bio-line {
          fill: #e2e8f0;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 30px;
          font-weight: 500;
        }
      </style>
    </svg>
  `;
};

export const createProfileShareRuntime = ({ rootDir }) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabase =
    supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
      : null;

  const fetchSupabaseProfile = async ({ address, username }) => {
    if (!supabase) {
      return null;
    }

    const normalizedAddress = normalizeAddress(address);
    const normalizedHandle = normalizeHandle(username)?.toLowerCase() || null;

    if (normalizedAddress) {
      for (const column of ["wallet_address", "lens_account_address"]) {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "username, zora_handle, display_name, bio, avatar_url, banner_url, wallet_address, lens_account_address, verification_status"
          )
          .ilike(column, normalizedAddress)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          return data;
        }
      }
    }

    if (normalizedHandle) {
      for (const column of ["username", "zora_handle"]) {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "username, zora_handle, display_name, bio, avatar_url, banner_url, wallet_address, lens_account_address, verification_status"
          )
          .ilike(column, normalizedHandle)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          return data;
        }
      }
    }

    return null;
  };

  const fetchProfileCoinStats = async ({ address, username }) => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc("get_public_profile_stats", {
      input_profile_id: null,
      input_username: normalizeHandle(username),
      input_wallet_address: normalizeAddress(address)
    });

    if (error) {
      throw error;
    }

    return data?.[0] || null;
  };

  const fetchLensAccount = async ({ address, username }) => {
    const request = address
      ? { address }
      : { username: { localName: normalizeHandle(username) } };
    const data = await queryLens(
      `
        query AccountMeta($request: AccountRequest!) {
          account(request: $request) {
            address
            owner
            metadata {
              bio
              coverPicture
              name
              picture
            }
            username(request: { autoResolve: true }) {
              localName
              value
            }
          }
        }
      `,
      { request }
    );

    const account = data?.account;

    if (!account) {
      return null;
    }

    return {
      address: account.address || address || null,
      avatarUrl: sanitizeStorageUrl(account.metadata?.picture),
      bannerUrl: sanitizeStorageUrl(account.metadata?.coverPicture),
      bio: account.metadata?.bio || null,
      displayName: account.metadata?.name || null,
      handle: normalizeHandle(
        account.username?.localName || account.username?.value || username
      ),
      verificationStatus: "unverified",
      walletAddress: account.owner || null
    };
  };

  const resolvePublicProfile = async ({ address, username }) => {
    const supabaseProfile = await fetchSupabaseProfile({
      address,
      username
    }).catch(() => null);

    const profile = supabaseProfile
      ? {
          address:
            supabaseProfile.lens_account_address ||
            supabaseProfile.wallet_address ||
            address ||
            null,
          avatarUrl: sanitizeStorageUrl(supabaseProfile.avatar_url),
          bannerUrl: sanitizeStorageUrl(supabaseProfile.banner_url),
          bio: supabaseProfile.bio || null,
          displayName: supabaseProfile.display_name || null,
          handle: normalizeHandle(
            supabaseProfile.username || supabaseProfile.zora_handle || username
          ),
          verificationStatus:
            supabaseProfile.verification_status || "unverified",
          walletAddress: supabaseProfile.wallet_address || null
        }
      : await fetchLensAccount({ address, username }).catch(() => null);

    if (!profile) {
      return null;
    }

    const stats = await fetchProfileCoinStats({
      address: profile.walletAddress || address,
      username: profile.handle || username
    }).catch(() => null);

    return {
      ...profile,
      creatorCoinAddress: stats?.creator_coin_address || null,
      creatorCoinTicker: stats?.creator_coin_ticker || null
    };
  };

  const renderProfileCard = async ({ address, username }) => {
    const profile = await resolvePublicProfile({ address, username });

    const svg = await buildProfileCardSvg(
      profile || {
        address: normalizeAddress(address),
        avatarUrl: null,
        bio: "Public creator profile on Every1.",
        creatorCoinAddress: null,
        creatorCoinTicker: null,
        displayName: normalizeHandle(username)
          ? `@${normalizeHandle(username)}`
          : "Every1 profile",
        handle: normalizeHandle(username),
        verificationStatus: "unverified",
        walletAddress: normalizeAddress(address)
      }
    );

    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: CARD_WIDTH
      }
    });

    return {
      png: resvg.render().asPng(),
      profile
    };
  };

  const handleRequest = async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const pathMatch = requestUrl.pathname.match(
      /^\/og\/profile\/([^/]+)\.png$/
    );
    const isProfileCardRoute =
      requestUrl.pathname === "/og/profile.png" || Boolean(pathMatch);

    if (!isProfileCardRoute) {
      return false;
    }

    const queryAddress = normalizeAddress(
      requestUrl.searchParams.get("address")
    );
    const queryUsername = normalizeHandle(
      requestUrl.searchParams.get("username")
    );
    const pathIdentifier = pathMatch ? decodeURIComponent(pathMatch[1]) : null;
    const pathAddress = normalizeAddress(pathIdentifier);
    const pathUsername = pathAddress ? null : normalizeHandle(pathIdentifier);
    const { png } = await renderProfileCard({
      address: queryAddress || pathAddress,
      username: queryUsername || pathUsername
    });

    response.writeHead(200, {
      "cache-control": "public, max-age=300, stale-while-revalidate=600",
      "content-length": png.byteLength,
      "content-type": "image/png"
    });

    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    response.end(png);
    return true;
  };

  return {
    buildProfileShareCardPath,
    handleRequest,
    renderProfileCard,
    resolvePublicProfile
  };
};
