# /public assets

This folder is served by Vercel as the site root (see `vercel.json`). Files here
must be **static** — no bundling or compilation is applied to them.

## Luanti engine artifacts

The real engine is **not** committed to this repo (it's tens of MB of WASM). To
make the app boot the actual Luanti client instead of the bundled 2D demo,
produce these files with `scripts/build-luanti-wasm.sh` and place them here:

| File            | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `luanti.js`     | Emscripten loader script (`Module`)                |
| `luanti.wasm`   | Compiled engine binary                             |
| `luanti.data`   | Emscripten file-system image (games, textures)     |
| `games/*`       | Optional pre-packed games (e.g. VoxeLibre)         |

### How the app decides

`src/lib/wasmLoader.ts` performs a `HEAD /luanti.js` probe at runtime:

- **200** → it injects the Emscripten loader and boots the real engine.
- **404** → it falls back to `createDemoFallback()`, a lightweight procedural
  voxel renderer so the virtual controls + adaptive quality layers still run.

The fallback exists purely so the mobile-controls UX can be tested without the
heavy engine. It is intentionally a stand-in, not a replacement for Luanti.

## Static app assets

- `manifest.json` — PWA web app manifest (installable, fullscreen, landscape).
- `sw.js` — service worker (offline caching, versioned, immutable-asset cache).
- `icons/icon-192.png`, `icons/icon-512.png` — PWA/asset icons (generated).

### Headers (see `vercel.json`)

The WASM build requires a shared-memory-eligible context, so the engine needs
these response headers on the document and the artifacts:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
