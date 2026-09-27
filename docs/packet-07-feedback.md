# Packet 07: playtest feedback round (2026-09-26)

Built locally over three rounds of feedback, then published. Later rounds supersede earlier ones where they conflict (e.g. the health display and ammo).

## Hazards
- **Whiteout:**
  - Timing: the first comes 3–25 s in, then one every 25–50 s. That's no long wait, and much more often than before.
  - Sound: its own loop, `whiteout.mp3` (Justin's), fades in with the blow and out after.
  - The rapid clicking was the flashlight's on/off sound firing on every flicker. Fixed: clicks now follow only what the player does. A test covers it.
- **Tentacle:**
  - It's now part of a normal night: the first comes at 30 s. Once one is driven off, there's a 1-in-6 chance every 10 s for the next.
  - Sound: `glass-breaking.mp3` (Justin's) plays when a light bar goes, instead of the clangs.
- **Zombie:**
  - Half speed (0.65 m/s).
  - Two hits knock it down; while down, every 5 s there's a 1-in-6 chance it gets back up.
  - Two more hits (standing or down) and it's dead. Another comes in from the edge 20 s later.
- **Sandbox isolation:** testing one hazard turns off the night's random whiteouts and tentacles, unless that hazard is the one being tested.

## General
- **Audio:**
  - Engine loop +40%.
  - `wind-ambience.mp3` (Justin's) loops all night, under the whiteout too. It replaces the synthesized wind bed.
  - Footsteps: the monster footstep loops measured speed per render frame, so on fast monitors most frames read "stopped". They also never faded at death, so they suddenly became audible then. Now speed is measured per sim step, and the loops fade out at game over.
- **Player animation:** the same per-frame speed problem flipped the model between idle and run every frame. Velocity is now measured per sim step and smoothed (0.12 s).
- **Interaction prompts:** they now hover over the car spot, larger and shorter ("[E] Flare", "[E] Fix radio", "[E] Ammo", "[E] Call for help"). The progress bar sits under the prompt.
- **Aim dot:** 1.5× larger.
- **Battery and ammo:** while aiming (right mouse held), reloading or just after a shot, a 5-step battery icon and 6 ammo dots (filled = loaded, hollow = spent) show above the player's head. The bottom-left flashlight meter, the ammo counter and the "PISTOL" label are gone. Reserve ammo is never shown; the trunk still refills up to 18.
- **Health:**
  - The life pips are gone. The screen edges pulse red when you're hurt, harder at 1 health.
  - After 6 s without damage you regain one hit every 3 s, up to full. (This rule is Claude's reading of "not damaged for a bit will heal it back up".)

## Round 2 (same day, local)
- **Health:** the pulsing red screen edge is gone; it was a full-screen animated shadow and slowed the game down. There is now a red health bar under the player's feet, shown only while below full. Regen is unchanged.
- **Battery / ammo box:** a black box beside the player's head, on the left. The active-reload meter moved into it, under the 6 dots; the aim dot is just the dot now.
- **Whiteout:** peak is 20% lower (`gust.peak = 0.8`). Intensity now ramps up over 3 s, holds, and ramps down over the last 3 s of a 9 s blow; flicker and flare burn scale with it.
- **Clipping through the car on a hit:** the knockback used to jump 1.6 m in one step, which could land inside or past the hull. It now slides in 0.1 m steps and stops at the hull.
- **Ammo:** unlimited. There's no reserve, and the trunk is no longer an ammo spot; it only has the extinguisher during a fire. You can reload any time the gun isn't full.
- **Tentacle stomp:** get within 1.1 m of any part of it and press E. It lets go and retracts, the same as being shot loose. The "[E] Stomp" prompt hovers over it, and that press doesn't also trigger a car spot.

## Round 3 (same day)
- **Battery / ammo:** the box around them is gone. The icons are outlined with a black drop-shadow so they read on snow.
- **Reload meter:** back under the aim dot.
- **Aiming (all three fixes):**
  - **Dot on the real hit:** the dot now sits on whatever the shot would hit, using the same code path as the shot itself (`aimTarget` in `src/sim/pistol.js`). The over-the-shoulder camera made a dot at a fixed 12 m drift off anything nearer or farther.
  - **Recoil:** kick and max halved (0.022 / 0.045 rad); it settles 2.5× faster (0.3 rad/s).
  - **Aim assist:** +3° on the hit cone (`pistol.aimAssist`). The "bullets scare" test's bystander moved 1 m so it's still a miss.
- **Top of the screen is clear:** no timer, objective, hazard line, toasts, or sandbox tag. The sandbox keys are listed in the picker instead.
- **Rescue progress:** the radio prompt's bar tracks the whole rescue: repair, then the call, then "Help is coming" filling until help arrives. It shows whenever you're at the radio.

## Verification (local, on top of `main` @ `d81e5d3`)
- `npm test` (after round 3): 53 pass, 0 fail. Round 2 adds tests for the stomp and for unlimited ammo; the trunk-pickup test now asserts that no ammo comes from the trunk.
  - Core monster tests run with the random hazards off, because the bots don't know about hazards yet.
  - New tests cover: zombie knockdown, get-up, death and respawn; the tentacle schedule and roll; early and frequent whiteouts; health regen; no flicker clicks.
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run hazard-shots`: 0 errors.
- `npm run shots` (18 poses): 0 errors.
- UI preview shots (aiming HUD, hover prompts, damage edges, whiteout, zombie down): 0 page errors, reviewed.
- Round 3 preview shots (dot on a target with the reload bar under it, rescue bar at the radio): reviewed, 0 page errors.

## Publish verification (2026-09-26, branch `packet-07` as pushed, on top of `main` @ `d81e5d3`)
- Every file on `origin/packet-07`, including the three MP3s Justin uploaded, is byte-identical to the locally verified copy (checked with `git diff` and `cmp`). The only exceptions were this doc and `docs/sounds.md`, before they were pushed.
- One late fix went in before this check: the monster-footsteps timer now resets when a new night starts. Without it, footsteps went silent after a restart.
- On a clean checkout of `origin/packet-07`:
  - `npm test`: 53/53 pass.
  - `npm run build`: OK.
  - `npm run pages-check`: 0 errors.
  - `npm run hazard-shots`: 0 errors.
