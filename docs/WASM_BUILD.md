# Self-Hosting & Membangun Engine WASM

Engine (client Luanti yang dikompilasi ke WebAssembly) **tidak** dikommit ke
repo — ukurannya 100–300 MB. Ada dua cara menampankannya.

## Cara 1 (disarankan): download engine yang sudah di-build

Build komunitas sudah tersedia. Skrip di repo ini mengunduh seluruh rilis
ke `/public/engine` (git-ignored) dan menulis `manifest.json`:

```bash
npm run download-engine                     # Common Ground (Luanti 5.9, default)
npm run download-engine -- --mirror=dustlabs # Dustlabs (5.14+, WIP)
npm run download-engine -- --base=https://host/path/   # custom host
npm run download-engine -- --out=public/engine
```

Skrip:
1. Mengambil `index.html` launcher,
2. Menyelesaikan nama release directory dari `src` script launcher
   (`minetest/` pada build Common Ground; UUID acak pada build Dustlabs),
3. Mengunduh semua asset yang direferensikan + file engine & pack yang
   dikenal (404 di-skip, aman antar-versi),
4. Validasi (`index.html` + `.wasm` ≥ 1 MB ada), lalu menulis manifest.

Setelah itu situs otomatis memakai **mode self-hosted** (deteksi
`/engine/manifest.json`): game dimuat same-origin, bisa offline (PWA),
tanpa ketergantungan runtime ke mirror komunitas.

### Memakai saat Vercel build

Mesin build Vercel punya internet. Tambahkan di `vercel.json`:

```json
"buildCommand": "node scripts/download-engine.mjs || true; npm run build"
```

(`|| true` → bila gagal, deploy tetap jalan dengan mode mirror.)

## Cara 2: build engine sendiri (power user)

Pipeline resmi: [Kaesual/minetest-wasm](https://github.com/Kaesual/minetest-wasm)
(atau upstream [paradust7/luanti-wasm](https://github.com/paradust7/luanti-wasm)).

Persyaratan: Linux, Docker, beberapa GB disk, 1–3 jam build.

```bash
git clone https://github.com/Kaesual/minetest-wasm
cd minetest-wasm
./build_all_with_docker.sh   # build Luanti + deps via Emscripten (Docker)
# hasil: www/ (launcher + minetest/{minetest.js,minetest.wasm,packs/})
```

Lalu:

```bash
# tunjuk skrip downloader ke server statis yang menyajikan www/
node scripts/download-engine.mjs --base=http://127.0.0.1:8080/ --out=public/engine
```

Catatan teknis pipeline:
- Emscripten di-patch untuk WebGL2, WASMFS/OPFS, file packager.
- Dependency yang dibangun: libpng, libjpeg, freetype2, sqlite3, zstd,
  libarchive, curl+openssl (untuk contentdb), xterm.js (server-only UI).
- `base.pack` = filesystem root engine (data core); pack game = content
  (VoxeLibre dsb.) sebagai `.tar.zst` — diunduh sekali, di-cache.

## Kenapa tidak langsung build di Vercel?

- Build Emscripten butuh Docker + jam-jam CPU — melampaui batas build
  Vercel (default 10 menit, maks 60 menit Pro).
- Hasil build deterministik per rilis: lebih hemat unduh saja.
