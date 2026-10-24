const CACHE_NAME = "carecompass-sathi-v1";
const STATIC_ASSETS = [
  "/",
  "/triage",
  "/emergency",
  "/prescriptions",
  "/profile",
  "/onboarding",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install Event - Pre-cache essential app shell routes
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install cache warning:", err))
  );
});

// Activate Event - Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate or Network-first with cache fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip API or cross-origin calls
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip Next.js hot reload / development SSE calls
  if (event.request.url.includes("/_next/webpack-hmr")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available, while fetching in background
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is an HTML page navigation, fallback to root or cached route
          if (event.request.mode === "navigate") {
            return caches.match(event.request).then((navCached) => navCached || caches.match("/"));
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
