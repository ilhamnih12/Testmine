/* Luanti Mobile Web - Service Worker
 *
 * Strategies:
 *   - navigations (documents): network-first, fall back to cache when offline.
 *   - WASM / data / hashed assets: cache-first with background fill; these are
 *     immutable & content-addressed so revalidation is wasteful.
 *   - everything else: stale-while-revalidate.
 *
 * IMPORTANT (Vercel + COOP/COEP): do NOT cache the cross-origin UDP-proxy
 * responses; WebSockets/webtransport goes through the proxy server, not here.
 */
const VERSION = "luanti-v1";
const CORE_CACHE = `${VERSION}-core`;
const IMMUTABLE_CACHE = `${VERSION}-immutable`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.json",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("luanti-") && k !== CORE_CACHE && k !== IMMUTABLE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

function isImmutable(url) {
  return /\.(wasm|data|pak|zip|png|jpg|webp|woff2?|map)$/i.test(url.pathname) ||
    /\.[0-9a-f]{8,}\./i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigation requests: network-first.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Immutable assets (WASM, data, media): cache-first.
  if (isImmutable(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(IMMUTABLE_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
      return cached || network;
    }),
  );
});
