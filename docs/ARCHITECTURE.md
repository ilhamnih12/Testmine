# Architecture Decisions (ADR)

This file records the *why* behind the key structural choices. Links to the
code that implements each decision.

## ADR-001: Single rAF loop, React stays out of the hot path

- **Decision:** All per-frame work (input read, engine update, render, FPS
  sampling) lives in one `requestAnimationFrame` loop in
  `src/hooks/useGameEngine.ts`. React state is updated only for *slow* UI
  metrics (FPS badge, quality tier, status).
- **Why:** Re-rendering React on every `pointermove`/frame would destroy mobile
  frame time. The input handler writes into a shared mutable `InputSnapshot`,
  and the loop consumes it once per frame (`src/lib/inputHandler.ts` → `consumeFrame()`).
- **Consequence:** Input latency = at most one frame (~16 ms @60fps). No React
  reconciliation in the render path.

## ADR-002: A seam for the real engine, with a demonstrable fallback

- **Decision:** `src/lib/wasmLoader.ts` is the only place that knows about the
  Emscripten `Module`. It probes `/luanti.js`; if present it boots the real
  engine; otherwise it returns a procedural `DemoWorld` renderer.
- **Why:** The heavy engine build is out of scope for a source repo and is
  git-ignored. The seam lets the wrapper be developed/tested against a real
  device with full virtual controls before the WASM binary is dropped in, and
  keeps the repo deployable as a working PWA either way.
- **Trade-off:** The demo is a stand-in, not Luanti. The `demo` HUD chip makes
  this explicit to the user.

## ADR-003: Vercel hosts the client only, never the game server

- **Decision:** `vercel.json` configures headers, rewrites, and static caching
  for the frontend + WASM. No attempt to run the game server on Vercel.
- **Why:** Vercel Serverless/Edge functions are stateless, time-limited, and do
  **not** support WebSocket/persistent connections. Luanti's authoritative UDP
  server needs a long-lived, stateful, socket-capable host.
- **Alternative (documented):** Vercel (frontend) + a WebSocket/UDP proxy +
  dedicated server on Fly.io/a VPS. See `docs/TECHNICAL_FEASIBILITY.md`.

## ADR-004: Pointer Events + `touch-action: none` for multi-touch

- **Decision:** The input layer uses the **Pointer Events API** (`pointerdown/move/up/cancel`),
  not raw touch events.
- **Why:** Pointer Events unify mouse/touch/pen and give reliable multi-touch
  tracking via `pointerId`. `touch-action: none` on the surface prevents the
  browser from hijacking gestures (pinch/scroll) so the game sees raw frames.
- **Deadzone + clamp:** A 9 px deadzone and 60 px travel clamp produce stable,
  predictable joystick movement (see `src/lib/inputHandler.ts`).

## ADR-005: Adaptive quality driven by a rolling frame-time window

- **Decision:** `src/lib/quality.ts` keeps the last ~1.5 s of frame times and
  recomputes a tier (`high → medium → low → potato`) at most every 2 s.
- **Why:** Instant reactions thrash; a window smooths noise. Tiers map to the
  demo's render budget (tile count) and, with the real engine, map to draw
  distance / texture quality / particle count.
- **Manual override:** The HUD `▦ tier` chip cycles tiers for users who prefer
  to choose.

## ADR-006: On-device control customisation, no server

- **Decision:** Control opacity/scale/preset persist to `localStorage`
  (`src/components/VirtualControls.tsx`), keyed `luanti-controls-v1`.
- **Why:** Per-device preference belongs client-side; no backend needed, no
  request to round-trip. Note localStorage is per-origin, so it follows the
  user on a device but not across devices (see `docs/ADVANCED.md` for cloud sync).

## ADR-007: PWA as the delivery/install vehicle

- **Decision:** `public/manifest.json` (fullscreen, landscape, installable) +
  `public/sw.js` (offline + immutable-asset cache) + fullscreen/orientation
  handling in `src/hooks/usePWA.ts`.
- **Why:** A heavy WASM game benefits enormously from an installable,
  fullscreen, offline-capable surface. This is the closest thing on the open web
  to a native mobile game.

## ADR-008: Restrain the WASM bundle from the report

- **Decision:** Keep the compiled engine out of git; produce/pull it via
  `scripts/build-luanti-wasm.sh` and stage into `/public`.
- **Why:** A ~10–30 MB binary bloats the repo and breaks review. Artifacts are
  git-ignored; the pipeline reproduces them.

## Recommended directory layout (target)

```
/                                  # Next.js app + wrapper (this repo)
├── app/                           # pages + fonts + global css
├── public/
│   ├── luanti.js / .wasm / .data  # engine (git-ignored, build-produced)
│   └── games/                     # game packs
├── src/                           # React wrapper, controls, perf, loader
├── scripts/                       # engine build
├── docs/                          # feasibility, guides
└── vercel.json                    # headers/rewrites/caching
```

A decoupled game server/proxy would live in a **separate repo/service** and is
out of scope here.
