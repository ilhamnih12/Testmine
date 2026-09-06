# Building the Luanti (Minetest) .wasm engine

Luanti has **no official WASM target**. The de-facto pipeline is the community
`paradust7/luanti-wasm` repo, modernised in `Kaesual/minetest-wasm`. This guide
covers both the "use the existing pipeline" path (recommended) and the
"do it yourself with Emscripten" path for people who want to maintain the fork.

## Option A — use the maintained upstream pipeline (recommended)

Everything is Dockerised so you don't install Emscripten by hand.

```bash
git clone https://github.com/Kaesual/minetest-wasm.git
cd minetest-wasm
./build_all_with_docker.sh
```

Output lands in `www/`. Then stage the artifacts into this project:

```bash
chmod +x scripts/build-luanti-wasm.sh
./scripts/build-luanti-wasm.sh   # clones upstream, runs the docker build, copies to /public
```

The script copies `luanti.js`, `luanti.wasm`, `luanti.data` (and any
`games/*`) into `public/`. Restart the dev server and the wrapper loads the real
engine instead of the demo (the `demo` chip disappears).

### Headers you must serve with the engine

Emscripten + `-pthread`/SharedArrayBuffer require these (already in `vercel.json`):

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

> The Kaesual fork additionally needs
> `Cross-Origin-Resource-Policy: same-origin` for cross-origin iframe embedding;
> this repo sets it globally.

## Option B — build Emscripten yourself

If you want to maintain the engine build (e.g. bump to the latest Luanti):

### 1. Install Emscripten

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### 2. Patch Luanti for WASM/WebGL

The stock renderer does not map to WebGL. You need the patch set from the
upstream WASM fork. Key patches/topics:

- **Rendering backend.** Replace Irrlicht's OpenGL calls with an emulated
  GL context (Emscripten `-s USE_WEBGL`); update shaders so they are
  WebGL1/WebGL2-compatible.
- **Networking.** Wrap the UDP socket layer with `-lwebsocket.js` / a
  WebSocket proxy so `connect()`/`send()`/`recv()` resolve to the WS tunnel.
- **File system.** Use `-s FORCE_FILESYSTEM=1` + `--preload-file` for the game
  pack and `EMSCRIPTEN_FILESYSTEM` for writable world/config (or a custom
  IndexedDB-backed FS in newer forks).
- **Audio.** Map OpenAL → Web Audio (`-s USE_OPENAL`, or emscripten's
  `OpenAL`/`SDL_sound` shim).
- **Threading.** Luanti's worldgen may benefit from `-s USE_PTHREADS=1` +
  `-s PTHREAD_POOL_SIZE`. Requires COOP/COEP.

### 3. Build

```bash
mkdir build && cd build
emcmake cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_CLIENT=ON -DBUILD_SERVER=OFF \
  -DBUILD_UNITTESTS=OFF \
  -DENABLE_CURL=ON -DENABLE_GETTEXT=OFF \
  -DENABLE_LUAJIT=ON -DENABLE_SOUND=ON \
  -DCMAKE_EXE_LINKER_FLAGS="-s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=1073741824 -s EXIT_RUNTIME=0 -s WASM=1 -O3"
emmake make -j"$(nproc)" minetest
```

Then create the `.data` image:

```bash
python3 tools/convert.py mkfs luanti.data ../games/  # example; see upstream tools
```

Rename the output to `luanti.js` + `luanti.wasm` and drop into `public/`.

### 4. Emscripten flags reference

| Flag | Effect |
| --- | --- |
| `-Os`/`-Oz` | Size optimisation (smaller binary, slightly slower) |
| `-O3` | Speed (larger binary) — use for the hot render/create loop |
| `-s ALLOW_MEMORY_GROWTH=1` | Let the heap grow (mobile memory is constrained; set a MAXIMUM_MEMORY cap) |
| `-s MAXIMUM_MEMORY=...` | Hard memory budget to avoid OOM tab kills |
| `-s USE_PTHREADS=1` | Worker threads for worldgen — needs COOP/COEP |
| `-s ASYNCIFY=1` | Allows blocking-style calls (I/O) in async WASM |
| `-s FETCH=1` | Emscripten streaming fetch for assets/CDN |
| `-s WASM_BIGINT=1` | int64 interop |
| `-s MODULARIZE=1 -s EXPORT_NAME=createLuanti` | Wrap the module so we control instantiation |
| `--preload-file <dir>` | Bundle the game pack + default config into `.data` |

## Caching & delivery strategy (Vercel)

- Serve `.wasm`/`.data` as **immutable** (`Cache-Control: max-age=31536000,
  immutable` — already in `vercel.json`).
- **gzip/brotli** the `.wasm`/`.data` (Vercel does this automatically for text,
  and supports precompressed `.br`/`.gz` for wasm if you generate them).
- **Streaming compile** (Chromium) kicks in when `Content-Type:
  application/wasm` is set and the module is instantiated via `fetch` + compile;
  the loader should use `WebAssembly.instantiateStreaming`.
- Keep the engine as a **separate chunk** so the initial HTML/JS shell stays
  small (the shell here is ~94 kB).

## Version pinning

The Kaesual fork currently pins **Luanti 5.9**; `paradust7` has begun moving to
the latest. If you need a specific Luanti release, build from that tag with
Option B and keep the patch set in your own fork. Record the Luanti version in
the loader so cache-busting `/public/luanti-<hash>.js` works.
