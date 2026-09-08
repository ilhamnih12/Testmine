# Deployment (Vercel) & Troubleshooting

## Deploy

1. Push repo → [vercel.com](https://vercel.com) → *Import Project*
   (framework Next.js terdeteksi, build command `npm run build`).
2. (Opsional) self-host engine saat build — edit `vercel.json`:
   ```json
   "buildCommand": "node scripts/download-engine.mjs || true; npm run build"
   ```
3. Deploy. Uji: landing → *Main Sekarang* → Start Game → Singleplayer.

## Header (sumber kebenaran: `middleware.ts`)

| Path | Header | Alasan |
|---|---|---|
| `/play` | `Cross-Origin-Opener-Policy: same-origin` | Memisahkan context game; **tanpa COEP** agar iframe mirror cross-origin tidak terblokir |
| `/engine/index.html` | COOP + COEP `require-corp`, no-cache | Dokumen engine (self-hosted) harus cross-origin isolated (SAB) |
| `/engine/*` (lainnya) | COOP + COEP + CORP, immutable 1 th | Asset engine: wasm/pack/js — cache selamanya |
| `/sw.js`, `/manifest.json` | no-cache | PWA harus selalu terbaru |

Catatan penting:
- Mode mirror: header milik **dokumen mirror** (ditetapkan host mereka —
  Common Ground menyediakan konfigurasi COOP/COEP untuk embed iframe,
  lihat README Kaesual/minetest-wasm).
- Jangan menambah `Cross-Origin-Embedder-Policy` di `/play` — akan
  memblokir dokumen mirror yang tidak mengirim CORP.

## Cache

- `vercel.json`: `/engine/(*)` immutable 1 tahun, assets 30 hari.
- Service worker: navigasi network-first; asset immutable cache-first.
- World game TIDAK disimpan di cache ini — world hidup di IndexedDB/OPFS
  browser (kelola via menu gear ⚙️ in-game: Sync / Backup zip / Restore).

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Game tidak start, konsol: `SharedArrayBuffer is not defined` | Dokumen engine tidak cross-origin isolated. Mode mirror: mirror berubah header (coba mirror lain / "buka langsung"). Mode self-hosted: pastikan `middleware.ts` aktif (di dev Next.js & Vercel otomatis). |
| Iframe mirror blank / error | Mirror down, atau browser memblokir. Klik "buka halaman game langsung" (top-level navigation selalu bekerja), ganti mirror, atau self-host. |
| iPhone: game tidak start | iOS < 17 tidak mendukung SAB. Upgrade iOS (landing page menampilkan peringatan otomatis). |
| Loading lama sekali pertama kali | Normal: 100–300 MB. Pastikan connection stabil; setelah cache, mulai cepat. |
| FPS rendah di HP | Settings in-game → Graphics: turunkan *viewing range* (60–80), matikan *shadows*. |
| World hilang setelah reload | Belum di-Sync: menu (ESC) → Main menu → gear ⚙️ → Sync. Atau storage mode "No Storage" dipilih. |
| Build Vercel gagal di download engine | `|| true` membuatnya non-fatal; cek log; biasanya network mirror sedang gangguan. |

## Checklist QA (device)

- [ ] Android (Chrome): touch joystick + lompat muncul; break/place blok.
- [ ] iPhone (Safari 17+): sama; tes landscape/portrait.
- [ ] Desktop: WASD + mouse; hotbar 1–8; F3/console.
- [ ] Reload mid-game: world tetap (setelah Sync).
- [ ] PWA install → tampil standalone, icon benar.
- [ ] Ganti mirror di landing → `/play` memakai mirror baru.
- [ ] (self-host) `npm run download-engine` → chip "Self-hosted" muncul.
