# FIELD

Third-person survival horror experiment. An overturned cop car sits in a snowy field at night, red and blue lights still flashing, hazards blinking, engine still idling. A vehicle up on an embankment shines its headlights down on the wreck. Your breath clouds in the cold. Out past the edge of the light, a crowd of things shambles around in the dark. They hate light. One by one they break off and come for you.

v1 is three.js in the browser. If the game holds up, it gets remade in Godot.

## Play
- **Online:** https://justbost.com/field/ — GitHub Pages serves `index.html` + `src/` straight from `main` (no build step; three.js loads from the jsdelivr CDN via an import map). Every push to `main` is live.
- **Private copy on claude.ai:** https://claude.ai/artifact/Fu74WT52xE9PPFknEr82k2 (from `dist/field.artifact.html`).
- **Offline:** open `dist/field.html` (single file, works offline) after `npm run build`.
- **Dev:** `npm install`, then `npm run dev` → http://localhost:8000.
- Headphones strongly recommended. Warnings are positional audio.

Goal: fix the radio, call for help, survive until the rescue vehicle arrives. More of them hunt you as the night goes on.

How the light works: the wreck has no light of its own, only strobes and hazards. The far headlights light the area dimly. A flare lights a 9 m circle they won't enter or attack into; as it gutters out over its last 3 s, the circle shrinks with the light. One is already burning when the night starts. After that, take one from the passenger side and drop it at your feet with Q. The box never runs out, but the next flare takes 35 s to dig out. Any beam that lands on them sends them running back to the dark, unless one is already within 2 m of you mid-lunge. Shoot one and it bleeds and runs. Shoot it twice and it leaves the field for good. Bullets landing near them scare them off too. Walk out past the dim area and the crowd is right there.

Controls: WASD move · mouse look/aim · hold right click flashlight · left click shoot · R reload · hold E at the car (radio / trunk ammo / flares) · Q drop flare · Space jump (push into the car mid-jump to climb) · Esc pause · `` ` `` debug overlay. `?seed=ABC123` replays a specific night; `?demo` runs the scripted player.

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
  pistol.js            fire, recoil, reload, perfect-reload / jam, bullet impacts
  interact.js          hold-E spots on the car (radio, trunk ammo, flares + restock wait)
  flares.js            the starting flare, dropping flares at your feet, burn-out
  radio.js             rescue countdown + win
  horde.js             the crowd at the edge, hunters breaking off, one-attacker-at-a-time cap, leaving for good
  monster.js           one monster's AI (shamble → stalk → probe → warn → lunge → climb → retreat; flee the beam,
                       flares and bullet impacts; wounds; the deep-dark pack)
  modes.js             monster state names
  perception.js        view cone, beam (with recoil waver), flares, the dim area, deep dark
  car.js               the wreck as an oriented box + pickup spot positions
  math.js · events.js · rng.js   helpers, event log, seeded RNG
  bots.js              scripted players (tests, balance report, phone demo)

src/render/            three.js — reads sim state, never writes it
  world.js             assembles the scene and calls each rig per frame
  carRig.js / car.js   wreck model, red/blue strobes on both sides (shadow-casting), hazards, pickup-spot lights
  playerRig.js / player.js   player model, flashlight, muzzle flash, aim point
  beastPool.js / beast.js    monster views + model/animation, blood trails
  landmark.js          vehicle on the embankment: body, headlights + glare, light shafts, the dim shadow-casting spotlight
  ground.js            terrain, including the embankment (groundHeight is shared)
  snowMarks.js         painted snow: skid / flip / drag tracks, blood, bullet scuffs, footprints
  tracks.js            lays footprints as you and they move (boots, four-legged prints)
  puffs.js             vapour: exhaust from both cars, your breath
  impacts.js           snow and blood bursts where bullets land
  flareRig.js · snow.js · followCamera.js · debugRings.js · textures.js

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
| `npm test` | 25 headless sim tests: determinism, honest tells, attack spread/timing, fleeing the beam (and the 2 m exception), crowd scatter / nothing freezes in the beam, wounds and leaving for good, bullet scares, car pickups + flare restock, radio → rescue, reload/active reload, recoil, starting flare, dropped flares, guttering flares, jump/mantle/roof, the crowd and hunter cap, battery, deep dark |
| `npm run sim` | Balance report: defence-only survival and objective win rates for scripted players of different skill |
| `npm run build` | `dist/field.js`, single-file `dist/field.html`, and `dist/field.artifact.html` (for the claude.ai page) |
| `npm run shots` | Headless Chromium screenshots of posed scenes → `shots/` |
| `npm run pages-check` | Loads the no-build Pages version under `/field/` (CDN answered from `node_modules`) and fails on any error |

Tunables live in `src/sim/config.js`.
