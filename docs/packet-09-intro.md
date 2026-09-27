# Packet 09: first-load intro, fire position, extinguishers, warm-up (2026-09-27)

## Changes
- **First-load intro** (`runIntro` in `src/main.js`; `audio.intro` in `src/audio/index.js`):
  1. The title sits on black (`#blackout`), with no game scene behind it.
  2. On the player's click, the mouse is captured and everything on the title fades out except "Headphones strongly encouraged".
  3. `car-door.mp3` plays, then from 2.6 s the recorded footsteps (`monster-footsteps.mp3`) loop. The wind loop fades in under both.
  4. When at least 8 s have passed (`INTRO_MIN_MS`) and the world has finished loading and warming up (`world.ready`), the first flare strikes (procedural crunch and hiss), the black fades out over 0.8 s, and the night starts.
  5. If the player let go of the mouse during the intro, the game opens paused, so their next click captures it again.
  - Restarts (click after game over, or R) skip the intro.
  - The sandbox picker skips it too.
  - Browsers only allow sound after a real click, which is why the intro starts on the title click rather than at page load.
- **Seed** is no longer shown on the title or the game-over screen. R still replays the same seed.
- **Fire after a drag:** the flames were placed using the title screen's copy of the car (the render rigs keep that config). Now they follow the live car in `state.cfg`. The fire's light and logic already did.
- **Extinguishers are unlimited:** the trunk hands out a fresh one whenever yours is empty, not just once a night.
- **Warm-up** (`warmUp` in `src/render/world.js`): as well as compiling every material, it now uploads every texture (`renderer.initTexture`) and renders the scene once in each of 8 directions around the start position. This fixes the stutter when sweeping the camera early in a night. It runs during the intro, behind the black screen.

## Needs Justin
- `src/audio/sfx/car-door.mp3` is a binary file, so it has to be uploaded to `main` through GitHub's web page. Until it's there, the intro waits 1.5 s for it and carries on without it; the footsteps and wind still play.

## Verification (local, on top of `main` @ `f03f1f8`)
- `npm test`: 58 pass, 0 fail. New test: the trunk gives a fresh extinguisher each time yours is empty.
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run hazard-shots`: 0 errors.
- `npm run shots` (18 poses): 0 errors.
- Intro check, headless in demo mode (headless Chromium stops drawing frames while the pointer is locked, so demo mode avoids the lock):
  - No seed element on the page.
  - The title is on black.
  - 3 s after the click, only "Headphones strongly encouraged" shows. A first run showed the blinking "Click to begin" still visible, because its blink animation overrode the fade; that's fixed.
  - The night started 12.4 s after the click. Rendering in this sandbox is slow; the 8 s minimum held.
  - The overlay is hidden afterwards, and there were 0 page errors.
- Fire-after-move check: the car was moved to (4, 3) before the fire; the flames render on the car at its new position.

## Publish verification (branch `packet-09` as pushed, on top of `main` @ `f03f1f8`)
- Every code and test file on `origin/packet-09` is byte-identical to the locally verified copy. The only difference is `car-door.mp3`, which Justin uploads.
- On a clean checkout of `origin/packet-09`:
  - `npm test`: 58/58 pass.
  - `npm run build`: OK.
- `npm run pages-check` and `npm run hazard-shots` each report one error, and it's the same one both times: `car-door.mp3` isn't on the branch yet (a 404, or a failed fetch in the single-file build). There are no other errors.
  - The game handles a missing file: the intro waits up to 1.5 s for the door sound and then carries on without it.
  - The error goes away once the file is uploaded; locally, with the file present, both runs had 0 errors.
