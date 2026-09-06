# Advanced Thinking — future roadmap

The brief's "advanced thinking requirements", mapped to concrete plans. Each is
either implemented, stubbed, or delegated to the external engine build.

## 1. Scalability & multiplayer

- **Vercel cannot host a multiplayer game server.** The correct split:
  - **Vercel** = frontend, static WASM, PWA. Stateless.
  - **Proxy/room server** = terminates WebSocket/WebTransport and forwards
    UDP to the Luanti server (this is how `paradust7/luanti-wasm` works).
  - **Luanti game server** = authoritative world simulation.
- **P2P option:** two browsers can host a server in one tab (`p2p gaming` in the
  Kaesual fork) and a second browser joins via the proxy — no dedicated server
  needed for small groups.
- **WebRTC / WebTransport:** all are candidates to carry the UDP payload with
  lower overhead than WebSocket. WebTransport (HTTP/3) is the best match for
  real-time; requires a host supporting it.

## 2. Asset pipeline

- **CDN strategy:** assets (textures, models, games) on a CDN with immutable
  hashed URLs; Vercel already fronts a CDN.
- **Streaming**: `WebAssembly.instantiateStreaming` + `fetch` for the `.wasm`.
- **Game packs:** download game packs (e.g. VoxeLibre) on demand rather than
  bundling everything into `.data`; `Content-Disposition` + hash cache-busting.
- **Progressive assets:** start with low-res placeholders, upgrade as they stream.

## 3. Cross-browser support

| Feature | Chrome | Firefox | Safari iOS |
| --- | --- | --- | --- |
| SharedArrayBuffer (threads) | ✅ | ✅ | ✅ (with COOP/COEP) |
| WebTransport | ✅ | ✅(partial) | ✅(recent) |
| `navigator.vibrate` | ✅ | ✅ | ❌ (guarded) |
| Fullscreen | ✅ | ✅ | ✅ (in WebView, with gesture) |
| Offline (SW) | ✅ | ✅ | ✅ (non-private) |

Provide feature-detection fallbacks for any missing API (the code already guards
`vibrate`, fullscreen, Pointer Events capture).

## 4. Accessibility

- Touch targets ≥ 44×44 px (our buttons are 54–72 px). ✔
- Sufficient contrast (HUD uses high-contrast chips; text on translucent
  surfaces). ✔
- Semantic labels (`aria-label`) on controls; `role="dialog"` on settings. ✔
- Consider a "text scaling" toggle; add support for reduced-motion (disable
  ripple/parallax).
- Color-blind-safe palette for terrain / UI indicators: add a daltonize preset.

## 5. Analytics & monitoring

- **Error monitoring:** Sentry (`@sentry/nextjs`), capture WASM/runtime errors
  and client exceptions.
- **Perf telemetry:** send `fps`, `frameMs`, `qualityTier`, `memory` (via
  `performance.memory` where available) with beacon sendBeacon to avoid blocking.
- **User behaviour:** play session length, world start, crashes, control-preset
  usage.

## 6. Security & anti-cheat

- **Input validation:** never trust client-side numbers; the server validates
  all player/inventory packets (authoritative server).
- **Anti-cheat:** Lua mods and client are user-modifiable; keep server
  authoritative, rate-limit, and audit network saves.
- **XSS/CSP:** Next.js is hardened by default; add a strict CSP (the WASM build
  needs `'wasm-unsafe-eval'` for `WebAssembly.instantiate` if enabled).
- **Cross-origin:** the proxy/server must validate origins and use tokens so
  strangers can't join your game.

## 7. State management / cloud save

- **On-device:** `localStorage` for control preferences (implemented) and the
  engine's `IndexedDB` for world/config (upstream fork does this).
- **Cloud sync:** upload world save to a backend (Vercel function storing to a
  Blob store / KV, or a dedicated DB) and sync across devices. Needs custom
  conflict resolution (last-writer-wins is insufficient for block edits).
- **Auth:** consider a lightweight login (e.g. a phone/email + token) to namespace
  saves and allow cross-device resume.

## 8. Build optimisation

- **Code splitting / dynamic import:** load the engine loader and heavy
  dependencies only when the user taps Play (already the case — `wasmLoader` is
  pulled in at runtime).
- **Tree-shaking:** the wrapper only imports what it uses; third-party deps are
  minimal (React/Next only).
- **Asset inlining:** inline the tiny demo/game bootstrap rather than shipping
  extra requests.
- **Source maps:** strip for prod; keep in Sentry.

## Prioritisation (Must/Should/Nice)

**Must-have (done / requested):**
- ✅ WASM client loader with engine seam
- ✅ Basic game functionality (real engine when present; demo otherwise)
- ✅ Responsive virtual controls
- ✅ Vercel deployment config

**Should-have:**
- ✅ Performance optimisations (adaptive quality, culling, budget)
- ✅ PWA features (install, offline, fullscreen, orientation)
- ✅ Mobile-specific UI/UX
- ✅ Asset optimisation config (immutable cache, compression notes)

**Nice-to-have (roadmap):**
- ☐ WebTransport proxy + dedicated server hosting off-Vercel
- ☐ Cloud save + auth
- ☐ Sentry/telemetry
- ☐ CSP + anti-cheat hardening
- ☐ Texture compression (Basis/ASTC) in the engine build
