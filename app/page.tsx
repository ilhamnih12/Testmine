"use client";

import { useEffect, useMemo, useState } from "react";
import { usePWA } from "@/hooks/usePWA";
import {
  detectDevice,
  detectSelfHostedEngine,
  formatBytes,
  getMirror,
  loadSettings,
  MIRRORS,
  saveSettings,
  type PlaySettings,
} from "@/lib/engine";

const LANGUAGES: [string, string][] = [
  ["", "Otomatis (ikut browser)"],
  ["id", "Bahasa Indonesia"],
  ["en", "English"],
];

export default function Home() {
  const [settings, setSettings] = useState<PlaySettings>(() => loadSettings());
  const [selfHosted, setSelfHosted] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const { canInstall, install, isStandalone } = usePWA();
  const device = useMemo(() => detectDevice(), []);

  useEffect(() => {
    setMounted(true);
    void detectSelfHostedEngine().then((m) => setSelfHosted(m !== null));
  }, []);

  const update = (patch: Partial<PlaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const mirror = getMirror(settings.mirror);
  const engineSource =
    selfHosted === null
      ? "memeriksa…"
      : selfHosted
        ? "self-hosted (file engine ada di situs ini)"
        : `mirror publik — ${mirror.label}`;

  return (
    <main className="landing">
      <header className="landing-header">
        <img src="/logo.svg" alt="Logo Luanti" className="brand-logo" />
        <div>
          <h1 className="brand-title">Luanti Web</h1>
          <div className="brand-sub">
            Engine voxel Luanti (Minetest) sungguhan — 100% di browser
          </div>
        </div>
      </header>

      {device.sabBlocked && (
        <div className="card warn">
          <b>iPhone perlu iOS 17 atau lebih baru.</b>
          <p>
            Browser versi game ini memakai WebAssembly threads (SharedArrayBuffer),
            yang baru didukung Safari 17. Upgrade iOS-nya, atau main lewat
            Android/desktop.
          </p>
        </div>
      )}

      <section className="hero">
        <div className="hero-shot">
          <img
            src="/assets/screenshot.webp"
            alt="Tangkapan layar game Luanti"
            loading="eager"
          />
        </div>
        <h2 className="hero-title">Main singleplayer, tanpa backend apa pun.</h2>
        <p className="hero-copy">
          Ini bukan demo — yang berjalan adalah client <b>Luanti asli</b> (C++
          yang dikompilasi ke WebAssembly). World singleplayer dibuat dan disimpan
          langsung di browser-mu (IndexedDB), jadi tidak butuh server atau akun.
        </p>
        <div className="hero-actions">
          <a href="/play" className="btn btn-primary btn-big">
            ▶ Main Sekarang
          </a>
          {canInstall && !isStandalone && (
            <button className="btn btn-big" onClick={() => void install()}>
              ⬇ Install (PWA)
            </button>
          )}
        </div>
        <div className="engine-source">
          Sumber engine: <b>{engineSource}</b>
        </div>
      </section>

      <section className="card">
        <h3>Pengaturan sebelum main</h3>
        <label className="field">
          <span>Game (dipilih di layar start game)</span>
          <div className="hint-inline">
            Rekomendasi: <b>VoxeLibre</b> (gaya Minecraft, paling lengkap) atau{" "}
            <b>Minetest Game</b> (klasik, ringan).
          </div>
        </label>
        <label className="field">
          <span>Bahasa in-game</span>
          <select
            value={settings.lang}
            onChange={(e) => update({ lang: e.target.value })}
          >
            {LANGUAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sumber engine</span>
          <select
            value={settings.mirror}
            onChange={(e) => update({ mirror: e.target.value })}
            disabled={selfHosted === true}
          >
            {MIRRORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.version}
              </option>
            ))}
          </select>
          <div className="hint-inline">
            {selfHosted
              ? "Engine ter-self-host di situs ini — paling cepat & offline."
              : `${mirror.description} ${mirror.credit ? `(${mirror.credit})` : ""}`}
          </div>
        </label>
        <a href="/play" className="btn btn-primary">
          Buka Game →
        </a>
      </section>

      <section className="card">
        <h3>Cara main (3 langkah)</h3>
        <ol className="steps">
          <li>
            <b>Start Game</b> — di layar start, pastikan storage{" "}
            <i>“Save worlds in browser”</i>, lalu tekan <b>Start Game</b>.
          </li>
          <li>
            <b>Singleplayer</b> — di menu utama Luanti, pilih{" "}
            <i>Singleplayer</i> → buat world baru (game: VoxeLibre/Minetest
            Game). Server lokal berjalan di dalam browser, tanpa internet tetap
            dan tanpa backend.
          </li>
          <li>
            <b>Simpan</b> — sebelum menutup, buka menu (ESC / tombol menu) →{" "}
            <i>Main menu</i>, lalu ikon gerigi kanan-atas → <b>Sync</b> supaya
            world tersimpan permanen. Bisa di-backup sebagai zip.
          </li>
        </ol>
      </section>

      <section className="card">
        <h3>Kontrol</h3>
        <div className="controls-grid">
          <div>
            <h4>📱 HP / tablet (touch)</h4>
            <ul>
              <li>Joystick virtual &amp; tombol lompat muncul otomatis</li>
              <li>Geser layar = putar kamera</li>
              <li>Ketuk blok = hancurkan / pasang</li>
              <li>Gerigi kanan-atas = settings &amp; sync world</li>
            </ul>
          </div>
          <div>
            <h4>⌨ Desktop</h4>
            <ul>
              <li>WASD gerak · Spasi lompat · Shift jongkok</li>
              <li>Mata = kamera · klik kiri hancurkan · klik kanan pasang</li>
              <li>1–8 hotbar · I inventori · C kamera · T/Esc console/menu</li>
              <li>+ / − jarak pandang</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Yang perlu diketahui</h3>
        <ul className="notes">
          <li>
            <b>Unduhan pertama besar</b> (±100–300 MB: engine + game pack),
            lalu ter-cache di browser. Install PWA-nya supaya makin ringan
            diakses.
          </li>
          <li>
            <b>Browser modern</b> (Chrome/Edge/Firefox 2023+, Safari 17+).
            Butuh WebGL2.
          </li>
          <li>
            <b>Mirror publik</b> di-host komunitas (Common Ground / Dustlabs).
            Kalau mirror-nya sedang down, coba mirror lain — atau self-host
            engine sendiri (lihat <code>docs/WASM_BUILD.md</code>).
          </li>
          <li>
            <b>Performa di HP menengah</b>: turunkan <i>viewing range</i> di
            Settings in-game kalau terasa berat.
          </li>
        </ul>
      </section>

      {selfHosted === true && (
        <section className="card good">
          <h3>Mode self-hosted aktif</h3>
          <p>
            Engine Luanti tersimpan di <code>/public/engine</code> situs ini.
            Semua asset dimuat same-origin &amp; bisa offline.{" "}
            <code>npm run download-engine</code> dipakai untuk memperbaruinya.
          </p>
        </section>
      )}

      <footer className="landing-footer">
        <p>
          Dibuat untuk main singleplayer — tanpa backend. Engine Luanti
          (LGPL-2.1): © Luanti project · Port WebAssembly:{" "}
          <a href="https://github.com/paradust7/luanti-wasm" target="_blank" rel="noreferrer">
            paradust7/luanti-wasm
          </a>{" "}
          &amp;{" "}
          <a href="https://github.com/Kaesual/minetest-wasm" target="_blank" rel="noreferrer">
            Kaesual/minetest-wasm
          </a>{" "}
          · Game default: <b>VoxeLibre</b> (LGPL).
        </p>
        {selfHosted === true && (
          <p className="footer-meta">
            {engineSource} · <a href="/">home</a> · <a href="/play">play</a>
          </p>
        )}
      </footer>
    </main>
  );
}
