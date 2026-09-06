/**
 * Shared types for the Luanti mobile web wrapper.
 *
 * The central idea: the heavy WASM engine loop runs on a `requestAnimationFrame`
 * tick and reads a MUTABLE input snapshot each frame. Re-rendering React at 60fps
 * would be a perf disaster on mobile, so all touch input writes into this plain
 * object via refs, and the game loop consumes it. React state is only updated for
 * low-frequency UI (FPS badge, quality tier, loading progress).
 */

export interface InputSnapshot {
  /** Left joystick, normalized to [-1, 1] on X (right positive) and Y (down positive). */
  moveX: number;
  moveY: number;
  /** Whether the jump button is currently held. */
  jumpHeld: boolean;
  /** Edge-triggered: set once per press. The loop consumes and clears it. */
  jumpQueued: boolean;
  actionHeld: boolean;
  actionQueued: boolean;
  /** Toggle state of the sprint/fast button. */
  sprint: boolean;
  inventoryHeld: boolean;
  /** Accumulated camera pan from the right-side drag, in CSS pixels. Consumed each frame. */
  cameraDX: number;
  cameraDY: number;
  /** Accumulated pinch/wheel zoom factor this frame (1 = no change). Consumed each frame. */
  cameraZoom: number;
}

/** All touch input for a single frame starts at these neutral values. */
export function createInputSnapshot(): InputSnapshot {
  return {
    moveX: 0,
    moveY: 0,
    jumpHeld: false,
    jumpQueued: false,
    actionHeld: false,
    actionQueued: false,
    sprint: false,
    inventoryHeld: false,
    cameraDX: 0,
    cameraDY: 0,
    cameraZoom: 1,
  };
}

/**
 * Deterministic 2D hash -> [0,1). Used for procedural terrain so the demo world
 * looks identical every load without shipping a texture atlas.
 */
export function hash2D(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

/** A hard cap keeps memory bounded: we only allocate tiles within the visible window. */
export const MAX_VIEW_TILES = 480;

export type QualityTier = "high" | "medium" | "low" | "potato";
