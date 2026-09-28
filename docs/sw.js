const CACHE = "busquem-xarxa-v5";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./i18n.json",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting(); // Instantly activate new service worker
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE) {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim()) // Take control of all open pages immediately
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Network First for libraries.json so user always gets live data when online
  if (url.pathname.includes("libraries.json")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache First for app shell static resources
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
