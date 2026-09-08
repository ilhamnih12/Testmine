"use client";

import { Suspense, useEffect, useState } from "react";
import EngineFrame from "@/components/EngineFrame";
import {
  detectSelfHostedEngine,
  getMirror,
  loadSettings,
  resolveEngineUrl,
} from "@/lib/engine";

function PlayInner() {
  const [ready, setReady] = useState(false);
  const [selfHosted, setSelfHosted] = useState(false);
  const [settings, setSettings] = useState(loadSettings());

  // Probe /engine/manifest.json once; then decide the engine source.
  useEffect(() => {
    let cancelled = false;
    setSettings(loadSettings());
    void detectSelfHostedEngine().then((manifest) => {
      if (cancelled) return;
      setSelfHosted(manifest !== null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="play-root">
        <div className="boot-overlay">
          <div className="boot-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  const { url, mode } = resolveEngineUrl(settings, selfHosted);
  const mirror = selfHosted ? null : getMirror(settings.mirror);

  return <EngineFrame url={url} mode={mode} mirror={mirror} />;
}

export default function PlayPage() {
  return (
    <main className="play-main">
      <Suspense
        fallback={
          <div className="play-root">
            <div className="boot-overlay">
              <div className="boot-spinner" aria-hidden />
            </div>
          </div>
        }
      >
        <PlayInner />
      </Suspense>
    </main>
  );
}
