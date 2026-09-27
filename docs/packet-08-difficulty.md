# Packet 08: difficulty, flares, whiteout wind, title controls (2026-09-26)

Round 2 supersedes round 1 where they conflict; for example, the wind now moves you on the roof too.

## Changes
- **Flares are working light, not protection.** `flares.repels = false`: monsters no longer keep out of a flare's circle, and no longer hold off attacking you inside it. The same goes for the fire's light.
  - A flare landing still startles whatever is close (`flares.landScare`).
  - The flashlight is still what drives them off.
  - Set `repels: true` to go back to the old behaviour.
- **Bolder while you work at the car.** While you're holding E at a spot, their pauses between moves are halved and they feint far less (probe chance × 0.4), so they commit.
- **Rising difficulty** (`config.difficulty`):
  - Every 30 s, one more hunter breaks off from the crowd, up to `horde.max`, whatever the radio phase.
  - Each step, pauses get 15% shorter, down to 40% of normal.
  - From 90 s in, two can attack at once.
- **Whiteout wind:** it shoves you along its direction at up to 1.1 m/s (you walk at 3.2), following the whiteout's ramp. It doesn't move you on the roof, while grabbed, or while knocked flat.
- **Health bar:** refills smoothly while you recover (the next point creeps in over 3 s), shows full for about 0.9 s, then hides. It drops immediately on a hit.
- **Title screen:**
  - The controls text is replaced by keycaps and a mouse diagram, after Justin's reference: WASD Move; mouse shoot/flashlight; Space Jump; R Reload; E Interact; Q Flare; Esc Pause.
  - The "They hate the light…" line is gone.
  - "Headphones strongly encouraged" sits under "Click to begin".

## Round 2 (after Justin played the game build)
- **All four active hazards are in a normal night** (`random: true` on each):
  - Whiteouts: random, as before.
  - Tentacle: from 30 s, as before.
  - Fire: armed from the start; after the first flare is out it rolls 1 in 6 every 10 s. It re-arms after being put out.
  - Zombie: walks in at 45 s; another comes 20 s after one dies.
  - The sandbox stays (`?hazard`). Testing one hazard switches the night's other random ones off.
- **Once help is on the way (radio phase `wait`):**
  - Monsters get bolder: pauses × 0.6, feints × 0.5.
  - Standing on the roof makes the fire's ignition roll 70% likelier (`fire.roofIgniteMult`). This is Claude's reading of "increase risk of fire by 70% while on top of the car": it applies during the wait.
- **Whiteout on the roof:** the wind now pushes you on the roof too, and if it pushes you past the edge you fall off.
- **Reload bar:** twice as tall (10 px); width unchanged.
- **Sans-serif everywhere:** the body font is the system sans stack. The title keycaps and labels use it too; the serif and monospace fonts are gone.
- **No stand-in flash on the title:** nothing is drawn until the models have settled (loaded or failed), so the old procedural character never shows before the real one.
- **First-click lag:**
  - Audio is now created, and its 20 recordings fetched and decoded, at page load rather than on the first click. The first click only resumes it.
  - Once the models load, every material is compiled up front (`renderer.compile` with everything temporarily visible), so starting a night doesn't stall on shader compiles.
- **A bug the audio preload surfaced:** the procedural hiss scheduled a negative time for sounds shorter than 1.5 s. That was harmless while audio started late, but it throws on a fresh context. It's clamped now.

## Balance check (bots; whiteouts and tentacles off, because the bots can't deal with them yet)
60 nights each, objective bot:

| Rules | Sharp bot win | Average bot win | Average bot hits taken/run |
|---|---|---|---|
| Packet 07 | 100% | 97% | 1.1 |
| Packet 08 | 100% | 93% | 2.5 |

- The bots react in 0.3–0.45 s and never mis-aim much, so they're far better than a person. The real test is play.
- With packet 07's health regen, the extra hits mostly get healed back. If it's still too easy, regen is the next lever to pull.

## Verification (round 1, local, on top of `main` @ `ea089d2`)
- `npm test`: 55 pass, 0 fail.
  - The flare test was rewritten for the new rule: the landing startles a nearby monster, and one arriving afterwards isn't spotted and does attack inside the flare.
  - New tests cover the difficulty ramp (hunters, pauses, second attacker, bolder while working) and the wind push (about 6.6 m over a whiteout, along the wind only).
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run shots` (18 poses): 0 errors.
- Preview shots (title screen, sandbox title, health bar mid-refill): 0 page errors, reviewed.

## Verification (round 2, local, on top of `main` @ `ea089d2`)
- `npm test`: 57 pass, 0 fail. New tests cover:
  - A normal night now arms the fire and brings the zombie at 45 s.
  - Roof ignition is about 1.7× during the wait, and the monsters are bolder then.
  - The wind blows you off the roof.
- `npm run build`: OK.
- `npm run pages-check`: 0 errors.
- `npm run hazard-shots`: 0 errors. This run caught the hiss bug above, and it was fixed before this pass.
- `npm run shots` (18 poses): 0 errors.
- Title check: at 150 ms the canvas is blank behind the title (no stand-in model), and once the models settle the real character shows. Audio exists at page load. 0 page errors.

## Publish verification (2026-09-26, branch `packet-08` as pushed, on top of `main` @ `ea089d2`)
- Every code and test file on `origin/packet-08` is byte-identical to the locally verified copy (`git diff` empty apart from this doc).
- On a clean checkout of `origin/packet-08`:
  - `npm test`: 57/57 pass.
  - `npm run build`: OK.
  - `npm run pages-check`: 0 errors.
  - `npm run hazard-shots`: 0 errors.
