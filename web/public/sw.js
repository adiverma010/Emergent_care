const CACHE_NAME = "carecompass-sathi-shell-v2";
const APP_SHELL = [
  "/",
  "/emergency",
  "/prescriptions",
  "/profile",
  "/onboarding",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install warning:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // STRICTLY DO NOT CACHE API CALLS
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/triage") ||
    url.pathname.startsWith("/dispatch") ||
    url.pathname.startsWith("/hospitals") ||
    url.pathname.startsWith("/prescription") ||
    url.pathname.startsWith("/reminders") ||
    url.pathname.startsWith("/homecare") ||
    url.pathname.startsWith("/greeting") ||
    url.port === "8000" ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  // Skip hot-reload / dev socket
  if (url.pathname.includes("/_next/webpack-hmr")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match(event.request).then((nav) => nav || caches.match("/"));
          }
        });

      return cached || fetchPromise;
    })
  );
});
