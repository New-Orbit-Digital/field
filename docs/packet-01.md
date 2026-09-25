# Packet 01 — first playable

**Scope (approved 2026-09-25):** arena + car + red/blue strobe, snow/fog, 3rd-person controller & camera, monster full loop (stalk → probe → warn → commit → retreat) with positional warning audio, flashlight only, health, survival timer, debug overlay.

**Deferred to Packet 02:** pistol, flares, shove; car battery drain (shrinking light circle); escalation over time; strobe dim-half affecting the monster.

## What's in
- Monster AI in `src/sim/game.js`. It picks each move's approach angle weighted 3:1 toward angles outside the player's ~90° cone (plus the rear sliver the camera shows), so it still comes from the front sometimes. Lulls between moves are random (2.5–9 s). 30% of moves are fakeouts (probes). 20% of retreats turn into a quick follow-up attack.
- Honest tell: every real attack is preceded by a 0.9 s positional growl, and the eyes light up. Footsteps and probes use different sounds from the growl.
- Flashlight: holding the beam on a lunging monster slows it to 20% speed and repels it after 0.6 s of cumulative beam time. Holding it on a stalker for 0.45 s chases it off. The battery lasts about 20 s of beam, recharges slowly anywhere and faster at the car, and locks out at 0 until it's back to 15%.
- Player: 3 hits = death, with a knockback and 1.2 s of invulnerability after each hit.
- Audio (all procedural, no asset files): wind, car hum and radio static, monster footsteps, probe shuffles, attack growl, lunge run, repel shriek, hit thud and heartbeat, player footsteps.
