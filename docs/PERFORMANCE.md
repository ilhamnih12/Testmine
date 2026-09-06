# Performance Optimisation Guide

Targets (from the brief):

| Metric | Target | Where it's handled |
| --- | --- | --- |
| 60 FPS mid-range mobile (Snapdragon 600) | 60 FPS | `src/lib/quality.ts` adaptive loop |
| Initial load | < 3 s | 94 kB shell + streamed/compressed WASM |
| Memory | < 100 MB | bounded tile budget + cap on assets |
| Input latency | < 50 ms (game < 16 ms) | `src/lib/inputHandler.ts` single-frame snapshot |
| Touch latency | < 16 ms | Pointer Events + `touch-action:none` |

## What's implemented here

### 1. Input latency
- Pointer Events handle all touch; the canvas is `touch-action: none` so the
  browser can't delay/steal gestures (`app/globals.css`).
- Input writes into a **mutable snapshot**; the engine loop reads it once/frame.
  **Zero React re-renders on pointermove.**
- `deadzone=9px`, `clamp=60px` → no jitter and no over-sensitive camera.

### 2. Adaptive performance
- `src/lib/quality.ts` averages the last ~1.5 s of frame times, upgrades/downgrades
  a tier every ≥2 s, and invokes `applyQuality(tier)`.
- In `src/lib/renderer.ts`, the tier controls **speed** (blocks/sec) and the
  world scroll rate. With the real engine, tier should bind draw distance,
  texture size, particle density, and shadow quality.

### 3. Memory discipline
- `src/lib/types.ts` exports `MAX_VIEW_TILES = 480`; the demo world crops work to
  the **visible window** and never allocates beyond that budget.
- `src/lib/wasmLoader.ts` uses a bounded `WebAssembly.Memory` in the fallback.

### 4. Rendering (demo)
- Viewport culling (skip tiles off-screen).
- Distance-based shading, no per-tile gradient objects (maps reused).
- DPR capped at `2x` (`src/lib/renderer.ts`).

### 5. Delivery / PWA
- `vercel.json`: **immutable** cache on `/public/*` (content), COOP/COEP headers.
- `public/sw.js`: cache-first for `.wasm/.data/.png` etc., network-first for
  navigations, stale-while-revalidate elsewhere.

## For the real engine (apply to the WASM fork)

### Rendering optimisation
- **Dynamic LOD:** chunk mesh detail / transparency distance scales with a
  quality tier.
- **Draw-call batching:** merge chunk sub-meshes; reduce texture switches;
  use a texture atlas.
- **Texture compression:** **Basis Universal (KTX2)** for web (works on mobile
  GPUs), fall back to ASTC/ETC for native; mipmaps on.
- **Shader simplification:** precompile a low-tier shader variant for mobile
  GPUs (fewer samplers, no expensive lighting).
- **Adaptive resolution scaling:** render at 0.6–0.85× and upscale; toggle via
  the tier.
- **Frustum + occlusion culling:** for chunk rendering (skip chunks behind the
  camera / occluded).

### Memory management
- **Asset streaming** via Emscripten `FETCH`/`ASYNCIFY`; fetch textures/nodes
  on demand.
- **Chunk load/unload by distance**; release meshes far away.
- **Object pooling** for entities/particles.

### Network
- **Delta compression** for block/inventory updates (only changed bytes).
- **Client-side prediction** for the player + **interpolation** for others.
- **Lag compensation** (replay of server-missed inputs) on the server.
- **WebSocket/WebTransport** tunnelling of the UDP protocol with a proxy.

## Profiling workflow

1. Record FPS + frame time (shown in the HUD chip) on a target phone.
2. Watch the `▦ tier` flip to lower tiers under load — that's the adaptive
   loop doing its job.
3. Use Chrome DevTools (remote debugging over `adb` for Android) → Performance
   panel → capture the WASM main-thread tasks (worldgen, mesh rebuild).
4. If `fps < 30`, the biggest wins are, in order: **lower render distance →
   lower resolution scale → disable particles → smaller texture set**.

## Cross-browser notes

- **Safari iOS:** SharedArrayBuffer needs COOP/COEP (set). Fullscreen needs a
  user gesture (handled by the Play button). `navigator.vibrate` is **not**
  supported on iOS — haptics degrade gracefully (guarded try/catch).
- **Chrome Android:** `WebAssembly.instantiateStreaming` works; large WASM loads
  benefit from `Content-Type: application/wasm` + precompression.
- **Firefox Android:** Good WASM/SharedArrayBuffer support; `requestFullscreen`
  works.
