# Riset Teknis: Menjalankan Luanti Asli di Browser (diperbarui 2026-09-08)

## TL;DR

**Feasible — dan sudah terbukti jalan.** Ada port resmi-komunitas Luanti
(C++) ke WebAssembly/Emscripten yang masih dipelihara dan di-host publik.
Project ini mengintegrasikannya (bukan meniru/mendemokannya).

## Temuan riset (per 2026-09-08)

### 1. Port WASM: `paradust7/luanti-wasm`

- Repo: https://github.com/paradust7/luanti-wasm — **masih aktif**
  (push terakhir: 2026-09-08, hari ini).
- Luanti dikompilasi dengan Emscripten: `luanti.js` + `luanti.wasm`
  (+ `worker.js` untuk pthread).
- Arsitektur storage modern: **OPFS** (Origin Private File System) +
  pack zstd (`base.pack`, `certs.pack`) yang hanya diunduh saat berubah.
  World & config tersimpan persisten di browser.
- Mendukung **singleplayer in-browser** (server lokal in-process) dan
  network play via proxy WebSocket (emsocket) — proxy hanya dibutuhkan
  untuk multiplayer, bukan singleplayer.
- `setConf()` untuk preset konfigurasi (mis. `viewing_range` kecil agar
  hemat memori/jaringan di device lemah).
- Di-host di `https://luanti.dustlabs.io/` (build WIP, versi Luanti lebih
  baru — cabang merge menuju 5.14+).

### 2. Fork terpelihara: `Kaesual/minetest-wasm`

- Repo: https://github.com/Kaesual/minetest-wasm (fork dari paradust,
  +63 commit). Target: embed Luanti di platform Common Ground (app.cg).
- **Build 5.9** dengan game pack preloaded: **VoxeLibre 0.90.1** (default,
  Minecraft-like), Minetest Game, Glitch 1.3.2, Blockbomber, Mineclonia
  (rusak, LUA error).
- Launcher React modern: pilih game yang di-preload, bahasa (50+ bahasa,
  termasuk `id`), storage mode, **backup/restore world sebagai zip**,
  menu settings in-game (gear ⚙️), console.
- Standalone playable: `https://embed.commonground.cg/standalone/minetest/`
  — **designed untuk iframe embedding** (dokumentasi header ada di README).
- Layout rilis (dari `build_www.sh`):
  ```
  <root>/index.html  <root>/<assets>/…        (launcher)
  <root>/minetest/minetest.js|.wasm|.worker.js
  <root>/minetest/packs/{base,minetest_game,voxelibre,glitch,blockbomber,mineclonia}.pack
  ```
  Nama release dir fixed: `minetest/`.

### 3. Versi Luanti (konteks)

- Luanti terbaru per changelog resmi: **5.17.0** (2026-08-20), 5.16.1
  (2026-05), 5.15.0 (2026-01), 5.14.0 (2025-10-05).
- Build WASM: 5.9 (Common Ground) / 5.14+ WIP (Dustlabs). Game
  singleplayer tetap lengkap di 5.9.

### 4. Persyaratan browser

- **SharedArrayBuffer** (pthreads) → dokumen engine harus
  `Cross-Origin-Embedder-Policy: require-corp` +
  `Cross-Origin-Opener-Policy` (any) — cross-origin isolated.
  - Top-level: COOP `same-origin` + COEP cukup.
  - Iframe cross-origin: dokumen iframe harus COOP `cross-origin` + COEP;
    halaman induk **tidak boleh** men-set COEP (biar iframe tidak
    diwajibkan CORP/CORS).
- **WebGL2** untuk render.
- **iOS: Safari 17+** (SAB). Di bawah itu game tidak bisa start —
  dideteksi & diperingatkan di landing page.
- Audio butuh user gesture pertama (Start Game) — normal.

### 5. Mengapa Vercel tetap cocok

- Vercel meng-host **static + Next.js**: situs kita adalah wrapper
  (landing + host iframe) dan (opsional) engine self-hosted sebagai
  static file di `/public/engine`.
- Header COOP/COEP: di-set via `middleware.ts` (berlaku di dev & Vercel) —
  tidak perlu server khusus.
- Vercel **tidak** perlu menjalankan game server: singleplayer
  in-browser, persis desain yang diminta (tanpa backend).
- Build-time download: mesin build Vercel punya internet → engine bisa
  diunduh saat deploy (skrip `scripts/download-engine.mjs`).

## Keputusan arsitektur

| Opsi | Pro | Kontra | Keputusan |
|---|---|---|---|
| A. Build Luanti→WASM sendiri (Docker/Emscripten) | 100% control | Berjam-jam build, resource besar, rawan | ❌ |
| B. Proxy runtime file engine via serverless | Repo kecil, selalu terbaru | Tergantung function streaming & kuota | ❌ (simpel & andal lebih penting) |
| C. Iframe mirror publik + self-host opsional | Game asli langsung jalan, zero-setup, repo kecil, offline saat self-host | Tergantung mirror komunitas (mitigasi: 2 mirror + "buka langsung") | ✅ |

## Status integrasi

- [x] Landing page + host `/play` full-screen (mobile-first).
- [x] Iframe mirror (Common Ground default, Dustlabs alternatif) +
  top-level "buka langsung" fallback.
- [x] `middleware.ts`: COOP/COEP policy per path.
- [x] `scripts/download-engine.mjs`: self-host (diuji terhadap mock kedua
  layout rilis).
- [x] PWA (manifest, SW, icon), cache headers, safe-area, iOS-17 guard.
- [ ] (pengguna) Uji di device: iPhone iOS17+, Android, desktop.
