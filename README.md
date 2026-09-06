# Luanti Mobile Web — Luanti (Minetest) on the web, optimised for mobile, deployable to Vercel

A mobile-first wrapper around the **Luanti** (formerly **Minetest**) game engine,
deployed to **Vercel** as a Progressive Web App. It bundles:

- a **WASM client loader** that boots the real Luanti engine when its compiled
  artifacts are present, with a **2D fallback demo** when they are not;
- a full **virtual control system** (adaptive joystick + action buttons + camera
  drag + pinch zoom + haptics + auto-hide + on-device customisation);
- an **adaptive performance controller** (rolling FPS → auto quality tier);
- **PWA** install / offline / fullscreen support;
- **Vercel config, headers, and a service worker** tuned for COOP/COEP + WASM.

> **Reality check (read this first).** Luanti is a large C++ engine with a
> custom Irrlicht-style renderer. There is **no official WASM target** and
> **Vercel cannot host the interactive game server** (its functions are stateless
> and don't support WebSocket connections). This repo delivers the **frontend
> wrapper + control layer + deployment config + build pipeline** — the piece you
> actually control and the piece that is realistically deployable to Vercel.
> The heavy engine itself is produced by the community
> `paradust7/luanti-wasm` / `Kaesual/minetest-wasm` Emscripten pipeline and
> dropped into `/public`. See [docs/TECHNICAL_FEASIBILITY.md](docs/TECHNICAL_FEASIBILITY.md)
> and [docs/WASM_BUILD.md](docs/WASM_BUILD.md).

---

## Project structure

```
.
├── app/                          # Next.js App Router
│   ├── layout.tsx                # metadata, PWA meta, viewport
│   ├── globals.css               # all styles (controls, HUD, loading)
│   └── page.tsx                  # composition root (engine + controls + HUD)
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # service worker (offline + immutable cache)
│   ├── icons/                    # generated PWA icons
│   ├── README.md                 # "where do the WASM files go?"
│   └── luanti.js|wasm|data       # ⚠️ produced by the build, git-ignored
├── src/
│   ├── components/
│   │   ├── VirtualControls.tsx   # joystick + buttons + camera + settings
│   │   ├── LoadingScreen.tsx     # start menu + progress bar
│   │   └── PerformanceMonitor.tsx# FPS + quality-tier HUD chips
│   ├── hooks/
│   │   ├── useGameEngine.ts      # engine boot + rAF loop + adaptive quality
│   │   └── usePWA.ts             # SW registration + install prompt + fullscreen
│   ├── lib/
│   │   ├── wasmLoader.ts         # Emscripten loader + demo fallback
│   │   ├── inputHandler.ts       # multi-touch -> InputSnapshot
│   │   ├── renderer.ts           # procedural 2D demo world
│   │   ├── quality.ts            # adaptive quality controller
│   │   └── types.ts              # shared types
├── scripts/
│   └── build-luanti-wasm.sh      # builds the real engine via the upstream pipeline
├── docs/                         # feasibility report + guides (see below)
├── vercel.json                   # headers, rewrites
├── next.config.mjs
├── tsconfig.json
└── package.json
```

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

You'll see the start screen → tap **Play** → the 2D demo world runs with full
virtual controls, FPS meter, and quality control. The `demo` chip indicates the
real engine isn't wired up yet.

To load the actual Luanti client instead:

```bash
chmod +x scripts/build-luanti-wasm.sh
./scripts/build-luanti-wasm.sh   # requires Docker; stages artifacts into /public
npm run dev
```

## Deploy to Vercel

`vercel.json` is ready. Push this repo to GitHub and import in Vercel, or:

```bash
npx vercel --prod
```

What Vercel serves: the Next.js frontend, the WASM assets (as static `/public`
files), and the PWA. **It does not and cannot host the game server** — that's
expected and documented.

### Critical headers

The engine requires a shared-memory-capable context, so `vercel.json` sets:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

## Performance targets

| Goal                              | Status in this repo                              |
| --------------------------------- | ------------------------------------------------ |
| 60 FPS on mid-range mobile        | Adaptive quality loop + render-distance scaling  |
| < 3 s initial load                | 93.9 kB First Load JS; WASM streamed/lazy        |
| < 100 MB memory                   | Bounded tile budget + asset streaming hooks      |
| < 50 ms input latency             | Single-frame input snapshot (no React re-render) |
| Touch latency < 16 ms             | Pointer Events + `touch-action:none`             |

## Documentation

- [docs/TECHNICAL_FEASIBILITY.md](docs/TECHNICAL_FEASIBILITY.md) — research findings & the answers to your "questions to investigate".
- [docs/WASM_BUILD.md](docs/WASM_BUILD.md) — how to compile/obtain the `.wasm` engine and wire it in.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisions and reasoning.
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — all implemented optimisations.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — common issues & fixes.
- [docs/MOBILE_TESTING.md](docs/MOBILE_TESTING.md) — device test matrix & manual QA steps.
- [docs/OPTIMIZATION_REPORT.md](docs/OPTIMIZATION_REPORT.md) — feasibility summary + next steps.

## License & attribution

- The **frontend wrapper** (this repo) is released under the **MIT License** —
  see [LICENSE](LICENSE).
- The **Luanti engine** and any files derived from it are **LGPL-2.1-or-later**.
  The WASM build pipeline (`paradust7/minetest-wasm`, `Kaesual/minetest-wasm`)
  is **LGPLv2.1**. When you build and distribute the engine binary, you must
  comply with LGPL (provide source/modification rights). Keep the wrapper and
  the engine as separate, clearly-licensed artifacts. See [NOTICE](NOTICE).

## Contributing / roadmap

See [docs/ADVANCED.md](docs/ADVANCED.md) for the advanced topics (multiplayer,
WebRTC/WebTransport proxy, asset pipeline, cross-browser, accessibility,
analytics, security, state management, build optimisation) and the prioritised
next steps.
