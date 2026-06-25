// Service Worker v3 - cleanup forzado de caché vieja
const CACHE_NAME = "agromonitor-v3";
const RUNTIME_CACHE = "agromonitor-runtime-v3";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      "/", "/index.html", "/manifest.json",
    ]).catch(()=>null))
  );
});

self.addEventListener("activate", event => {
  // BORRA TODOS los cachés viejos
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
    .then(() => {
      // Notificar a las páginas abiertas que se actualizaron
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("anthropic.com") ||
      url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
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

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response && (response.status === 200 || response.type === "opaque")) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone)).catch(()=>null);
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
