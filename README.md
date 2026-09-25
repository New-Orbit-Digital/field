# FIELD

Third-person survival horror experiment. An overturned cop car sits in a snowy field at night, red and blue lights still flashing. Something out in the dark keeps coming for you. Stay in the light. Keep listening. Last as long as you can.

v1 is three.js in the browser. If the game holds up, it gets remade in Godot.

## Play
- **Latest build online (private to Justin):** https://claude.ai/artifact/Fu74WT52xE9PPFknEr82k2 — republished from `dist/field.artifact.html` after each change.
- **Offline:** open `dist/field.html` (single file, works offline) after `npm run build`.
- **Dev:** `npm install`, then `npm run dev` → http://localhost:8000 (rebuilds on save).
- Headphones strongly recommended. Warnings are positional audio.

Goal: fix the radio, call for help, survive until the rescue vehicle arrives. More of them come as the night goes on.

Controls: WASD move · mouse look/aim · hold right click flashlight · left click shoot · R reload · hold E at the car (radio / trunk ammo / flares) · Q throw flare · Space jump (push into the car mid-jump to climb) · Esc pause · `` ` `` debug overlay. `?seed=ABC123` replays a specific night; `?demo` runs the scripted player.

## Layout
Each file owns one thing, so a tweak touches one small module.

```
src/main.js            bootstrap + fixed-step loop (wires everything together)

src/sim/               game rules — pure logic, no DOM, runs headless under Node
  config.js            ALL tunables (speeds, timings, ranges, horde size, reload window…)
  game.js              createGame / step / runHeadless + public API re-exports
  player.js            order of operations for one player tick
  movement.js          walking, low jump, gravity, standing on / mantling onto the car
  flashlight.js        beam on/off + battery
  pistol.js            fire, recoil, reload, perfect-reload / jam
  interact.js          hold-E spots on the car (radio, trunk ammo, flares)
  flares.js            throwing + burning flares
  radio.js             rescue countdown + win
  horde.js             spawning, monster count, one-attacker-at-a-time cap
  monster.js           one monster's AI (stalk → probe → warn → lunge → climb → retreat, dodging)
  modes.js             monster state names
  perception.js        view cone, beam (with recoil waver), lit areas, deep dark
  car.js               the wreck as an oriented box + pickup spot positions
  math.js · events.js · rng.js   helpers, event log, seeded RNG
  bots.js              scripted players (tests, balance report, phone demo)

src/render/            three.js — reads sim state, never writes it
  world.js             assembles the scene and calls each rig per frame
  carRig.js / car.js   wreck model, strobe pattern, pickup-spot lights
  playerRig.js / player.js   player model, flashlight, muzzle flash, aim point
  beastPool.js / beast.js    monster views + model/animation
  flareRig.js · landmark.js · snow.js · ground.js · followCamera.js · debugRings.js · textures.js

src/audio/             procedural Web Audio (no asset files)
  index.js             sim event → sound mapping
  sounds.js            one-shot effects (growl, gunshot, reload clicks…)
  ambience.js          wind, car hum/radio, static, rescue siren
  engine.js            context, listener, positional panner

src/ui/                input.js · hud.js · screens.js · debugPanel.js · dom.js · styles.css

tests/                 headless sim tests (node --test)
tools/                 build, balance report, headless screenshots, phone demo check
```

## Commands
| Command | What it does |
|---|---|
| `npm test` | 19 headless sim tests: determinism, honest tells, attack spread/timing, dodge, car pickups, radio → rescue, reload/active reload, recoil, flares, jump/mantle/roof, horde cap, battery, deep dark |
| `npm run sim` | Balance report: defence-only survival and objective win rates for scripted players of different skill |
| `npm run build` | `dist/field.js`, single-file `dist/field.html`, and `dist/field.artifact.html` (for the claude.ai page) |
| `npm run shots` | Headless Chromium screenshots of posed scenes → `shots/` |

Tunables live in `src/sim/config.js`.
