"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { usePWA } from "@/hooks/usePWA";
import VirtualControls from "@/components/VirtualControls";
import LoadingScreen from "@/components/LoadingScreen";
import PerformanceMonitor from "@/components/PerformanceMonitor";

export default function Home() {
  const { surfaceRef, canvasRef, handlerRef, state, start, cycleQuality } = useGameEngine({
    autoStart: false,
    scriptUrl: "/luanti.js",
  });
  const { canInstall, install, isStandalone, installed } = usePWA();

  const [audioHint, setAudioHint] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);

  // Detect touch device to tune the loading hint.
  useEffect(() => {
    setCoarse(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  // Surface boot errors to the UI.
  useEffect(() => {
    if (state.status === "error") setError(state.error ?? "Unknown engine error");
  }, [state.status, state.error]);

  // Show the install card for touch devices that aren't standalone.
  useEffect(() => {
    if (canInstall && coarse && !installed && !isStandalone && state.status !== "idle") {
      const t = setTimeout(() => setShowInstall(true), 2500);
      return () => clearTimeout(t);
    }
    setShowInstall(false);
  }, [canInstall, coarse, installed, isStandalone, state.status]);

  const ready = state.status === "ready" || state.status === "error";

  const onStart = useCallback(() => {
    // First user gesture unlocks audio/fullscreen on mobile.
    setAudioHint(true);
    start();
  }, [start]);

  return (
    <main>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div ref={surfaceRef} className="game-surface" onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvasRef} className="game-canvas" />

        {/* HUD that survives touch (pointer-events handled per-element) */}
        {ready && (
          <PerformanceMonitor
            fps={state.fps}
            tier={state.tier}
            usingDemo={state.usingDemo}
            onCycleQuality={cycleQuality}
          />
        )}

        {/* Virtual controls */}
        <VirtualControls
          handlerRef={handlerRef}
          enabled={ready}
          onSprintChange={(on) => {
            if (on) setAudioHint((v) => v);
          }}
        />

        {showInstall && canInstall && (
          <div className="install-card">
            <b>Install Luanti</b>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
              Add to your home screen for fullscreen play.
            </div>
            <div className="actions">
              <button onClick={install}>Install</button>
              <button onClick={() => setShowInstall(false)}>Later</button>
            </div>
          </div>
        )}

        {/* Loading / start overlay */}
        <LoadingScreen
          status={state.status}
          progress={state.progress}
          visible={state.status === "idle" || state.status === "loading" || state.status === "error"}
          onStart={onStart}
        />

        {error && (
          <div className="install-card" style={{ bottom: "auto", top: "50%", transform: "translate(-50%,-50%)" }}>
            <b>Engine failed to load</b>
            <div style={{ fontSize: 13, opacity: 0.8, overflowWrap: "anywhere", marginTop: 6 }}>{error}</div>
            <div className="actions">
              <button onClick={() => location.reload()}>Reload</button>
              <button onClick={() => setError(null)}>Ignore</button>
            </div>
          </div>
        )}

        <noscript>
          <div className="noscript">
            <p>This game needs JavaScript enabled.</p>
          </div>
        </noscript>
      </div>
    </main>
  );
}
