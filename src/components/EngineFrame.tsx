"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMirror, type EngineMirror } from "@/lib/engine";

interface EngineFrameProps {
  url: string;
  mode: "self-hosted" | "iframe" | "direct";
  mirror: EngineMirror | null;
  manifestVersion?: string;
}

/**
 * Hosts the real Luanti WASM client in a full-viewport iframe.
 *
 * The iframe document is the upstream launcher page — it brings its own
 * start screen, progress bars, in-game touch controls, settings cogwheel,
 * console, and (on desktop) keyboard/mouse binding. We only wrap it with a
 * thin auto-hiding top bar, a loading overlay, and an honest "open directly"
 * escape hatch in case the embed cannot start.
 */
export default function EngineFrame({ url, mode, mirror, manifestVersion }: EngineFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    setShowBar(true);
    if (barTimer.current) clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => setShowBar(false), 4000);
  }, []);

  useEffect(() => {
    setLoaded(false);
    setShowHint(false);
    wake();
    hintTimer.current = setTimeout(() => setShowHint(true), 15000);
    return () => {
      if (barTimer.current) clearTimeout(barTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [url, reloadKey, wake]);

  const onIframeLoad = useCallback(() => {
    setLoaded(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const onReload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const onFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      /* unsupported */
    }
  }, []);

  const sourceLabel =
    mode === "self-hosted"
      ? `Self-hosted${manifestVersion ? ` · ${manifestVersion}` : ""}`
      : mirror
        ? mirror.label
        : "Mirror publik";

  return (
    <div className="play-root">
      <iframe
        key={reloadKey}
        className="engine-frame"
        src={url}
        onLoad={onIframeLoad}
        title="Luanti (Minetest) — game berjalan di browser"
        allow="fullscreen; gamepad; autoplay; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Loading overlay — hides as soon as the launcher page has loaded.
          The engine's own progress UI (wasm + pack downloads) is shown by
          the launcher itself once it appears. */}
      <div className={`boot-overlay ${loaded ? "hidden" : ""}`}>
        <img src="/logo.svg" alt="" className="boot-logo" />
        <div className="boot-title">Memuat Luanti…</div>
        <div className="boot-sub">
          {loaded
            ? "Menyiapkan layar game…"
            : "Unduhan pertama bisa 100–300 MB — selanjutnya tersimpan di browser."}
        </div>
        <div className="boot-spinner" aria-hidden />
        {showHint && !loaded && (
          <div className="boot-hint">
            Butuh waktu lebih dari 15 detik?
            <br />
            <a href={url} target="_blank" rel="noreferrer">
              Buka halaman game langsung →
            </a>
          </div>
        )}
      </div>

      {/* Thin auto-hiding top bar. pointer-events only on the buttons so the
          game underneath keeps receiving touches. */}
      <div className={`topbar ${showBar ? "" : "topbar-hidden"}`}>
        <a className="topbar-btn" href="/" onClick={wake} aria-label="Kembali ke menu">
          ←
        </a>
        <span className="topbar-chip">{sourceLabel}</span>
        <span className="topbar-actions">
          <button className="topbar-btn" onClick={(e) => { onReload(); e.currentTarget.blur(); }} aria-label="Muat ulang game" title="Muat ulang">
            ⟳
          </button>
          <button className="topbar-btn" onClick={(e) => { void onFullscreen(); e.currentTarget.blur(); }} aria-label="Layar penuh" title="Layar penuh">
            ⛶
          </button>
        </span>
      </div>
    </div>
  );
}
