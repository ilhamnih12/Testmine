/* Luanti Web — Service Worker (v2)
 *
 * Scope: SAME-ORIGIN requests only (the game engine runs in its own
 * document — either a cross-origin mirror iframe we must never touch, or
 * /engine/* when self-hosted).
 *
 * Strategies:
 *   - navigations: network-first, fall back to cache when offline.
 *   - immutable assets (wasm/pack/hash-like): cache-first.
 *   - everything else: stale-while-revalidate.
 */
const VERSION = "luanti-web-v2";
const CORE_CACHE = `${VERSION}-core`;
const IMMUTABLE_CACHE = `${VERSION}-immutable`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) =>
      cache.addAll(["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"]),
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
  return /\.(wasm|data|pack|zip|png|jpg|jpeg|webp|svg|woff2?|map)$/i.test(url.pathname) ||
    /\.[0-9a-f]{8,}\./i.test(url.pathname) ||
    url.pathname.startsWith("/engine/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs. Cross-origin (mirror iframe) is untouched.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

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
