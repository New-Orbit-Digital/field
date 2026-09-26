# Packet 06: real models, dark and gritty (2026-09-26)

Justin's asset folder replaces the procedural stand-ins. The sim is untouched: every change is in `src/render/`, so the game plays exactly as before.

## Justin's calls
- **Monster kinds:**
  - Spider = hunters.
  - Mantis = breakers.
  - Centipede = rammers.
  - Zombies shamble in the far-off crowd at the edge of the dark.
- **Player:** the Soldier model replaces the civilian and holds the pistol model.
- **Grit:** all enemies are dark and gritty, not colourful. The cop car and the dead trees are roughed up to match.
- **Branch:** built on top of `hazards` (PR #4), so both land together.

## What's in
- **Models:** `src/render/models/`, 9 `.glb` files. The originals are unchanged apart from renames: no spaces in the names. The soldier is the one conversion (below). The source FBX is in `assets/source/`.
- **Loading (`assets.js`):**
  - Every rig starts procedural and swaps to its model when the file loads.
  - A missing file leaves the old look in place.
  - On the site the files load next to the module. The single-file builds inline them as data URLs, the same way as the sfx.
  - `?models=0` turns models off.
- **Grit (`GRIT` in `assets.js`):**
  - Colours are re-done at load time: desaturated, pulled toward a dirty tint, darkened, and mottled per vertex.
  - Textures (cop car, centipede) get grime speckle and blotches, with nearest filtering for the PS1 look.
  - Monsters use matte (Lambert) materials and stay nearly as dark as the old procedural ones. With a standard material or a lighter colour, the flashlight's sheen washed them out to tan or bone-white in the beam. That's checked in `shots/models-*`.
- **Monsters (`beastModels.js`):**
  - Each model is scaled, faced forward and set on the snow. Beast.js still drives movement, posture, flinch, head tilt and the eyes.
  - Each model has two eye dots that glow when it comes for you and shine back in your beam, the same tell as before.
  - **Spider:** real animation clips. Walk is sped to match its ground speed. It plays Attack while warning, lunging or climbing, and Idle otherwise.
  - **Mantis:** a single rigid piece, so it lurches, sways and hammers (a fast pitch) when smashing the lights.
  - **Centipede:** its body ripples sideways as it moves, a vertex wave paced by its gait. It rears and twitches while winding up a ram.
- **Zombies (`scenery.js`):**
  - 7 zombies shamble among the crowd, 20–30 m out.
  - **Visual only:** the sim doesn't know they exist, so they never attack and don't change balance.
  - If your beam catches one, it turns and shuffles about 7 m further out, then drifts back.
- **Dead trees (`scenery.js`):** 26 trees from the pack's variants, 25–51 m out, never on the line to the far headlights.
- **Cop car (`copCarModel.js`):**
  - Flipped onto its roof and fitted to the sim's car: 4.75 m long, floor at the 1.62 m you stand on.
  - The source car is a bit low for that, so it's stretched ~1.3× vertically.
  - The procedural strobe lenses, amber hazards and underside frame stay. They carry the lights.
  - Paint: salt, mud and grime on the texture. The whites are now a dirty grey.
- **Smashed glass:** the glass model replaces the procedural shards when a breaker kills a light bar. Clear, red and blue pieces.
- **Player (`soldier.js`):**
  - Clips: Idle_Gun, Idle_Gun_Pointing (light on / just fired), Walk / Run, Run_Back, Run_Left / Right (strafing), Run_Shoot (moving with the light on).
  - Idle_Gun_Shoot plays on a shot, HitRecieve on a hit, and Death when you die.
  - There are no reload or climbing clips, so Interact (hands working) covers radio repair, reloading and mantling onto the car.
  - The pistol model is in her right hand. A procedural torch is in her left hand, and its lens lights up with the beam.
- **Soldier conversion (`tools/convert-soldier.mjs`):**
  - FBX → GLB with three's own loader and exporter.
  - Merges ~340 material groups into 11 meshes, so far fewer draw calls.
  - Keeps the 12 clips used.
  - 8.0 MB → 2.8 MB. Re-running it gives a byte-identical file.

## Not done / known limits
- The mantis, centipede and zombie have no rigs, so their legs don't step. The motion is the lurch, ripple and sway described above.
- The zombies are scenery. Making them a real threat is a sim change and a balance question.
- She reloads with the Interact clip, not a proper reload animation.
- Size: the offline single file is now ~8.3 MB (the models are inlined). The site loads the models separately (~4.5 MB total, mostly the soldier).

## Verification (2026-09-26, on this branch)
- `npm test`: 43/43 pass. The sim is untouched.
- `npm run build`: OK. `dist/field.html` 8332 KB.
- `npm run pages-check` (served under `/field/`, like the site):
  - `three`, `GLTFLoader`, `BufferGeometryUtils` and `SkeletonUtils` all came through the import map.
  - All 9 models loaded, the sim ran live, 0 page or console errors.
- `npm run shots`: all 18 poses, all 9 models loaded, 0 errors.
- `npm run hazard-shots`: 7 shots, 0 errors.
- `npm run model-shots`: each kind alone in the beam, the player, the wreck and the zombies at the edge. All 9 models loaded, 0 errors. Reviewed by eye.
- `node tools/convert-soldier.mjs` reproduces `models/soldier.glb` byte for byte (sha256 `a8fa28ca…`).
- **Not verified:** frame rate and look on a real GPU. Headless runs use SwiftShader.
