const CACHE_NAME = "app-logo-cache-v1";

// We only pre-cache the logo since it's the primary target.
const urlsToCache: string[] = [
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/refs/heads/main/images/logo-light.svg",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/refs/heads/main/images/logo-dark.svg",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/042cd220b042844a13dc28b4d30403b2d9584288/images/mobile-logo-light.svg",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/042cd220b042844a13dc28b4d30403b2d9584288/images/mobile-logo-dark.svg",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/refs/heads/main/header.html",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/refs/heads/main/footer.html",
  "https://raw.githubusercontent.com/ryan-montville/days-for-girls-solon/refs/heads/main/modal.html",
  "/",
];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event: ExtendableEvent) => {
  console.log("[Service Worker] Install event: Pre-caching assets...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return sw.skipWaiting();
      }),
  );
});

sw.addEventListener("activate", (event: ExtendableEvent) => {
  console.log("[Service Worker] Activate event: Cleaning up old caches...");
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        return sw.clients.claim();
      }),
  );
});

sw.addEventListener("fetch", (e: FetchEvent) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches
      .match(e.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(e.request);
      })
      .catch((error) => {
        console.error("Service Worker: Fetch failed.", error);
        return caches
          .match("/assets/images/fallback-logo.svg")
          .then(
            (fallbackResponse) =>
              fallbackResponse ||
              new Response(
                "<h1>Offline</h1><p>Logo unavailable due to network error.</p>",
                { headers: { "Content-Type": "text/html" } },
              ),
          );
      }),
  );
});
