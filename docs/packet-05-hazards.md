# Packet 05: hazards (2026-09-26)

Seven new hazards, built one at a time. None of them is in a normal night yet. Scheduling them into play, and tuning, is the next pass.

## Try them
The sandbox URL `?hazard=fire,swarm` (or `?hazard=all`, or a bare `?hazard`) spawns the listed hazards at the start. Keys 1–7 spawn one at any time:

1 fire · 2 swarm · 3 tentacle · 4 cold · 5 gust · 6 statue · 7 crawler

Open the debug panel with `` ` `` to see a hazards line.

## Justin's calls
- All seven are in the build set.
- Fire ignored = the car explodes = game over.
- Statue freezes in the flashlight beam only.
- Cold at zero = slowed only, no damage.
- Tentacle grab: break free by alternating A/D, or shoot it.

## What each does (tunables in `src/sim/config.js` → `hazards`)

**Fire**
- Starts at the engine and spreads a stage every 12 s (engine → radio → trunk).
- Stage 2 blocks the radio; stage 3 blocks the trunk.
- A 45 s fuse ends in an explosion.
- Hold E at the engine (car front) to fight it:
  - With the trunk extinguisher: 3 s per stage.
  - With snow: 3× slower.
- It counts as light, so monsters keep out.
- Standing on the roof over a stage-2+ fire costs a hit and knocks you off.

**Swarm**
- Seeks your beam, then flares.
- On you: drains the battery and bites every 3 s.
- On a flare: smothers it.
- About 4 shots scatter it.

**Tentacles**
- Up to 3 at once, following your footprints. Light only halves their speed.
- A grab (it can reach the roof) drags you toward its origin. Pulled all the way in = death.
- Break free with 8 A/D alternations, or 2 shots.

**Cold**
- Body heat drains; standing still ×1.6, on the roof ×2.
- Flares, the fire and the exhaust warm you.
- Below 35 heat: aim shake. At 0: slowed ×0.55.

**Gust**
- 1.2 s warning, then 8 s of whiteout.
- Flares burn ×3 faster, the flashlight flickers, fog thickens, snow blows sideways.

**Statue**
- Moves only when it's out of your beam. Flares don't stop it.
- A touch costs a hit, then it resets far away.
- Bullets ricochet off it.

**Crawler**
- Near the hull or on the roof for 2–5 s → a 1.2 s tell (scrape, snow puff, fingers) → a lunge.
- The lunge roots you for 1 s, costs a hit, and knocks you off the roof.
- Beam on it during the tell, or step away.

## Not done (next pass or later)
- Scheduling hazards into a real night, and tuning.
- Bots and the balance report don't know about hazards.
- "Monsters bolder in a gust" isn't implemented.
- Sounds are placeholders from the procedural kit, with no recorded samples. See `docs/sounds.md` for the running list of recorded vs stock sounds.
- The crawler visual is small and hard to read.
- The tentacle mesh is rebuilt every frame. That's fine for ≤3, but revisit it if the count grows.

## Verification (2026-09-26)
- `npm test`: 43 pass, 0 fail. That's the existing 30 plus 13 hazard tests in `tests/hazards.test.mjs`, one or more per hazard covering both the threat and its counter.
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run hazard-shots`: 7 posed shots, 0 page errors, reviewed.
- `npm run shots` (existing 18 poses, regression check): 0 errors.
- All results are from the branch rebased on `main` @ `3f6a1a1`.

## Publish verification (2026-09-26, branch `hazards` as pushed)
- **Branch matches local:** every code file on `origin/hazards` is byte-identical to the tested local copy (checked with `git diff`).
- **Clean checkout of `origin/hazards`:**
  - `npm test`: 43/43.
  - Build: OK.
  - `pages-check`: 0 errors.
  - `hazard-shots`: 0 errors.
