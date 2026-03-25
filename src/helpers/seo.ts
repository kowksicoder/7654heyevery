const normalizeBaseUrl = (value?: null | string) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
};

const normalizeHandle = (value?: null | string) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const lastSegment = withoutPrefix.split("/").pop()?.trim() || withoutPrefix;

  return lastSegment || null;
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

export const getPublicProfileShareImagePath = (input: {
  address?: null | string;
  handle?: null | string;
}) => {
  const params = new URLSearchParams();
  const normalizedHandle = normalizeHandle(input.handle);
  const normalizedAddress = input.address?.trim().toLowerCase();

  if (normalizedHandle) {
    params.set("username", normalizedHandle);
  } else if (normalizedAddress) {
    params.set("address", normalizedAddress);
  }

  const query = params.toString();

  return query ? `/og/profile.png?${query}` : "/og/profile.png";
};
