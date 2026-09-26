# FIELD sound list: recorded vs stock

A running list. **Recorded** means Justin supplied the file (in `src/audio/sfx/`). **Stock** means it's synthesized in code (`src/audio/sounds.js`, `ambience.js`), a placeholder until someone records or sources a replacement.

Every recorded sound falls back to its stock version if the file is missing. To replace a stock sound, drop a file in `src/audio/sfx/` and tell Claude which row it covers; Claude wires it up and moves the row to the recorded list.

*Last updated: 2026-09-26 (packet 05 second revision). Statue and crawler are removed; the zombie is added; the tentacle now drags the car. Swarm and cold are backlogged, so their cues don't play. Rammer sounds (in the core list) no longer play in a normal night since rammers are retired. The whiteout now plays in normal nights.*

## Recorded (17 files)
| File | Plays on |
|---|---|
| `engine-loop.wav` | cop car idling, looped at the tailpipe |
| `hazard-lights.mp3` | hazard relay ticking, looped at the car |
| `monster-footsteps.mp3` | hunter footsteps, looped per moving monster (replaces the stock step patter) |
| `far-away-growl.mp3`, `far-away-growl2.mp3`, `far-away-growl3.mp3` | distant growls from the crowd |
| `passing-car-ambience.mp3` | the rare car passing on the far road |
| `growl3.mp3`, `growl4.mp3` | attack warning (short growl); rammer wind-up (growl3, pitched down); breaker smash start (growl4) |
| `growl1.mp3`, `growl2.mp3` | break-off cue (a monster leaves the crowd) |
| `monster-flee.mp3` | a monster repelled / spotted / shot |
| `flashlight-on-off.mp3` | flashlight click |
| `gunshot.mp3` | pistol shot |
| `reloading.mp3` | reload in progress |
| `reload-success.mp3` | reload done and perfect reload (pitched up) |
| `failed-reload.mp3` | reload jam |

## Stock: core game
| Sound | Plays on |
|---|---|
| wind bed | always (ambience) |
| car electrical hum + radio chatter | always, near the car (ambience) |
| radio static bursts | working the radio, radio fixed, radio called |
| rescue siren | after the call, closing in |
| heartbeat | taking a hit; rescue; death |
| thud | hit, knocked off the roof, stagger, car rammed |
| probe patter + breath | a hunter probing (snow crunches, exhale) |
| lunge crunches | a hunter's charge |
| scatter crunches | shamblers scattering from light |
| climb scrape | a monster climbing the car |
| moan | a twice-shot monster leaving for good |
| clang (hammering) | breaker hammering the light bar |
| glass + clang | lights smashed |
| charge crunches | rammer charging |
| clang + crunches | ram impact |
| dry-fire click | empty trigger pull |
| perfect-reload blip | layered on top of `reload-success` |
| ammo pickup clicks | grabbing ammo from the trunk |
| flare pickup blip | taking a flare |
| flare drop crunch | dropping a flare |
| flare hiss | a flare burning, for its full burn |
| jump / land crunches | player jump and landing; metal click landing on the car |
| mantle click | climbing onto the car |
| radio fixed / called blips | radio milestones |

## Stock: hazards (packet 05, revised), all placeholders
| Sound | Plays on |
|---|---|
| soft hiss | fire starts (smoulder) |
| roar-hiss + crunch | fire takes hold |
| short hiss | fire put out |
| thud + low clang + long hiss | car explodes (then glass + clang as the lights go) |
| thud | knocked down by the blast |
| metal click | extinguisher picked up |
| high hiss | swarm arrives (backlogged) |
| high hiss (short) | swarm scattered by a shot (backlogged) |
| scrape | tentacle appears |
| clangs | tentacle bursting a light bar (then glass + clang) |
| scrape + low clang | tentacle starts dragging the car |
| low crunch | tentacle shot |
| moan | tentacle severed |
| long low hiss | whiteout warning and wind |
| moan | zombie appears |
| thud + growl | zombie grabs you |
| crunch | each struggle (A/D) |
| short growl | zombie bites |
| crunch | zombie shoved off / shot |

## Missing entirely (no sound yet)
- Fire crackle loop while it burns; a roll of engine sputter when it catches.
- Tentacle slither loop while it creeps; metal-scraping loop while it drags the car.
- Zombie: footsteps / groaning loop while it walks.
- Extinguisher spray.
- Snow-kicking while fighting the fire.
- Whiteout: a proper howling wind loop (the placeholder is a long low hiss).
