const VERSION = "2025-03-runtime-v2";
const ASSET_CACHE = `valkyrie-assets-${VERSION}`;
const MODEL_CACHE = `valkyrie-models-${VERSION}`;
const DATA_CACHE = `valkyrie-data-${VERSION}`;
const MODEL_CACHE_LIMIT = 140;
const ASSET_CACHE_LIMIT = 700;

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (const request of keys.slice(0, keys.length - limit)) await cache.delete(request);
}

async function cacheFirst(request, cacheName, limit) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    const cache = await caches.open(cacheName);
    void cache.put(request, response.clone()).then(() => trimCache(cache, limit)).catch(() => undefined);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.status === 200) void cache.put(request, response.clone()).catch(() => undefined);
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("valkyrie-") && name !== ASSET_CACHE && name !== MODEL_CACHE && name !== DATA_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.includes("/assets/models/")) {
    event.respondWith(cacheFirst(request, MODEL_CACHE, MODEL_CACHE_LIMIT));
  } else if (path.includes("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, ASSET_CACHE_LIMIT));
  } else if (path.includes("/data/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
