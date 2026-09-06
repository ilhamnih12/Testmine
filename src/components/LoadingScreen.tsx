"use client";

import type { EngineStatus } from "@/lib/wasmLoader";

interface Props {
  status: EngineStatus;
  progress: number;
  visible: boolean;
  onStart?: () => void;
}

/**
 * Covers the surface while the engine (or fallback) is booting. In "idle"
 * state it acts as the start menu; once loading begins it shows a progress bar
 * tuned for the 3-second initial-load target.
 */
export default function LoadingScreen({ status, progress, visible, onStart }: Props) {
  const pct = Math.round(progress * 100);

  return (
    <div className={`loading-overlay${visible ? "" : " hidden"}`}>
      <div className="loading-title">Luanti</div>
      <div className="loading-sub">Mobile Web · WASM</div>

      {status === "idle" && (
        <button className="chip" onClick={onStart} style={{ fontSize: 15, padding: "10px 22px" }}>
          ▶ Play
        </button>
      )}

      {(status === "loading" || status === "ready") && (
        <div className="loading-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {status === "loading" && <div className="loading-hint">Loading engine… {pct}%</div>}
      {status === "error" && <div className="loading-hint" style={{ color: "#ff8a7a" }}>Failed to load the engine.</div>}
      {status === "ready" && <div className="loading-hint">Tap to begin. Controls fade when idle.</div>}
    </div>
  );
}
