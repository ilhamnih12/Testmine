"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InputHandler } from "@/lib/inputHandler";
import { loadLuantiEngine, createDemoFallback, type EngineHandle, type EngineStatus } from "@/lib/wasmLoader";
import { DemoWorld } from "@/lib/renderer";
import { AdaptiveQualityController } from "@/lib/quality";
import type { QualityTier } from "@/lib/types";

export interface GameEngineState {
  status: EngineStatus;
  progress: number;
  fps: number;
  tier: QualityTier;
  usingDemo: boolean;
  camera: { x: number; y: number; zoom: number };
  error?: string;
}

export interface UseGameEngineOptions {
  /** "start" mounts the engine; the menu calls this. */
  autoStart?: boolean;
  /** URL of the Emscripten loader script. */
  scriptUrl?: string;
  onExit?: () => void;
}

/**
 * Orchestrates the whole game client session:
 *   1. Boots the real WASM engine when the artifacts are present, else the demo.
 *   2. Runs a single rAF loop that reads the shared input snapshot and renders.
 *   3. Feeds a rolling FPS metric into the adaptive quality controller.
 *   4. Exposes React state just for slow-changing UI (FPS, quality tier, status).
 */
export function useGameEngine({
  autoStart = true,
  scriptUrl = "/luanti.js",
  onExit,
}: UseGameEngineOptions = {}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<EngineStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fps, setFps] = useState(0);
  const [tier, setTier] = useState<QualityTier>("high");
  const [usingDemo, setUsingDemo] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState<string | undefined>();

  const handlerRef = useRef<InputHandler | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const demoRef = useRef<DemoWorld | null>(null);
  const qualityRef = useRef<AdaptiveQualityController | null>(null);
  const exitedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const boot = useCallback(async () => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas) return;

    // Cancel any prior session before starting a new one.
    cleanupRef.current?.();
    exitedRef.current = false;
    setStatus("loading");
    setProgress(0);
    setError(undefined);

    const handler = new InputHandler(surface, canvas);
    handlerRef.current = handler;

    const quality = new AdaptiveQualityController(
      {
        onTierChange: (t) => setTier(t),
        applyQuality: (t) => demoRef.current?.setQuality(t),
      },
      "high",
    );
    qualityRef.current = quality;

    let engine: EngineHandle | null = null;
    try {
      engine = await loadLuantiEngine({
        canvas,
        scriptUrl,
        onProgress: setProgress,
        onStatus: setStatus,
        onExit: () => exitedRef.current && onExit?.(),
      });
    } catch (e) {
      console.warn("Luanti engine load failed, falling back to demo", e);
      engine = null;
    }

    if (engine) {
      setUsingDemo(false);
    } else {
      setUsingDemo(true);
      engine = createDemoFallback(canvas);
      setStatus("ready");
      setProgress(1);
    }
    engineRef.current = engine;

    // Start the loop.
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const metrics = qualityRef.current?.tick(now) ?? { fps: 60, frameMs: 0, tier: "high" as QualityTier };
      setFps((prev) => (Math.abs(prev - metrics.fps) > 1 ? metrics.fps : prev));

      const input = handlerRef.current?.consumeFrame();
      if (input) demoRef.current?.update(input, now - last);
      demoRef.current?.render();
      if (demoRef.current) {
        const cam = demoRef.current.getCamera();
        setCamera((prev) => (prev.x !== cam.x || prev.y !== cam.y || prev.zoom !== cam.zoom ? cam : prev));
      }
      last = now;
    };
    raf = requestAnimationFrame(loop);

    const cleanup = () => {
      cancelAnimationFrame(raf);
      engine?.destroy();
      handlerRef.current = null;
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    return cleanup;
  }, [scriptUrl, onExit]);

  const start = useCallback(() => {
    exitedRef.current = false;
    void boot();
  }, [boot]);

  const exit = useCallback(() => {
    exitedRef.current = true;
    handlerRef.current?.reset();
    onExit?.();
  }, [onExit]);

  const cycleQuality = useCallback(() => {
    const order: QualityTier[] = ["high", "medium", "low", "potato"];
    const cur = qualityRef.current?.current() ?? "high";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const applied = qualityRef.current?.force(next) ?? next;
    setTier(applied);
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const cleanup = boot();
    return () => {
      cleanup.then((fn) => fn?.()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return {
    surfaceRef,
    canvasRef,
    handlerRef,
    state: { status, progress, fps, tier, usingDemo, camera, error },
    start,
    exit,
    cycleQuality,
  };
}
