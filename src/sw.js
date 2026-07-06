/* ------------------------------------------------------------
   Custom service worker (vite-plugin-pwa injectManifest mode).
   Replicates the previous generated behaviour — precache for
   offline-first, font runtime caching, auto-update — and adds
   Web Push handlers for background reminders.
   ------------------------------------------------------------ */
import { clientsClaim } from "workbox-core";
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/* SPA navigations serve the precached shell */
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({ cacheName: "google-fonts-css" })
);
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-files",
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

/* ---- Web Push: background reminders from the companion server ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "LifeEngine", {
      body: data.body || "Your deck is waiting — one completion keeps the streak alive.",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "lifeengine-reminder", // replaces an unseen older reminder
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
        }
        return self.clients.openWindow(self.registration.scope);
      })
  );
});
