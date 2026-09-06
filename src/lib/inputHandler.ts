/**
 * InputHandler
 * -------------
 * Owns ALL raw pointer/touch events for a running game session. It writes the
 * frame's input into a mutable `InputSnapshot` that the render/engine loop
 * reads once per animation frame — this keeps input latency to a single frame
 * and never triggers a React re-render per pointermove.
 *
 * The DOM for every control lives in the React `VirtualControls` component;
 * the handler receives element references via setters and animates them
 * directly (no re-renders). Layout is "adaptive": the left half of the screen
 * is the movement joystick (wherever you first touch), the right half is the
 * camera look zone.
 *
 * Customization (drag to reposition, resize, opacity, layout presets) is the
 * component's job; this handler stays focused on raw input -> snapshot.
 */
import { createInputSnapshot, type InputSnapshot } from "./types";

export interface ControlRegistration {
  id: string;
  onPress: () => void;
  onRelease: () => void;
  element: HTMLElement;
  /** Optional haptic strength 0..1 (vibration). */
  haptic?: number;
}

interface ActiveTouch {
  pointerId: number;
  kind: "joystick" | "camera";
  baseX?: number;
  baseY?: number;
  knobEl?: HTMLElement;
  lastX?: number;
  lastY?: number;
}

export interface JoystickRefs {
  base: HTMLElement | null;
  knob: HTMLElement | null;
}
export interface CameraZoneRefs {
  element: HTMLElement | null;
}

export class InputHandler {
  private snap: InputSnapshot = createInputSnapshot();
  private active = new Map<number, ActiveTouch>();
  private registrations = new Map<string, ControlRegistration>();
  private joyBase: HTMLElement | null = null;
  private joyKnob: HTMLElement | null = null;
  private camZone: HTMLElement | null = null;

  private pinchDist = 0;
  private pinchBaseX = 0;
  private readonly deadzonePx = 9;
  private readonly maxTravelPx = 60;

  constructor(private surface: HTMLElement, private canvas: HTMLCanvasElement) {
    surface.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    surface.addEventListener("pointermove", this.onPointerMove, { passive: false });
    surface.addEventListener("pointerup", this.onPointerUp, { passive: false });
    surface.addEventListener("pointercancel", this.onPointerUp, { passive: false });
    surface.addEventListener("wheel", this.onWheel, { passive: false });

    surface.addEventListener("gesturestart", this.prevent, { passive: false });
    surface.addEventListener("gesturechange", this.prevent, { passive: false });
  }

  private prevent = (e: Event) => e.preventDefault();

  /** Attach the DOM elements the component controls. */
  attachJoystick(refs: JoystickRefs): void {
    this.joyBase = refs.base;
    this.joyKnob = refs.knob;
  }
  attachCameraZone(refs: CameraZoneRefs): void {
    this.camZone = refs.element;
  }

  /** Reset all inputs to neutral (call on session start / focus loss). */
  reset(): void {
    this.snap = createInputSnapshot();
    this.active.clear();
    this.pinchDist = 0;
  }

  /** Register a DOM control (button). Returns an unregister fn. */
  registerControl(reg: ControlRegistration): () => void {
    this.registrations.set(reg.id, reg);
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      reg.onPress();
      this.markPressed(reg.element);
      this.ripple(reg.element, e);
      this.vibrate(reg.haptic ?? 0.3);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      reg.onRelease();
      this.unmarkPressed(reg.element);
    };
    reg.element.addEventListener("pointerdown", down);
    reg.element.addEventListener("pointerup", up);
    reg.element.addEventListener("pointercancel", up);
    return () => {
      reg.element.removeEventListener("pointerdown", down);
      reg.element.removeEventListener("pointerup", up);
      reg.element.removeEventListener("pointercancel", up);
      this.registrations.delete(reg.id);
    };
  }

  /** Read + clear the accumulated per-frame input. */
  consumeFrame(): InputSnapshot {
    const out = { ...this.snap };
    this.snap.jumpQueued = false;
    this.snap.actionQueued = false;
    this.snap.cameraDX = 0;
    this.snap.cameraDY = 0;
    this.snap.cameraZoom = 1;
    return out;
  }

  /* ---- Public input setters (driven by the VirtualControls buttons) ---- */

  pressJump(): void {
    this.snap.jumpQueued = true;
    this.snap.jumpHeld = true;
  }
  releaseJump(): void {
    this.snap.jumpHeld = false;
  }
  pressAction(): void {
    this.snap.actionQueued = true;
    this.snap.actionHeld = true;
  }
  releaseAction(): void {
    this.snap.actionHeld = false;
  }
  pressInventory(): void {
    this.snap.inventoryHeld = true;
  }
  releaseInventory(): void {
    this.snap.inventoryHeld = false;
  }
  toggleSprint(): boolean {
    this.snap.sprint = !this.snap.sprint;
    return this.snap.sprint;
  }
  setSprint(on: boolean): void {
    this.snap.sprint = on;
  }
  isSprint(): boolean {
    return this.snap.sprint;
  }

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;

    const touch: ActiveTouch = {
      pointerId: e.pointerId,
      kind: isRightHalf ? "camera" : "joystick",
    };
    if (isRightHalf) {
      touch.lastX = e.clientX;
      touch.lastY = e.clientY;
      this.pinchDist = 0;
    } else {
      touch.baseX = e.clientX;
      touch.baseY = e.clientY;
      this.joyBase?.classList.add("active");
      // On touch start snap the knob toward the touch point for feedback.
      if (this.joyKnob) this.joyKnob.style.transform = "translate(-50%, -50%)";
    }
    this.active.set(e.pointerId, touch);
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.camZone?.classList.toggle("dragging", isRightHalf);
  };

  private onPointerMove = (e: PointerEvent) => {
    const touch = this.active.get(e.pointerId);
    if (!touch) return;
    e.preventDefault();

    if (touch.kind === "joystick") {
      const baseX = touch.baseX ?? e.clientX;
      const baseY = touch.baseY ?? e.clientY;
      let dx = e.clientX - baseX;
      let dy = e.clientY - baseY;
      const dist = Math.hypot(dx, dy);
      if (dist < this.deadzonePx) {
        dx = 0;
        dy = 0;
      } else if (dist > this.maxTravelPx) {
        const scale = this.maxTravelPx / dist;
        dx *= scale;
        dy *= scale;
      }
      // Y is down in screen coords; forward(up) pushes joystick up => -Y.
      this.snap.moveX = dx / this.maxTravelPx;
      this.snap.moveY = dy / this.maxTravelPx;
      touch.knobEl = this.joyKnob ?? undefined;
      if (touch.knobEl) {
        touch.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    } else {
      // Camera look: accumulate delta in CSS px.
      const dx = e.clientX - (touch.lastX ?? e.clientX);
      const dy = e.clientY - (touch.lastY ?? e.clientY);
      this.snap.cameraDX += dx;
      this.snap.cameraDY += dy;
      touch.lastX = e.clientX;
      touch.lastY = e.clientY;

      const cameras = [...this.active.values()].filter((t) => t.kind === "camera");
      if (cameras.length >= 2) {
        const [a, b] = cameras.map((t) => ({ x: t.lastX ?? 0, y: t.lastY ?? 0 }));
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) {
          this.snap.cameraZoom *= dist / this.pinchDist;
        }
        this.pinchDist = dist;
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const touch = this.active.get(e.pointerId);
    if (!touch) return;
    e.preventDefault();

    if (touch.kind === "joystick") {
      this.snap.moveX = 0;
      this.snap.moveY = 0;
      this.joyBase?.classList.remove("active");
      if (this.joyKnob) this.joyKnob.style.transform = "translate(-50%, -50%)";
    } else {
      this.camZone?.classList.remove("dragging");
      this.pinchDist = 0;
    }
    this.active.delete(e.pointerId);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.snap.cameraZoom *= e.deltaY < 0 ? 1.1 : 0.9;
  };

  private markPressed(el: HTMLElement): void {
    el.classList.add("pressed");
  }
  private unmarkPressed(el: HTMLElement): void {
    el.classList.remove("pressed");
  }
  private ripple(el: HTMLElement, e: PointerEvent): void {
    const rect = el.getBoundingClientRect();
    const r = document.createElement("span");
    r.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    r.style.width = r.style.height = `${size}px`;
    r.style.left = `${e.clientX - rect.left - size / 2}px`;
    r.style.top = `${e.clientY - rect.top - size / 2}px`;
    el.appendChild(r);
    setTimeout(() => r.remove(), 500);
  }
  private vibrate(ms: number): void {
    try {
      navigator.vibrate?.(Math.max(10, Math.round(ms * 100)));
    } catch {
      /* not supported */
    }
  }
}

/** Detect coarse pointer (touch) to enable haptics / larger targets. */
export function detectCoarsePointer(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches ?? true;
}
