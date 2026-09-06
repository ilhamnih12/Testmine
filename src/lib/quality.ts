/**
 * Adaptive quality controller.
 *
 * Measures a rolling frame time and nudges the renderer's quality tier based on
 * the target FPS. This is the client-side "adaptive quality" loop described in
 * the brief: if FPS drops below threshold we shed load (shorter draw distance,
 * fewer particles, lower resolution); if headroom exists we reclaim it.
 */
import type { QualityTier } from "./types";

export interface QualityCallbacks {
  onTierChange(tier: QualityTier): void;
  applyQuality(tier: QualityTier): void;
}

export interface QualityMetrics {
  fps: number;
  frameMs: number;
  tier: QualityTier;
}

export class AdaptiveQualityController {
  private frames: number[] = [];
  private lastTime = 0;
  private tier: QualityTier = "high";
  private lastAdjust = 0;
  private readonly maxFrames = 90; // ~1.5s window at 60fps
  private cooldownMs = 2000;

  constructor(private callbacks: QualityCallbacks, initial: QualityTier = "high") {
    this.tier = initial;
    this.callbacks.applyQuality(initial);
  }

  /** Feed one frame duration (ms). Returns updated metrics. */
  tick(nowMs: number): QualityMetrics {
    const dt = nowMs - this.lastTime;
    this.lastTime = nowMs;
    if (dt > 0 && dt < 500) {
      this.frames.push(dt);
      if (this.frames.length > this.maxFrames) this.frames.shift();
    }
    const fps = this.frames.length
      ? 1000 / (this.frames.reduce((a, b) => a + b, 0) / this.frames.length)
      : 60;

    // Adjust at most every `cooldownMs`.
    if (nowMs - this.lastAdjust > this.cooldownMs && this.frames.length >= 30) {
      this.lastAdjust = nowMs;
      const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
      const next = this.computeTier(avg);
      if (next !== this.tier) {
        this.tier = next;
        this.callbacks.onTierChange(this.tier);
        this.callbacks.applyQuality(this.tier);
        this.frames.length = 0;
      }
    }

    return { fps, frameMs: dt, tier: this.tier };
  }

  /** Manually force a tier (e.g. user taps the HUD chip). */
  force(tier: QualityTier): QualityTier {
    this.tier = tier;
    this.callbacks.onTierChange(tier);
    this.callbacks.applyQuality(tier);
    this.frames.length = 0;
    return tier;
  }

  private computeTier(avgMs: number): QualityTier {
    // Target 60fps ~ 16.7ms. If we're well under, we can upgrade.
    if (avgMs < 13.5) return "high";
    if (avgMs < 18) return "medium";
    if (avgMs < 27) return "low";
    return "potato";
  }

  current(): QualityTier {
    return this.tier;
  }
}
