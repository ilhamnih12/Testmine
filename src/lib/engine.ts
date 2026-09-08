/**
 * Engine configuration for the real Luanti (Minetest) WASM client.
 *
 * The game client itself is the C++ Luanti engine compiled to WebAssembly by
 * the community Emscripten pipeline (paradust7/luanti-wasm, maintained fork
 * Kaesual/minetest-wasm). It is a complete, self-contained static app:
 *
 *   <release>/index.html      launcher page (own start screen)
 *   <release>/*.js, *.wasm    Emscripten runtime + worker (pthread)
 *   <release>/packs/*.pack    zstd packs: engine fsroot + game packs
 *
 * Our site never emulates or approximates the game. There are two ways to
 * serve it:
 *
 *  1. Self-hosted — `npm run download-engine` copies a whole release into
 *     /public/engine (served same-origin at /engine). Most reliable, works
 *     offline once cached, needs the COOP/COEP headers from middleware.ts.
 *
 *  2. Public mirror — an iframe (or a direct top-level visit) to a public
 *     standalone deployment of the same build. The mirror page carries its
 *     own COOP/COEP headers, so it isolates itself in the browser.
 */

export interface EngineMirror {
  id: string;
  /** Short label shown in the UI. */
  label: string;
  /** One-line description. */
  description: string;
  /** Root URL of the standalone deployment (trailing slash). */
  url: string;
  /** Luanti version shipped by this mirror (informational). */
  version: string;
  /** Maintainer attribution. */
  credit: string;
  /**
   * Can this mirror be embedded in a cross-origin iframe? Requires the host
   * to send `Cross-Origin-Opener-Policy: cross-origin` on its document.
   * When false we fall back to a top-level navigation.
   */
  embeddable: boolean;
  recommended: boolean;
}

/**
 * Public standalone deployments of the Luanti WASM client, checked
 * 2026-09-08. Both are community-hosted; the Common Ground standalone is
 * the most polished (game-pack selection, IndexedDB world storage, backup).
 */
export const MIRRORS: EngineMirror[] = [
  {
    id: "commonground",
    label: "Common Ground",
    description: "Build 5.9 — launcher paling lengkap (pilih game, simpan world di browser, backup zip).",
    url: "https://embed.commonground.cg/standalone/minetest/",
    version: "Luanti 5.9 + VoxeLibre 0.90.1",
    credit: "Kaesual (Common Games Collection)",
    embeddable: true,
    recommended: true,
  },
  {
    id: "dustlabs",
    label: "Dustlabs (paradust)",
    description: "Build terbaru (5.14+, eksperimental) — UI lebih sederhana, maintenance aktif.",
    url: "https://luanti.dustlabs.io/",
    version: "Luanti 5.14+ (work in progress)",
    credit: "paradust7",
    embeddable: false,
    recommended: false,
  },
];

export function getMirror(id: string | null | undefined): EngineMirror {
  return MIRRORS.find((m) => m.id === id) ?? MIRRORS.find((m) => m.recommended)!;
}

/* ----------------------------- settings ------------------------------ */

export interface PlaySettings {
  /** Mirror id, or "direct" to always open top-level. */
  mirror: string;
  /** In-game language passed via ?lang= ("" = auto-detect). */
  lang: string;
}

const SETTINGS_KEY = "luanti-web-settings-v1";
const DEFAULT_SETTINGS: PlaySettings = { mirror: "commonground", lang: "" };

export function loadSettings(): PlaySettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PlaySettings>;
    return {
      mirror: typeof parsed.mirror === "string" ? parsed.mirror : DEFAULT_SETTINGS.mirror,
      lang: typeof parsed.lang === "string" ? parsed.lang : DEFAULT_SETTINGS.lang,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PlaySettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode — non-fatal */
  }
}

/**
 * Build the URL the engine should be loaded from.
 *
 * - Self-hosted engine (manifest found) → same-origin /engine.
 * - Mirror → the mirror's standalone URL, with ?lang= when the user picked
 *   one explicitly (the upstream launcher honours it).
 */
export function resolveEngineUrl(
  settings: PlaySettings,
  selfHosted: boolean,
): { url: string; mode: "self-hosted" | "iframe" | "direct" } {
  if (selfHosted) {
    const qs = settings.lang ? `?lang=${encodeURIComponent(settings.lang)}` : "";
    return { url: `/engine/index.html${qs}`, mode: "self-hosted" };
  }
  const mirror = getMirror(settings.mirror);
  const qs = settings.lang ? `?lang=${encodeURIComponent(settings.lang)}` : "";
  if (mirror.embeddable) return { url: mirror.url + qs, mode: "iframe" };
  return { url: mirror.url + qs, mode: "direct" };
}

/* ------------------------ self-host detection ------------------------ */

export interface EngineManifest {
  mirror: string;
  base: string;
  version: string;
  downloadedAt: string;
  totalBytes: number;
  files: { path: string; sizeBytes: number }[];
}

const MANIFEST_URL = "/engine/manifest.json";
let manifestCache: EngineManifest | null | undefined;

/**
 * Probe whether a self-hosted engine release was downloaded into /public.
 * `undefined` = not probed yet, `null` = probed, absent.
 */
export async function detectSelfHostedEngine(): Promise<EngineManifest | null> {
  if (manifestCache !== undefined) return manifestCache;
  if (typeof window === "undefined") {
    manifestCache = null;
    return null;
  }
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) {
      manifestCache = null;
      return null;
    }
    manifestCache = (await res.json()) as EngineManifest;
    return manifestCache;
  } catch {
    manifestCache = null;
    return null;
  }
}

/* --------------------------- device notes ---------------------------- */

export interface DeviceNotes {
  isTouch: boolean;
  isIOS: boolean;
  /** iOS major version when isIOS, else null. */
  iosVersion: number | null;
  /** SAB (threads) unavailable on iOS < 17 — the game cannot start there. */
  sabBlocked: boolean;
}

export function detectDevice(): DeviceNotes {
  if (typeof window === "undefined") {
    return { isTouch: false, isIOS: false, iosVersion: null, sabBlocked: false };
  }
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let iosVersion: number | null = null;
  if (isIOS) {
    const m = ua.match(/OS (\d+)[_\.]/);
    iosVersion = m ? parseInt(m[1], 10) : null;
  }
  const isTouch =
    "ontouchstart" in window ||
    (window.matchMedia?.("(pointer: coarse)").matches ?? false);
  const sabBlocked = isIOS && (iosVersion === null || iosVersion < 17);
  return { isTouch, isIOS, iosVersion, sabBlocked };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
