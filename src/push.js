/* ------------------------------------------------------------
   Web Push client helpers. All functions are inert unless
   PUSH_SERVER is configured (push-config.js). The server only
   ever receives: a push subscription endpoint, the reminder
   time, a timezone, and "done today" pings — never task data.
   ------------------------------------------------------------ */
import { PUSH_SERVER } from "./push-config.js";

export const pushConfigured = () =>
  !!PUSH_SERVER && "serviceWorker" in navigator && "PushManager" in window;

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

async function api(path, body) {
  const res = await fetch(PUSH_SERVER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`push server ${res.status}`);
  return res.json().catch(() => ({}));
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Subscribe this device and register it with the server (upsert). */
export async function subscribePush(time) {
  const reg = await navigator.serviceWorker.ready;
  const { key } = await (await fetch(PUSH_SERVER + "/vapid-public-key")).json();
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  await api("/subscribe", {
    subscription: sub.toJSON(),
    time,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/** Update the reminder time for an existing subscription. */
export async function updatePushTime(time) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api("/subscribe", {
    subscription: sub.toJSON(),
    time,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/** Remove this device from the server and drop the subscription. */
export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api("/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** Tell the server something was completed today, so it skips the nag. */
export async function pingDone() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api("/done", { endpoint: sub.endpoint, day: localDay() });
}
