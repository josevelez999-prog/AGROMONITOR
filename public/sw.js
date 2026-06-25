// Service Worker - Permite que la app se abra sin internet
const CACHE_NAME = "agromonitor-v1";
const RUNTIME_CACHE = "agromonitor-runtime-v1";

// Recursos críticos que se cachean al instalar
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // No interceptar peticiones a Firebase ni Anthropic
  if (url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("anthropic.com") ||
      url.pathname.startsWith("/api/")) {
    return;
  }

  // Stale-while-revalidate: sirve del caché y actualiza en background
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || caches.match("/index.html"));

      return cached || networkFetch;
    })
  );
});
