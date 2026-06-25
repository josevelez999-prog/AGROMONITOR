// Service Worker robusto - app funcional 100% offline después del primer load
const CACHE_NAME = "agromonitor-v2";
const RUNTIME_CACHE = "agromonitor-runtime-v2";

self.addEventListener("install", event => {
  // Skip waiting para activarse inmediatamente
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      "/",
      "/index.html",
      "/manifest.json",
    ]).catch(()=>null))
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

  // NO interceptar Firebase ni Anthropic ni /api/ - esos necesitan red real
  if (url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("anthropic.com") ||
      url.pathname.startsWith("/api/")) {
    return;
  }

  // Para navegación (cuando el usuario abre la app): network-first con fallback a index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cachear la respuesta de navegación
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => 
          caches.match(request).then(cached => 
            cached || caches.match("/index.html") || caches.match("/")
          )
        )
    );
    return;
  }

  // Para assets (JS, CSS, imágenes): cache-first con network fallback + cache update
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        // Cachear cualquier respuesta exitosa (incluyendo opaque cross-origin)
        if (response && (response.status === 200 || response.type === "opaque")) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone)).catch(()=>null);
        }
        return response;
      }).catch(() => cached);

      // Si hay caché lo retorna inmediato, sino espera la red
      return cached || fetchPromise;
    })
  );
});

// Mensaje del cliente para forzar update del SW
self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
