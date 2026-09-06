# Technical Feasibility Report

*Research findings from: the [Luanti source](https://github.com/luanti-org/luanti),
official docs, the community WASM ports, Emscripten guidance, and Vercel
serverless documentation.*

## TL;DR

| Question | Answer |
| --- | --- |
| Does Luanti have a web/WASM build? | **Not official**, but a working, maintained community port exists (`paradust7/luanti-wasm`, forked/modernised by `Kaesual/minetest-wasm`). Runs in-browser with the real engine. |
| Can I run this **on Vercel**? | **Only the frontend + static WASM.** Vercel functions are stateless and **do not support WebSockets / long-lived connections**, so the *game server* cannot live there. |
| Rendering engine? | Luanti uses its own fork of **IrrlichtMT** (a fork of the **Irrlicht Engine**). It does **not** expose WebGL out of the box for WASM; the community port patches the renderer to use WebGL/WebGPU-style backends via Emscripten. |
| Is a from-scratch web port realistic? | **No, not in one pass and not from this sandbox** (no Emscripten toolchain installed, source is ~tens of thousands of C++ files, and the renderer needs deep patching). The pragmatic path is to build on the existing WASM toolchain. |
| Licensing? | Engine = **LGPL-2.1-or-later**. Wrapper can be MIT. Keep them as separate artifacts. |
| Realistic WASM bundle size? | The base engine compiles to a **~10–30 MB `.wasm`** plus a multi-MB `.data` game pack. Stream/compress + cache immutably. |

## 1. Architecture of Luanti

Luanti is a **C++ application** split into:

- **`src/client`** — the game client: input, camera, HUD, particle effects,
  sound, and the **mesh/chunk renderer**.
- **`src/server`** — a **single-threaded, deterministic** block/world simulator
  plus Lua modding via a Lua VM. Player state, world chunks, and physics
  authority live here.
- **`src/script`** — Lua bindings (LuaJIT / luajit).
- Shared/portable code uses **CMake** and a long list of third-party libs
  (IrrlichtMT for rendering, **SQLite** for worlds/mod storage, **zlib**,
  **libcurl** for content download, **OpenAL** for audio, **jsoncpp**, etc.).

### Client-server model

It is a classic **authoritative server** model over **UDP** (a custom
protocol on top of ENet-style reliable/unreliable channels). The client sends
player + input packets; the server sends world/entity/chat packets.

> **Consequence for the browser:** Emscripten cannot open raw UDP sockets. The
> WASM community ports therefore tunnel the **real UDP over a WebSocket /
> WebTransport proxy** (see `docs/WASM_BUILD.md`). On *Vercel*, you can serve the
> client but must host the **proxy + server elsewhere** (a small VPS, Fly.io, or
> a WebSocket-capable host).

## 2. WebAssembly / Emscripten feasibility

Compiling the **client** to WASM is the proven path (the community ports do it).
Blockers that had to be solved there — and are **already solved upstream**:

1. **Rendering.** Irrlicht's OpenGL 1.x driver doesn't map to WebGL directly.
   The port uses Emscripten's GL context and patched shaders to get a
   WebGL-backed renderer. (The forum lore about "Irrlicht doesn't work with
   Emscripten" refers to the stock renderer; the WASM fork patched it.)
2. **Networking.** Raw sockets → **WebSocket proxy** of the UDP stream.
3. **Threading.** Luanti historically ran the client mostly single-threaded;
   WASM threads (`-pthread` + SharedArrayBuffer) need **COOP/COEP** headers —
   exactly what `vercel.json` sets.
4. **File system.** `EMSCRIPTEN_FILESYSTEM` / a `.data` image for games, world
   config, and textures.
5. **SQLite.** Compiles under Emscripten; the port stores worlds in-browser
   (IndexedDB-backed virtual FS in `Kaesual`'s fork) instead of real disk.

### Emscripten flags for a game engine (what the build uses)

```
-Os -Oz                     # size-optimised
-s WASM=1
-s ALLOW_MEMORY_GROWTH=1
-s MAXIMUM_MEMORY=...       # bounded heap
-s USE_SDL=2 (or GL)        # depends on the backend
-s FETCH=1 / -lwebsocket.js # asset + network
-s ASYNCIFY                  # if the code uses blocking I/O
--preload-file ...           # game pack
```

See `docs/WASM_BUILD.md`.

## 3. Mobile bottlenecks & mitigations

| Bottleneck | Why | Mitigation (implemented / recommended) |
| --- | --- | --- |
| Draw calls | Per-node meshes → thousands of calls | Batching, chunk meshing, texture atlasing |
| Overdraw / fragment cost | Large trimmed textures, alpha weather | Reduced texture resolution, no AA on low tier |
| Memory (textures) | Full-size textures blow mobile GPU budgets | ASTC/Basis compression, mipmapping, streaming |
| Chunk streaming | World gen floods the main thread | Distance-limited loading/unloading, worker-based gen |
| Input latency | JS↔WASM boundary + React re-renders | **Single-frame snapshot, no per-move React render** (`src/lib/inputHandler.ts`) |
| Touch accuracy | Small targets, gesture hijacking | `touch-action:none`, large targets, deadzone, safe-area |

## 4. Vercel suitability

**What works great on Vercel:**
- Static serving of the Next.js app + WASM assets (CDN, immutable cache).
- Global edge, no server ops, free tier.
- PWA + headers config.

**What Vercel cannot do (for this project):**
- **No WebSocket / persistent connections** on Serverless/Edge functions
  (max execution time, stateless, no live sockets). Confirmed by Vercel docs:
  `vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections`.
- **No long-running server loop** (game server must hold world state in memory).
- No raw TCP/UDP (needed for the Luanti protocol unless tunnelled).

**Recommended topology:**
```
Vercel ── serves ──> Next.js app (client + virtual controls)
                        │  (WASM engine in the browser)
                        ▼
Clients <── WebSocket/WebTransport tunnel ──> Proxy/Room server (Fly.io/VPS)
                                                    │
                                                    ▼
                                          Luanti game server (dedicated)
```

This is why `vercel.json` only configures the **frontend** (headers, rewrites,
static cache) and this repo ships the **client wrapper**; the game server itself
lives off-Vercel.

## 5. Answers to "Questions to investigate"

1. **Does Luanti have an existing web build?** No official one; yes, a
   community WASM port (`paradust7/luanti-wasm`; `Kaesual/minetest-wasm` fork
   adds a Next.js loader, in-browser save sync, loadable game packs, and p2p
   play via a UDP-over-WebSocket proxy).
2. **Rendering engine?** IrrlichtMT (a fork of Irrlicht). It needs patching for
   WebGL under Emscripten — this is already done in the community port.
3. **Server-side?** Authoritative **dedicated server** (or p2p when the server
   is another browser via the proxy). Vercel cannot host it.
4. **Licence compatibility?** Engine **LGPL-2.1-or-later**; wrapper **MIT**.
   Keep them separate; distribute LGPL source/modification rights. (NOTICE)
5. **Community mods?** The Lua mod system runs in the client/server build; the
   WASM port loads `mod_storage.sqlite` and content. Not all native external
   mods (C++ mods) work under WASM, but Lua mods largely do.
6. **Realistic WASM bundle size?** ~10–30 MB engine + multi-MB data. With
   gzip/brotli, streaming, and immutable caching it's workable; still a
   hard floor above the "<3s on 4G" target unless you lazy-partition it.

## 6. Bottom line

A **full, vendor-grade re-port of Luanti to pure WASM in this session is not
feasible** (toolchain, renderer patching, engine size). The sensible, honest
deliverable — which this repo implements — is:

1. A **clean, mobile-optimised frontend** (virtual controls, adaptive quality,
   PWA) that boots the engine;
2. A **seam** (`src/lib/wasmLoader.ts`) that loads the **real** engine when the
   community-built WASM artifacts are present, and a **demo fallback** otherwise;
3. Correct **Vercel configuration** (headers, static asset strategy, PWA);
4. The **build pipeline** (`scripts/build-luanti-wasm.sh`) to obtain the real
   engine and drop it in;
5. Honest **documentation** of what Vercel can and cannot hold.
