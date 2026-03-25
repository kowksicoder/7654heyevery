import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

export const loadEnvFile = (filePath) => {
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

export const jsonResponse = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
};

export const sendError = (response, statusCode, message, extras = {}) =>
  jsonResponse(response, statusCode, {
    error: message,
    success: false,
    ...extras
  });

export const readRawBody = (request) =>
  new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
    });

    request.on("end", () => resolve(rawBody));
    request.on("error", reject);
  });

export const parseJsonBody = (rawBody) => {
  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody);
};

export const sha256Hex = (value) =>
  createHash("sha256").update(value).digest("hex");

export const toKobo = (value) => {
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(
          String(value ?? "")
            .replace(/,/g, "")
            .trim()
        );

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * 100);
};

export const fromKobo = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric / 100 : 0;
};

export const asMoney = (kobo) => Number(fromKobo(kobo).toFixed(2));

export const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value?.trim() || ""
  );

export const createCheckoutReference = (prefix) =>
  `${prefix}_${randomUUID().replace(/-/g, "")}`;

export const normalizeText = (value) => value?.trim() || null;

export const normalizePaginationLimit = (value, fallback = 25, max = 100) => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
};

export const assert = (condition, message, statusCode = 400) => {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }
};

export const toStatusCode = (error, fallback = 500) =>
  Number.isInteger(error?.statusCode) ? error.statusCode : fallback;

export const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};
