# FIELD sound list: recorded vs stock

A running list. **Recorded** means Justin supplied the file (in `src/audio/sfx/`). **Stock** means it's synthesized in code (`src/audio/sounds.js`, `ambience.js`), a placeholder until someone records or sources a replacement.

Every recorded sound falls back to its stock version if the file is missing. To replace a stock sound, drop a file in `src/audio/sfx/` and tell Claude which row it covers; Claude wires it up and moves the row to the recorded list.

*Last updated: 2026-09-26 (packet 05, hazards branch).*

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

## Stock: hazards (packet 05), all placeholders
| Sound | Plays on |
|---|---|
| roar-hiss + crunch | fire starts / spreads |
| short hiss | fire knocked down a stage / out |
| thud + low clang + long hiss | car explodes |
| metal click | extinguisher picked up |
| high hiss | swarm arrives |
| high crunch | swarm hit by a shot |
| high hiss (short) | swarm scatters |
| scrape | tentacle appears |
| thud + scrape | tentacle grabs you |
| crunch | each struggle (A/D) |
| low crunch | tentacle shot |
| moan | tentacle severed / you broke free |
| long low hiss | gust warning and whiteout |
| scrape | statue starts moving |
| scrape + crunch | crawler tell |
| thud | crawler grab |
| growl | crawler repelled |
| metal click | bullet ricochets off the statue |

## Missing entirely (no sound yet)
- Fire crackle loop while it burns.
- Swarm buzz loop.
- Tentacle slither loop while it creeps.
- Statue: grinding while it moves (only a one-off scrape at the start).
- Cold: shivering / teeth chattering when low.
- Extinguisher spray.
- Snow-kicking while fighting the fire.
