"use client";

import type { QualityTier } from "@/lib/types";

interface Props {
  fps: number;
  tier: QualityTier;
  usingDemo: boolean;
  onCycleQuality: () => void;
}

function fpsClass(fps: number): string {
  if (fps >= 55) return "good";
  if (fps >= 30) return "warn";
  return "bad";
}

/** Small always-on HUD chips: live FPS + adaptive quality tier (tap to change). */
export default function PerformanceMonitor({ fps, tier, usingDemo, onCycleQuality }: Props) {
  return (
    <div className="hud">
      <span className={`chip mono ${fpsClass(fps)}`}>{Math.round(fps)} fps</span>
      <span className="chip" onClick={onCycleQuality} title="Tap to change quality tier">
        ▦ {tier}
      </span>
      {usingDemo && (
        <span className="chip" title="No Luanti WASM binary found — running the built-in demo">
          demo
        </span>
      )}
    </div>
  );
}
