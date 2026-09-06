/**
 * Fallback renderer.
 *
 * When the real Luanti WASM binary is not present in /public, this draws a tiny
 * procedural voxel world on a 2D canvas. It exists so the mobile wrapper
 * (virtual controls, FPS meter, adaptive quality, camera pan) can be fully
 * exercised and tested on any device/laptop before the heavy engine is wired in.
 *
 * It consumes the same `InputSnapshot` the real engine would, and it runs inside
 * the same rAF loop, so it is a faithful stand-in for game-loop timing.
 */
import { hash2D, MAX_VIEW_TILES, type InputSnapshot, type QualityTier } from "./types";

interface WorldState {
  camX: number;
  camY: number;
  zoom: number;
  jumpPhase: number;
  jumpVel: number;
  onGround: boolean;
}

const COLORS = [
  "#5fbf7a", // grass
  "#7d9d5f",
  "#4f9d6b",
  "#3f7f6a",
  "#6b8f5f",
  "#8a7f5f", // sand
  "#5f6f8a", // water-ish
];

export class DemoWorld {
  private state: WorldState = { camX: 0, camY: 0, zoom: 1, jumpPhase: 0, jumpVel: 0, onGround: true };
  private tiles = new Map<number, { x: number; y: number; c: string }>();
  private lastTime = 0;
  private firstFrame = true;

  constructor(private canvas: HTMLCanvasElement, private quality: QualityTier) {}

  setQuality(q: QualityTier): void {
    this.quality = q;
    this.tiles.clear();
  }

  update(input: InputSnapshot, dtMs: number): void {
    const dt = Math.min(dtMs / 1000, 0.05);

    // Movement: joystick [0,1] maps to blocks/second. Lower tier -> slower.
    const speedFactor = this.quality === "high" ? 1 : this.quality === "medium" ? 0.8 : 0.6;
    this.state.camX += input.moveX * 6 * speedFactor * dt;
    this.state.camY += input.moveY * 6 * speedFactor * dt;

    // Camera drag: 0.06 px per CSS px of drag.
    this.state.camX += input.cameraDX * 0.02;
    this.state.camY += input.cameraDY * 0.02;

    // Pinch/wheel zoom, clamped.
    this.state.zoom *= input.cameraZoom;
    this.state.zoom = Math.max(0.5, Math.min(2.5, this.state.zoom));

    // Jump (physics-ish): on queue, if grounded, set upward velocity.
    if (input.jumpQueued && this.state.onGround) {
      this.state.jumpVel = 6;
      this.state.onGround = false;
    }
    if (!this.state.onGround) {
      this.state.jumpVel -= 18 * dt;
      this.state.jumpPhase += this.state.jumpVel * dt;
      if (this.state.jumpPhase <= 0) {
        this.state.jumpPhase = 0;
        this.state.jumpVel = 0;
        this.state.onGround = true;
      }
    }

    // Sprint tiles: actions update color palette shift — cosmetic.
    void input.actionHeld;
    void input.sprint;
  }

  render(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#2a3f56");
    sky.addColorStop(1, "#10151c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // The jump offset relates to the "camera" height in this pseudo-3D.
    const jumpPx = -this.state.jumpPhase * 22;
    const yOff = h * 0.62 + jumpPx;

    // Tile size scales with zoom; compute how many tiles fit the viewport.
    const tile = Math.max(12, 46 * this.state.zoom);
    const cols = Math.ceil(w / tile) + 2;
    const rows = Math.ceil(h / tile) + 2;
    const total = cols * rows;

    // Bound the visible tile count for memory/perf.
    const budget = Math.min(total, MAX_VIEW_TILES);
    if (budget < total) this.tiles.clear();

    // Cull to the visible window and draw as a flat "isometric-ish" field.
    const originX = w / 2 - this.state.camX * tile;
    const originY = yOff - this.state.camY * tile * 0.5;

    let drawn = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (drawn >= budget) break;
        const x = originX + col * tile;
        const y = originY + row * tile * 0.5;
        if (x < -tile || y < -tile || x > w + tile || y > h + tile) continue;

        const wx = Math.floor(this.state.camX + col);
        const wy = Math.floor(this.state.camY * 0.5 + row);
        const key = wx * 100000 + wy;
        let t = this.tiles.get(key);
        if (!t) {
          const n = hash2D(wx, wy);
          const c = COLORS[Math.floor(n * COLORS.length) % COLORS.length];
          t = { x: wx, y: wy, c };
          this.tiles.set(key, t);
        }

        ctx.fillStyle = t.c;
        // Slight depth shading by row.
        const shade = 0.65 + (row / rows) * 0.35;
        ctx.fillStyle = shadeColor(t.c, shade);
        const px = x;
        const py = y;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + tile, py);
        ctx.lineTo(px + tile, py + tile * 0.5);
        ctx.lineTo(px, py + tile * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.stroke();
        drawn++;
      }
      if (drawn >= budget) break;
    }
  }

  /** Returns the current camera world-coords for the HUD readout. */
  getCamera(): { x: number; y: number; zoom: number } {
    return { x: this.state.camX, y: this.state.camY, zoom: this.state.zoom };
  }
}

function shadeColor(hex: string, f: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const sr = Math.round(r * f);
  const sg = Math.round(g * f);
  const sb = Math.round(b * f);
  return `rgb(${sr},${sg},${sb})`;
}
