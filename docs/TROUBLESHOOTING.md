# Troubleshooting Guide

## The app shows the `demo` chip (no real Luanti)

- **Cause:** `/luanti.js` is missing from `public/` (the loader probes it and
  falls back to the demo).
- **Fix:** Run `./scripts/build-luanti-wasm.sh`, or copy the compiled
  `luanti.js/.wasm/.data` from the upstream pipeline into `public/`. Restart the
  dev server / redeploy.

## Black screen or WASM fails to instantiate

- **Cause (most common): missing COOP/COEP headers.** SharedArrayBuffer /
  multithreaded WASM requires:
  ```
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  ```
- **Fix:** Ensure `vercel.json`'s headers are applied (they are, on `/ (.*)`).
  Locally in dev, confirm via DevTools → Network → response headers.
- **Secondary cause:** the `.wasm` isn't served with `Content-Type:
  application/wasm`. If you precompress (`gzip`/`br`), make sure the
  `Content-Encoding` matches and the `Content-Type` is preserved.

## Controls don't appear

- Both the virtual controls and the HUD render only when `state.status === "ready"`
  (or `"error"`) in `src/components/VirtualControls.tsx` / the page. If the
  engine stays in `loading`, controls stay hidden by design.
- **Fix:** Confirm the loader reached `ready` (the FPS chip appears). If you
  fully blocked on engine load, the demo fallback sets `ready` regardless, so
  controls should always appear.

## Joystick/Camera feels laggy or the page scrolls on touch

- **Cause:** `touch-action` not respected, or gestures being hijacked.
- **Fix:** The surface has `touch-action: none` (`.game-surface`). If you moved
  the canvas, keep that. Also check the `gesturestart`/`gesturechange`
  preventDefault in `src/lib/inputHandler.ts`.

## No vibration on iOS

- iOS Safari/WebView does **not** implement the Vibration API. The handler
  guards `navigator.vibrate` in try/catch, so it silently no-ops. Use visual
  feedback (ripple/scale) instead — there's no iOS workaround without a native
  plugin.

## Service worker not registering

- Common on iOS Safari in private mode, or when served over HTTP (needs HTTPS).
- On Vercel this is HTTPS, so it works. `navigator.serviceWorker.register("/sw.js")`
  is already wired in `src/hooks/usePWA.ts` and the failure is caught.

## Install prompt never appears

- The native browser install prompt requires a few conditions: HTTPS, a valid
  `manifest.json` with icons, a service worker, and **not** already installed /
  standalone. On desktop Chrome/Safari the `beforeinstallprompt` event may not
  fire at all (only Safari iOS shows a manual "Add to Home Screen").
- Our `usePWA` also requires `!isStandalone` and `!installed`.

## Build fails on Vercel

- Check `framework`/`buildCommand` in `vercel.json` (`npm run build`).
- The `public/**` static files (icons, manifest) are served as-is; ensure you
  haven't committed the large WASM binary (git-ignored) which would bloat the
  deploy and slow the build install step.
- If you see a TS/lint error, fix it locally first (`npm run typecheck`).

## WASM memory budget / OOM

- If the engine uses multithreading + `ALLOW_MEMORY_GROWTH` without a cap, a
  large world can balloon memory and the browser can kill the tab.
- **Fix:** Set `-s MAXIMUM_MEMORY=<cap>` (e.g. 1 GiB) in the engine build, and
  enforce distance-limited chunk loading.

## The demo world doesn't respond to input

- Ensure you clicked **Play** (start menu) so the engine booted. The demo reads
  from the same input snapshot; if the snapshot is reset or the handler is null
  (e.g. `exit()` called), input is ignored. Check the browser console for
  errors from `inputHandler.ts`.

## Fonts/icons 404

- Icons are generated in `public/icons/`. If you moved them, update
  `app/layout.tsx` metadata and `public/manifest.json`.
