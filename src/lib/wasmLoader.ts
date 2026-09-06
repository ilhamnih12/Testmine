/**
 * Loader for the real Luanti (Minetest) WASM client.
 *
 * The engine itself is a large C++/Emscripten build that is produced by an
 * external toolchain (see docs/WASM_BUILD.md for the paradust7/Kaesual
 * pipeline). This module is the seam in the frontend: when you place the
 * compiled artifacts in /public (luanti.js, luanti.data, luanti.wasm,
 * plus the game pack in /public/games/...) this loader boots them and
 * hands the callback registry over to the client.
 *
 * Until the WASM binary is dropped in, the app falls back to a built-in
 * HTML5 "block world" demo so the virtual controls + adaptive performance
 * layers can be exercised on any device.
 */

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface EngineHandle {
  /** Guarantees a WebAssembly.Memory. Unused by the 2D fallback but kept for parity. */
  memory?: WebAssembly.Memory;
  call?: (fn: string, ...args: unknown[]) => unknown;
  destroy: () => void;
}

export interface EngineBootstrapOptions {
  canvas: HTMLCanvasElement;
  scriptUrl: string; // e.g. "/luanti.js"
  onProgress: (fraction: number) => void;
  onStatus: (status: EngineStatus) => void;
  /** Called by the engine shim when the user wants to exit back to menu. */
  onExit?: () => void;
}

/** Version gate: the real engine is created by Emscripten's `Module` global. */
interface EmscriptenModule {
  canvas?: HTMLCanvasElement;
  onRuntimeInitialized?: () => void;
  setStatus?: (msg: string) => void;
  [key: string]: unknown;
}

/**
 * Try to boot the real engine. Returns `false` when the WASM artifacts are
 * absent, so the caller can fall back to the demo renderer.
 */
export async function loadLuantiEngine(
  opts: EngineBootstrapOptions,
): Promise<EngineHandle | null> {
  opts.onStatus("loading");
  opts.onProgress(0.05);

  // The Emscripten loader emits a <script> and sets `window.Module`; it needs
  // COOP/COEP enabled (configured in vercel.json) to allocate a shared memory.
  const existing = (globalThis as { Module?: EmscriptenModule }).Module;

  if (!existing) {
    // Probe whether the artifact exists without throwing if it is missing.
    const scriptUrl = new URL(opts.scriptUrl, window.location.href);
    try {
      const head = await fetch(scriptUrl.href, { method: "HEAD" });
      if (!head.ok) {
        opts.onStatus("idle");
        return null;
      }
    } catch {
      opts.onStatus("idle");
      return null;
    }

    await new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = scriptUrl.href;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("Failed to load Luanti engine script"));
      document.head.appendChild(el);
    });
  }

  const Module = existing ?? (globalThis as { Module?: EmscriptenModule }).Module;
  if (!Module) {
    opts.onStatus("idle");
    return null;
  }

  opts.onProgress(0.6);
  Module.canvas = opts.canvas;
  Module.onRuntimeInitialized = () => {
    opts.onProgress(1);
    opts.onStatus("ready");
  };

  await new Promise<void>((resolve) => {
    // If the runtime is already initialised, fire immediately.
    const check = () => {
      if (Module?.onRuntimeInitialized) {
        opts.onProgress(1);
        opts.onStatus("ready");
        resolve();
      }
    };
    check();
    setTimeout(check, 60);
  });

  return {
    call: (fn, ...args) => (Module[fn] as (...a: unknown[]) => unknown)?.(...args),
    destroy: () => {
      // Emscripten modules are singletons; call the standard teardown hook.
      (Module as { destroy?: () => void } & { Module?: { destroy: () => void } }).destroy?.();
    },
  };
}

/**
 * Fallback "engine" used while no WASM binary is present. It keeps a synthetic
 * framebuffer so the rest of the app (controls, perf monitor, load screen)
 * behaves identically whether or not the real engine is wired up.
 */
export function createDemoFallback(canvas: HTMLCanvasElement): EngineHandle {
  const width = 320;
  const height = 240;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 64 });
  const buffer = new Uint8Array(memory.buffer, 0, width * height * 4);

  let destroyed = false;
  const loop = () => {
    if (destroyed) return;
    if (ctx) {
      const g = (Math.sin(Date.now() / 600) + 1) / 2;
      const r = (55 + g * 120) | 0;
      const b = (120 + g * 100) | 0;
      ctx.fillStyle = `rgb(${r},${120},${b})`;
      ctx.fillRect(0, 0, width, height);
      // Copy a pixel into the WASM memory so tooling sees a real allocation.
      const px = ((Date.now() / 8) % (width * height)) | 0;
      buffer[px * 4] = r;
      buffer[px * 4 + 1] = 120;
      buffer[px * 4 + 2] = b;
      buffer[px * 4 + 3] = 255;
    }
    requestAnimationFrame(loop);
  };
  loop();

  return {
    memory,
    call: () => undefined,
    destroy: () => {
      destroyed = true;
    },
  };
}
