# Luanti Web — Main Luanti (Minetest) Asli di Browser

Luanti (sebelumnya Minetest) **asli** — engine voxel C++ — berjalan 100% di
browser via WebAssembly. Fokus **singleplayer**, **tanpa backend apa pun**,
dioptimalkan untuk mobile, siap deploy ke **Vercel**.

> **Penting:** ini bukan demo 2D dan bukan emulasi. Yang berjalan adalah
> client Luanti sungguhan (C++ → WebAssembly oleh komunitas), lengkap dengan
> menu utama, world generation, physics, inventory, touch controls, dan
> penyimpanan world di browser. Server singleplayer berjalan **di dalam
> browser** (in-process), jadi tidak butuh server/backend — persis seperti
> singleplayer Luanti native.

## Bagaimana ini bekerja

```
┌─────────────────────────── situs ini (Vercel) ───────────────────────────┐
│  /            landing page: pilihan mirror, bahasa, panduan, PWA         │
│  /play        full-screen host → iframe ke engine                        │
│  /engine/*    (opsional) engine self-hosted, same-origin                 │
└──────────────────────────────────────────────────────────────────────────┘
                │ iframe (browser-mu yang memuat engine)
                ▼
┌──────────────────────── engine Luanti WASM ───────────────────────────────┐
│  Launcher: pilih game (VoxeLibre/Minetest Game/...), storage, Start      │
│  Runtime: minetest.wasm (pthreads/SharedArrayBuffer), WebGL2, audio      │
│  Singleplayer: dedicated server lokal IN-PROCESS di browser              │
│  World:  tersimpan di IndexedDB/OPFS browser (backup/restore zip)        │
└──────────────────────────────────────────────────────────────────────────┘
```

Engine dimuat dari salah satu sumber (otomatis):

1. **Self-hosted** (paling andal & offline) — hasil
   `npm run download-engine` di `/public/engine`. Semua asset same-origin.
2. **Mirror publik komunitas** (default, tanpa setup apa pun):
   - **Common Ground** — build 5.9, launcher paling lengkap
     (`https://embed.commonground.cg/standalone/minetest/`)
   - **Dustlabs (paradust)** — build 5.14+ eksperimental
     (`https://luanti.dustlabs.io/`)

Keduanya adalah deploy resmi repositori port WASM:
[paradust7/luanti-wasm](https://github.com/paradust7/luanti-wasm) dan
fork [Kaesual/minetest-wasm](https://github.com/Kaesual/minetest-wasm).

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:3000
```

Buka → **Main Sekarang** → di layar launcher engine: *Start Game* (pilih
game + storage “Save worlds in browser”) → di menu Luanti: *Singleplayer* →
buat world. Selesai.

Opsional — self-host engine (butuh internet; ±100–300 MB):

```bash
npm run download-engine                  # mirror default (Common Ground)
npm run download-engine -- --mirror=dustlabs
```

## Deploy ke Vercel

Push repo → import di Vercel (framework Next.js, build `npm run build`).
Atau:

```bash
npx vercel --prod
```

Yang perlu diperhatikan (sudah di-set di repo ini):

- **Header COOP/COEP** untuk `SharedArrayBuffer` (pthreads engine) diberikan
  oleh `middleware.ts`:
  - `/play` → `Cross-Origin-Opener-Policy: same-origin` (tanpa COEP, agar
    iframe mirror cross-origin tidak terblokir).
  - `/engine/*` → COOP + COEP `require-corp` + cache immutable
    (mode self-hosted).
- **Cache**: file engine immutable 1 tahun; `index.html`/`sw.js` no-cache.
- **Vercel build-time download** (opsional, agar produksi 100% self-hosted
  dan tidak bergantung mirror komunitas):
  ```json
  { "buildCommand": "node scripts/download-engine.mjs || true; npm run build" }
  ```
  di `vercel.json`. Mesin Vercel punya akses internet, sehingga engine
  terunduh saat build. `|| true` memastikan build tetap lanjut memakai mode
  mirror bila download gagal.

## Singleplayer: kenapa tidak butuh backend

Luanti native menjalankan dedicated server **in-process** saat singleplayer.
Build WASM mempertahankan perilaku ini: saat kamu menekan *Singleplayer →
Create world*, server berjalan di thread WASM di browser-mu. Tidak ada
koneksi keluar (kecuali kamu memilih bergabung ke server publik). World
disimpan di storage browser (IndexedDB/OPFS) — bisa di-backup sebagai zip
dari menu gear ⚙️ di kanan-atas dalam game.

> Multiplayer P2P (host/join via proxy WebSocket) memang didukung engine-nya,
> tapi di luar scope project ini — fokusnya singleplayer.

## Optimisasi mobile

- **Touch controls bawaan Luanti**: joystick virtual + tombol lompat muncul
  otomatis di device layar sentuh (sama seperti client Android).
- Viewport `100dvh` + safe-area inset, `user-scalable=no`, fullscreen API.
- PWA: install ke home screen, offline (untuk engine self-hosted + mirror
  yang pernah dimuat), icon/status bar gelap.
- Unduhan engine ter-cache permanen (`Cache-Control: immutable` + service
  worker) — hanya sekali besar.
- Tips in-game: turunkan *viewing range* (Settings → Graphics) bila berat.

## Batasan yang perlu diketahui (jujur)

- **iPhone butuh iOS 17+** (Safari harus mendukung SharedArrayBuffer).
  Landing page mendeteksi dan menampilkan peringatan.
- **Unduhan pertama besar** (±100–300 MB) — wajar untuk engine C++ penuh +
  game pack.
- **Mirror komunitas**: bila salah satu mirror down, ganti mirror di landing
  page, atau pakai mode self-hosted. URL mirror bisa diganti langsung di
  `src/lib/engine.ts`.
- Build WASM 5.9 (Common Ground) adalah rilis **5.9** — game tetap lengkap
  (VoxeLibre, dll.), tapi bukan Luanti terbaru (5.17). Mirror Dustlabs
  lebih baru namun masih work-in-progress.
- Performa di HP menengah: mainkan dengan *viewing range* kecil–sederhana;
  WASM tidak secepat native, tapi playable.

## Struktur project

```
app/
  layout.tsx            metadata PWA, viewport mobile
  page.tsx              landing page (bahasa Indonesia)
  play/page.tsx         host full-screen engine
  globals.css           semua gaya (landing + play)
src/
  lib/engine.ts         mirror, settings, deteksi self-host, device
  hooks/usePWA.ts       SW + install prompt + fullscreen
  components/EngineFrame.tsx   iframe + overlay + topbar auto-hide
middleware.ts           header COOP/COEP per path
scripts/download-engine.mjs    unduh engine → public/engine
public/
  engine/               (hasil download, git-ignored)
  manifest.json, sw.js, icons/, logo.svg, assets/
docs/                   riset & panduan teknis
vercel.json             cache headers + build
```

## Dokumentasi teknis

- [docs/TECHNICAL_FEASIBILITY.md](docs/TECHNICAL_FEASIBILITY.md) — riset:
  port WASM-nya ada, terbukti jalan, dan bagaimana kita mengintegrasikannya.
- [docs/WASM_BUILD.md](docs/WASM_BUILD.md) — cara self-host: download engine
  atau build sendiri via pipeline Emscripten.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — detail Vercel, header, PWA,
  troubleshooting.

## Lisensi & atribusi

- Wrapper: **MIT** (lihat [LICENSE](LICENSE)).
- Engine Luanti + build WASM: **LGPL-2.1-or-later** (lihat [NOTICE](NOTICE)).
