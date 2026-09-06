"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { InputHandler } from "@/lib/inputHandler";

/** Saved layout preferences, persisted to localStorage. */
interface LayoutPrefs {
  opacity: number; // 0.35..1
  scale: number; // 0.8..1.4
  show: boolean;
  preset: "comfortable" | "competitive";
}

const DEFAULT_PREFS: LayoutPrefs = { opacity: 1, scale: 1, show: true, preset: "comfortable" };
const PREFS_KEY = "luanti-controls-v1";

function loadPrefs(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* corrupt -> defaults */
  }
  return DEFAULT_PREFS;
}

function savePrefs(p: LayoutPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

interface Props {
  handlerRef: RefObject<InputHandler | null>;
  enabled: boolean;
  /** Auto-hide controls after this many ms of no touch. 0 = never. */
  idleTimeoutMs?: number;
  onSprintChange?: (on: boolean) => void;
}

export default function VirtualControls({
  handlerRef,
  enabled,
  idleTimeoutMs = 6000,
  onSprintChange,
}: Props) {
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const camZoneRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<LayoutPrefs>(DEFAULT_PREFS);
  const [idle, setIdle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sprintOn, setSprintOn] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved prefs once.
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  // Attach DOM refs to the input handler whenever enabled.
  useEffect(() => {
    if (!enabled) return;
    const h = handlerRef.current;
    if (!h) return;
    h.attachJoystick({ base: joyBaseRef.current, knob: joyKnobRef.current });
    h.attachCameraZone({ element: camZoneRef.current });
  }, [enabled, handlerRef]);

  // Register buttons once the handler exists.
  useEffect(() => {
    if (!enabled) return;
    const h = handlerRef.current;
    if (!h) return;

    const regs = [
      {
        id: "jump",
        element: document.getElementById("btn-jump")!,
        upper: true,
        haptic: 0.35,
        press: () => h.pressJump(),
        release: () => h.releaseJump(),
      },
      {
        id: "action",
        element: document.getElementById("btn-action")!,
        upper: false,
        haptic: 0.3,
        press: () => h.pressAction(),
        release: () => h.releaseAction(),
      },
      {
        id: "inventory",
        element: document.getElementById("btn-inventory")!,
        upper: true,
        haptic: 0.2,
        press: () => h.pressInventory(),
        release: () => h.releaseInventory(),
      },
    ];

    const unregs = regs.map((r) =>
      h.registerControl({
        id: r.id,
        element: r.element,
        haptic: r.haptic,
        onPress: r.press,
        onRelease: r.release,
      }),
    );

    // Sprint & sneak use pointerdown + toggling rather than hold.
    const sprintEl = document.getElementById("btn-sprint");
    const onSprint = (e: Event) => {
      e.preventDefault();
      const on = h.toggleSprint();
      setSprintOn(on);
      onSprintChange?.(on);
    };
    sprintEl?.addEventListener("pointerdown", onSprint);

    const sneakEl = document.getElementById("btn-sneak");
    const onSneak = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    sneakEl?.addEventListener("pointerdown", onSneak);

    return () => {
      unregs.forEach((u) => u());
      sprintEl?.removeEventListener("pointerdown", onSprint);
      sneakEl?.removeEventListener("pointerdown", onSneak);
    };
  }, [enabled, handlerRef, onSprintChange]);

  // Auto-hide when the user stops touching.
  useEffect(() => {
    if (idleTimeoutMs <= 0) return;
    const poke = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), idleTimeoutMs);
    };
    poke();
    window.addEventListener("pointerdown", poke);
    window.addEventListener("touchstart", poke);
    return () => {
      window.removeEventListener("pointerdown", poke);
      window.removeEventListener("touchstart", poke);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [idleTimeoutMs]);

  // Keep sprint button visuals in sync when state resets.
  useEffect(() => {
    const b = document.getElementById("btn-sprint");
    if (b) b.classList.toggle("pressed", sprintOn);
  }, [sprintOn]);

  const updatePrefs = (patch: Partial<LayoutPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const scaleCss = prefs.scale;
  const opCss = prefs.opacity;

  const controlsClass = useMemo(
    () => `controls-fade${idle && !showSettings ? " idle" : ""}`,
    [idle, showSettings],
  );

  return (
    <div className={`game-hud ${enabled ? "" : "hidden"}`}>
      {/* Left joystick */}
      <div
        ref={joyBaseRef}
        className="joy controls-fade"
        style={{ opacity: opCss, transform: `scale(${scaleCss})`, transformOrigin: "bottom left" }}
        aria-label="Movement joystick"
      >
        <div className="dir" />
        <div ref={joyKnobRef} className="knob" />
      </div>

      {/* Camera look zone indicator */}
      <div ref={camZoneRef} className="camera-zone controls-fade" style={{ opacity: opCss }}>
        <div>DRAG<br />TO<br />LOOK</div>
      </div>

      {/* Right action buttons */}
      <div className={`controls-right ${controlsClass}`} style={{ opacity: opCss * 0.6 }}>
        <button id="btn-jump" className="action-btn" aria-label="Jump">
          <svg viewBox="0 0 24 24"><path d="M12 3l7 9h-4v6h-6v-6H5z" /></svg>
          <span className="label">Jump</span>
        </button>
        <button id="btn-inventory" className="action-btn small" aria-label="Inventory">
          <svg viewBox="0 0 24 24"><path d="M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" /></svg>
          <span className="label">Bag</span>
        </button>
        <button id="btn-action" className="action-btn" aria-label="Interact">
          <svg viewBox="0 0 24 24"><path d="M12 5l2 2-2 2-2-2zM5 12l2-2 2 2-2 2zM17 12l2-2 2 2-2 2zM12 15l2 2-2 2-2-2z" /></svg>
          <span className="label">Use</span>
        </button>
        <button id="btn-sprint" className="action-btn small" aria-label="Sprint toggle">
          <svg viewBox="0 0 24 24"><path d="M13 3l-4 9h3l-1 6 6-10h-3l3-5z" /></svg>
          <span className="label">Run</span>
        </button>
      </div>

      {/* Settings toggle */}
      <button
        className="chip quality-toggle"
        hidden={!enabled}
        onClick={() => setShowSettings((s) => !s)}
        aria-label="Toggle control settings"
      >
        ⚙
      </button>

      {showSettings && (
        <div className="install-card" role="dialog" aria-label="Control settings">
          <div>
            <b>Controls</b>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", justifyContent: "space-between" }}>
              Opacity
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.05}
                value={prefs.opacity}
                onChange={(e) => updatePrefs({ opacity: +e.target.value })}
                style={{ width: 140 }}
              />
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "flex", justifyContent: "space-between" }}>
              Size
              <input
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={prefs.scale}
                onChange={(e) => updatePrefs({ scale: +e.target.value })}
                style={{ width: 140 }}
              />
            </label>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button
              className={prefs.preset === "comfortable" ? "primary" : ""}
              onClick={() => updatePrefs({ preset: "comfortable" })}
            >
              Comfortable
            </button>
            <button
              className={prefs.preset === "competitive" ? "primary" : ""}
              onClick={() => updatePrefs({ preset: "competitive", scale: 1.15, opacity: 0.9 })}
            >
              Competitive
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={prefs.show}
                onChange={(e) => updatePrefs({ show: e.target.checked })}
              />
              Show controls
            </label>
          </div>
          <div className="actions" style={{ marginTop: 10 }}>
            <button onClick={() => setShowSettings(false)}>Done</button>
            <button onClick={() => updatePrefs(DEFAULT_PREFS)}>Reset</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
            Saved on this device (localStorage).
          </div>
        </div>
      )}
    </div>
  );
}
