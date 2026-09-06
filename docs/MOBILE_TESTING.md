# Mobile Testing Matrix & Manual QA

## Device matrix

| Device class | OS / browser | What to verify |
| --- | --- | --- |
| Low-end Android | Snapdragon 425-450, Chrome | 60 FPS target, controls smooth at `potato`/`low`, no OOM |
| Mid-range Android | Snapdragon 600-700, Chrome | 60 FPS default, auto tier climbs to `high` |
| High-end Android | Snapdragon 8, Chrome | `high` tier, no dropped frames, haptics |
| iPhone (SE) / older | iOS Safari | COOP/COEP, install prompt absent (manual A2HS), no vibrate fallback |
| iPhone (recent) | iOS Safari | Fullscreen via user gesture, safe-area (notch) correct |
| iPad | Safari | Landscape lock, larger touch area |
| Desktop (dev) | Chrome/Firefox/Edge | Mouse = joystick/camera; wheel zoom; quality cycling |

## Manual test checklist

### Boot & loading
- [ ] Play button appears on first load (`idle` state).
- [ ] Tap Play → loading bar advances → engine `ready` (or `demo` chip if no WASM).
- [ ] Initial load shell is fast; no white flash after first content.
- [ ] Offline reload (DevTools → Network → Offline) still shows cached UI.

### Movement & camera
- [ ] Left-half touch → joystick appears; drag → movement; release → snap back.
- [ ] Deadzone: tiny drags do nothing (no drift).
- [ ] Right-half drag pans the demo camera (or looks in the real engine).
- [ ] Two-finger pinch zoom works (and wheel zoom on desktop).
- [ ] No page scroll/zoom when interacting.

### Buttons
- [ ] Jump button triggers a jump (single-frame `jumpQueued`).
- [ ] Use/action button works; hold for continuous action doesn't spam queued.
- [ ] Inventory button toggles held state.
- [ ] Sprint/Run toggles and stays visual (pressed) until toggled off.
- [ ] Haptics fire on Android (vibration) and no-op on iOS.
- [ ] Pressed scale animation + ripple appear but don't shift layout.

### Adaptivity
- [ ] FPS chip updates live.
- [ ] `▦ tier` chip cycles high→medium→low→potato on tap.
- [ ] Lowering tier visibly reduces cost (demo slows/zooms) and recovers FPS.

### Controls customisation (⚙ settings)
- [ ] Opacity slider persists after reload (localStorage).
- [ ] Size slider persists.
- [ ] Comfortable/Competitive presets apply (Competitive = bigger + more opaque).
- [ ] Show/hide controls toggle persists.
- [ ] The controls auto-hide after idle (~6 s) and reappear on touch.

### PWA
- [ ] Add to Home Screen (Android) installs; standalone launches fullscreen.
- [ ] Orientation locked to landscape.
- [ ] Manifest icons shown; install prompt card appears on mobile (not standalone).

### Cross-browser
- [ ] Chrome Android: full feature set.
- [ ] Firefox Android: COOP/COEP, WASM instantiation.
- [ ] iOS Safari: no crash, controls work, no vibrate requirement.
- [ ] Desktop: mouse/fullscreen works.

## How to reproduce a mid-range 60 FPS measurement

1. Open the app on the target phone (or DevTools device mode with throttling).
2. Note the FPS chip. Under load (moving quickly in the demo) confirm it stays
   near 60, or that the tier auto-lowers and FPS recovers.
3. For the real engine, profile with `adb logcat` / DevTools Performance panel.
