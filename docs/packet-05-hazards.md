# Packet 05: hazards (second revision, 2026-09-26)

**Active:** fire, tentacle, whiteout, zombie.
**Backlogged:** swarm, cold. Their code and tests are kept; they're just out of the sandbox.

**What reaches a normal night:**
- Random whiteouts. The first comes 45–90 s in, then one every 60–120 s.
- Rammers are retired; the tentacle replaces them.

Everything else is tested one at a time in the sandbox until it's scheduled and tuned.

## Test them one at a time
- **Sandbox picker:** `?hazard` shows a picker on the title screen: Fire · Tentacle · Whiteout · Zombie · Normal night.
- **Direct:** `?hazard=fire` (etc.) skips the picker.
- **Keys 1–4 in play** spawn another: fire · tentacle · whiteout · zombie. Fire from the key catches straight away, skipping the roll.
- **Isolation:** testing one hazard turns off that night's random whiteouts, unless the whiteout is the one being tested.
- **Offline builds:** set `window.FIELD_SANDBOX = true` to get the picker without a URL parameter.

## Active hazards (tunables in `src/sim/config.js` → `hazards`)

**Fire**
- Can only start once the first flare is out. After that, every 10 s there's a 1-in-6 chance it catches (Justin's call).
- It smoulders for 2 s, then burns at the engine. It doesn't spread and blocks nothing.
- Explosion risk grows with burn time: about 22% by 15 s and 63% by 30 s.
- The explosion kills the car's lights for good. If you're within 4 m or on the roof, you're also knocked down for 1.5 s, take a hit, and your flashlight is smashed.
- Counter: hold E at the engine. It takes 3 s with the trunk extinguisher, 9 s kicking snow.
- While it burns it's light, so monsters keep out.

**Tentacle** (unchanged, Justin's favourite)
- Creeps to the car; light slows it.
- Bursts both light bars, 1.6 s each.
- Then hauls the car toward the dark. If the car ends up 7 m from where it started, it's lost and you die.
- Two shots sever it.

**Whiteout** (random in a normal night)
- A 1.2 s warning, then 8 s of wind from one direction.
- The field snow triples, and a dense close layer of flakes fills the air around you. All of it is driven hard in surges, with no fog change.
- Flares burn ×3 faster and the flashlight flickers.

**Zombie** (keep working on it)
- Walks at you at 1.3 m/s, even in the beam.
- It grabs you, including off the roof. Shove it off with 6 A/D alternations within 2.5 s, or it bites: a hit, then it lets go.
- A shove knocks it back 4 m and it staggers.
- A bullet staggers it for 0.8 s. It never dies.
- Uses packet 06's `zombie.glb` once it loads, with placeholder boxes until then.

## Backlog
- **Swarm:** the aesthetic works; the mechanic (any shot scatters it) felt silly.
- **Cold:** annoying.

## Integration with packet 06 (real models, merged to `main` as PR #5)
- Built on `main` @ `e8d8928`, which already included the first hazards version.
- `tools/model-shots.mjs` and `tools/screenshots.mjs`: the rammer poses now convert a hunter, since rammers are retired from the crowd.
- Hooks for the visuals work:
  - Knocked down: `player.held === 'down'`, with events `knocked_down` / `got_up`.
  - Zombie state: `walk | grab | stagger`.
  - Tentacle state: `creep | smash | drag | retract`.

## Not done yet
- Scheduling fire, tentacle and zombie into a normal night, and tuning.
- Bots and the balance report don't know about hazards.
- Sounds are placeholders; see `docs/sounds.md`.

## Verification (2026-09-26, second revision, on top of `main` @ `e8d8928`)
- `npm test`: 47 pass, 0 fail. That includes:
  - Fire: catches only after the first flare, with the first roll at 10 s.
  - Fire: the 1-in-6 statistics hold over 300 runs.
  - Normal night: random whiteouts only, at least 60 s apart, and no rammers.
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run hazard-shots`: the picker plus fire, tentacle, whiteout and zombie. 0 errors, reviewed.
- `npm run model-shots`: all models loaded, 0 errors.
- `npm run shots` (18 poses, regression check): 0 errors.

## Publish verification (2026-09-26, branch `hazards-v2` as pushed, on top of `main` @ `e8d8928`)
- Every code, test and tool file on `origin/hazards-v2` is byte-identical to the locally verified copy (`git diff` shows only this doc and `docs/sounds.md` before they were pushed).
- On a clean checkout of `origin/hazards-v2`:
  - `npm test`: 47/47 pass.
  - `npm run build`: OK.
  - `npm run pages-check`: 0 errors.
  - `npm run hazard-shots`: 0 errors.
