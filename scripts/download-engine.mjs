#!/usr/bin/env node
/**
 * download-engine.mjs — pull a full release of the Luanti WASM client into
 * /public/engine so the game is served SAME-ORIGIN by this site.
 *
 * Why: the engine (minetest.js/minetest.wasm/packs) is a ~100-300 MB static
 * app produced by the community Emscripten pipeline (paradust7/luanti-wasm,
 * fork Kaesual/minetest-wasm). Hosting it ourselves makes the site
 * independent of the community mirrors at runtime and enables offline PWA
 * play. The mirrors are still the default when no local engine exists.
 *
 * Usage:
 *   node scripts/download-engine.mjs                     # default mirror
 *   node scripts/download-engine.mjs --mirror=dustlabs   # newer build
 *   node scripts/download-engine.mjs --base=https://host/path/
 *   node scripts/download-engine.mjs --out=public/engine
 *
 * Run from the repo root (Vercel build machines have internet access; this
 * sandbox may not — that's fine, the site falls back to the public mirror).
 */

import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MIRRORS = {
  // Kaesual/minetest-wasm standalone (Luanti 5.9, polished launcher).
  // Release dir name is fixed ("minetest") in their build_www.sh, but we
  // still resolve it from index.html so layout changes don't break us.
  commonground: {
    base: "https://embed.commonground.cg/standalone/minetest/",
    version: "Luanti 5.9 (Kaesual/Common Ground build)",
    // Engine files expected inside <release>/ (best-effort; 404s are skipped).
    // Paths relative to the RELEASE directory (resolved from index.html).
    engine: [
      "minetest.js",
      "minetest.wasm",
      "minetest.worker.js",
      "packs/base.pack",
      "packs/minetest_game.pack",
      "packs/voxelibre.pack",
      "packs/glitch.pack",
      "packs/blockbomber.pack",
      "packs/mineclonia.pack",
    ],
  },
  // paradust7/luanti-wasm main (newer Luanti, pack/OPFS architecture, WIP).
  dustlabs: {
    base: "https://luanti.dustlabs.io/",
    version: "Luanti 5.14+ (paradust7 build, WIP)",
    engine: [
      "luanti.js",
      "luanti.wasm",
      "worker.js",
      "xterm/xterm.js",
      "xterm/addon-fit.js",
      "packs/base.pack",
      "packs/certs.pack",
    ],
  },
};

function parseArgs() {
  const args = { mirror: "commonground", base: null, out: "public/engine" };
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([a-z-]+)=(.*)$/i) ?? raw.match(/^--([a-z-]+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2] ?? true;
    if (key === "mirror") args.mirror = value;
    else if (key === "base") args.base = value;
    else if (key === "out") args.out = value;
  }
  return args;
}

function normBase(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

/** Extract relative asset URLs (script/img/link) from a launcher HTML page. */
function extractAssets(html) {
  const out = new Set();
  const re = /(?:src|href)=["']([^"'#?]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].trim();
    if (!u || u.startsWith("http") || u.startsWith("//") || u.startsWith("data:") || u.startsWith("blob:")) continue;
    // Absolute paths (site-root) can't be mapped onto an arbitrary base.
    if (u.startsWith("/")) continue;
    out.add(u.replace(/^\.\//, ""));
  }
  return out;
}

/**
 * Find the release directory (the dir that holds the launcher script).
 * Upstream builds name it either a fixed name ("minetest") or a random
 * release UUID — both appear as the src dir of the launcher script.
 * A launcher src with no slash means the base URL already points at the
 * release directory itself.
 */
function resolveReleaseDir(html) {
  const assets = [...extractAssets(html)];
  const launcher = assets.find((a) => /launcher\.js$/i.test(a));
  if (launcher) {
    const idx = launcher.lastIndexOf("/");
    if (idx < 0) return "";
    return launcher.slice(0, idx + 1);
  }
  // No launcher script found: assume the canonical fixed name used by the
  // Kaesual build.
  return "minetest/";
}

async function fetchText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "luanti-web-engine-fetch/0.2" } });
      if (res.ok) return { text: await res.text(), status: res.status };
      if (res.status === 404) return { text: null, status: 404 };
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries) throw new Error(`GET ${url} failed after ${tries} tries: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function downloadFile(url, dest, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "luanti-web-engine-fetch/0.2" } });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      await mkdir(path.dirname(dest), { recursive: true });
      const total = Number(res.headers.get("content-length") ?? 0);
      let got = 0;
      let lastLog = 0;
      const file = createWriteStream(dest);
      for await (const chunk of res.body) {
        file.write(chunk);
        got += chunk.length;
        const now = Date.now();
        if (total > 0 && now - lastLog > 1500) {
          lastLog = now;
          process.stdout.write(`\r    ${url.split("/").pop()} ${(got / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`);
        }
      }
      file.end();
      await new Promise((r) => file.on("finish", r));
      process.stdout.write("\r    " + " ".repeat(60) + "\n");
      return got;
    } catch (e) {
      if (i === tries) throw new Error(`download ${url} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function main() {
  const args = parseArgs();
  const mirror = MIRRORS[args.mirror];
  if (!args.base && !mirror) {
    console.error(`Unknown mirror "${args.mirror}". Options: ${Object.keys(MIRRORS).join(", ")}`);
    process.exit(1);
  }
  const base = normBase(args.base ?? mirror.base);
  const outDir = path.resolve(args.out);

  console.log(`\nLuanti engine fetcher`);
  console.log(`  mirror : ${args.base ? "custom" : args.mirror}`);
  console.log(`  base   : ${base}`);
  console.log(`  out    : ${outDir}\n`);

  // 1) Launcher page → release dir + static assets referenced by it.
  const root = await fetchText(base);
  if (root.text === null) throw new Error(`launcher page not found at ${base} (404)`);
  const releaseDir = resolveReleaseDir(root.text);
  console.log(`  release dir: ${releaseDir || "<base root>"}`);

  // Engine file candidates (paths relative to the release dir): named
  // mirrors know their own; a custom base tries both naming conventions —
  // absent files are skipped, so this is safe.
  const candidates = args.base
    ? [...MIRRORS.commonground.engine, ...MIRRORS.dustlabs.engine]
    : mirror.engine;

  // Root-level assets (launcher page + everything it references) live at the
  // BASE root; engine binaries live inside the RELEASE dir.
  const toFetch = new Map(); // url -> relative path
  const add = (rel, url) => {
    if (!rel || toFetch.has(url)) return;
    toFetch.set(url, rel);
  };
  add("index.html", base + "index.html");
  for (const a of extractAssets(root.text)) add(a.split("?")[0], base + a);
  for (const f of candidates) add(`${releaseDir}${f}`, base + releaseDir + f);

  // 2) Download each file (404s on best-effort engine files are skipped).
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const manifestFiles = [];
  const skipped = [];
  for (const [url, rel] of toFetch) {
    const dest = path.join(outDir, rel);
    process.stdout.write(`  → ${rel} `);
    const size = await downloadFile(url, dest);
    if (size === null) {
      skipped.push(rel);
      console.log(`(absent, skipped)`);
      continue;
    }
    const st = await stat(dest);
    manifestFiles.push({ path: rel, sizeBytes: st.size });
  }

  // 3) Sanity checks.
  const hasIndex = manifestFiles.some((f) => f.path === "index.html");
  const wasm = manifestFiles.find((f) => f.path.endsWith(".wasm"));
  if (!hasIndex) throw new Error("no index.html downloaded — aborting, nothing written");
  if (!wasm || wasm.sizeBytes < 1_000_000) {
    throw new Error("engine .wasm missing or implausibly small — aborting");
  }

  const totalBytes = manifestFiles.reduce((a, f) => a + f.sizeBytes, 0);
  const manifest = {
    mirror: args.base ? "custom" : args.mirror,
    base,
    version: mirror ? mirror.version : "unknown (custom base)",
    downloadedAt: new Date().toISOString(),
    totalBytes,
    files: manifestFiles,
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nDone. ${manifestFiles.length} files, ${(totalBytes / 1048576).toFixed(1)} MB → ${outDir}`);
  if (skipped.length) console.log(`Skipped (404): ${skipped.join(", ")}`);
  console.log(`The site now serves the game same-origin at /engine (self-hosted mode).`);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  console.error("The site still works via the public mirror — see README.md.");
  process.exit(1);
});
