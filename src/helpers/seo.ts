const normalizeBaseUrl = (value?: null | string) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
};

export const getSiteOrigin = () => {
  const configuredOrigin = normalizeBaseUrl(import.meta.env.VITE_APP_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin) || "";
  }

  return "";
};

export const getAbsoluteUrl = (path = "/") => {
  const origin = getSiteOrigin();

  if (!origin) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${origin}${normalizedPath}`;
};

export const getShareImageUrl = (image?: null | string) => {
  if (image && /^https?:\/\//i.test(image)) {
    return image;
  }

  if (image) {
    return getAbsoluteUrl(image);
  }

  return getAbsoluteUrl("/evlogo.jpg");
};
