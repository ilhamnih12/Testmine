"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Progressive Web App helpers:
 *   - registers the service worker (offline caching)
 *   - captures the native install prompt
 *   - fullscreen API helpers (iOS SafeArea handled via CSS env())
 *
 * Uses `useCallback`-wrapped fns so callers can attach them as onClick props.
 */
export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Service worker.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW unsupported (e.g. some iOS WebView) — app still works */
      });
    }
  }, []);

  // Track install prompt + standalone status.
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const onDisplayMode = () => setIsStandalone(matchMedia("(display-mode: standalone)").matches);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    onDisplayMode();
    window.addEventListener("change", onDisplayMode as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("change", onDisplayMode as EventListener);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const res = await deferredPrompt.userChoice;
      if (res.outcome === "accepted") setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      await el.requestFullscreen?.();
    } catch {
      /* not supported */
    }
  }, []);

  const canInstall = Boolean(deferredPrompt) && !installed && !isStandalone;

  return { canInstall, install, enterFullscreen, isStandalone, installed };
}
