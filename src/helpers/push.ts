const PUSH_PROMPT_STORAGE_KEY = "every1-browser-push-prompted";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

export const supportsBrowserPush = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "PushManager" in window &&
  "serviceWorker" in navigator;

export const getPushPromptStorageKey = (profileId: string) =>
  `${PUSH_PROMPT_STORAGE_KEY}:${profileId}`;

export const getBrowserPushPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied" as NotificationPermission;
  }

  return window.Notification.permission;
};

export const requestBrowserPushPermission = async () => {
  if (!supportsBrowserPush()) {
    return "denied" as NotificationPermission;
  }

  return window.Notification.requestPermission();
};

export const registerPushServiceWorker = async () => {
  if (!supportsBrowserPush()) {
    throw new Error("Browser push is not supported in this environment.");
  }

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
};

export const getCurrentPushSubscription = async () => {
  if (!supportsBrowserPush()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");

  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
};

export const fetchBrowserPushPublicKey = async () => {
  const response = await fetch("/api/push/public-key", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error("Failed to load browser push public key.");
  }

  const payload = (await response.json()) as {
    enabled?: boolean;
    publicKey?: string;
  };

  if (!payload.enabled || !payload.publicKey) {
    throw new Error("Browser push is not enabled on this server.");
  }

  return payload.publicKey;
};

export const ensureBrowserPushSubscription = async (profileId: string) => {
  const registration = await registerPushServiceWorker();
  const publicKey = await fetchBrowserPushPublicKey();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(publicKey),
      userVisibleOnly: true
    });
  }

  const response = await fetch("/api/push/subscribe", {
    body: JSON.stringify({
      profileId,
      subscription,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent || null : null
    }),
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to save browser push subscription.");
  }

  return subscription;
};

export const disableBrowserPushSubscription = async (profileId: string) => {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return;
  }

  await fetch("/api/push/unsubscribe", {
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      profileId
    }),
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  await subscription.unsubscribe();
};
