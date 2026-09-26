// three.js world for FIELD: assembles the scene from the rigs below and updates them from sim state
// each frame. Reads sim state; never writes it. To tweak one piece, edit its own module.
import * as THREE from 'three';
import { buildGround } from './ground.js';
import { createCarRig } from './carRig.js';
import { createPlayerRig } from './playerRig.js';
import { createBeastPool } from './beastPool.js';
import { createFlareRig } from './flareRig.js';
import { buildDistantHeadlights } from './landmark.js';
import { createSnowMarks } from './snowMarks.js';
import { createImpacts } from './impacts.js';
import { createPuffs, createExhaust } from './puffs.js';
import { createTracks } from './tracks.js';
import { carToWorld, carDirToWorld, forward } from '../sim/game.js';
import { buildSnow } from './snow.js';
import { createFollowCamera } from './followCamera.js';
import { buildDebugRings } from './debugRings.js';
import { createHazardRig } from './hazardRig.js';
import { psxEnabled, installVertexSnap, createPsxPass } from './psx.js';
import { loadModels, loadedModels } from './assets.js';
import { createScenery } from './scenery.js';

export function createWorld(canvas, cfg) {
  const psxOn = psxEnabled();
  if (psxOn) installVertexSnap(); // before any material compiles
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !psxOn, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const psx = psxOn ? createPsxPass(renderer) : null;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  scene.fog = new THREE.FogExp2(0x03050a, 0.07);
  scene.add(new THREE.HemisphereLight(0x1a2640, 0x050505, 0.1));
  scene.add(buildGround(cfg));
  const marks = createSnowMarks(cfg);   // tyre tracks + blood trails
  scene.add(marks.mesh);

  const carRig = createCarRig(scene, cfg);
  const playerRig = createPlayerRig(scene, cfg);
  const beasts = createBeastPool(scene, marks);
  const flares = createFlareRig(scene, cfg);
  const impacts = createImpacts(scene, marks);
  const landmark = buildDistantHeadlights(cfg);
  const snow = buildSnow();
  const debugRings = buildDebugRings(cfg);
  scene.add(landmark.group, ...landmark.lights, snow.points, debugRings);
  const cam = createFollowCamera();
  const hazardRig = createHazardRig(scene, cfg);
  const scenery = createScenery(scene, cfg);   // dead trees + zombies at the edge (once their models load)
  const modelsReady = loadModels();              // every rig starts procedural and swaps as models arrive

  // vapour: both engines idling, and your breath in the cold
  const puffs = createPuffs(scene);
  const copExhaust = createExhaust(puffs, { rate: 3, speed: 0.45, size1: 0.8, alpha: 0.6 });
  const truckExhaust = createExhaust(puffs, { rate: 4, speed: 0.6, size1: 1.3, alpha: 0.6 });
  // the cop car's tailpipe: under the rear bumper, which is now up by the upturned chassis (follows the car)
  const copPipe = new THREE.Vector3(), copDir = new THREE.Vector3();
  const truckPipe = new THREE.Vector3(), truckDir = new THREE.Vector3();
  let breathT = 1.5, lastHitT = -99;
  const tracks = createTracks(marks);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.resize(w, h);
    psx?.resize(w, h);
    // three sizes points against the canvas, not the render target, so shrink them to match the low-res pass
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    snow.points.material.size = psx ? 0.06 * psx.target.height / buf.y : 0.06;
  }

  function onEvent(e) {
    cam.onEvent(e);
    carRig.onEvent(e);
    playerRig.onEvent(e);
    beasts.onEvent(e);
    impacts.onEvent(e);
    if (e.type === 'hit') lastHitT = e.t;
    if (e.type === 'wounded' || e.type === 'fled_for_good') marks.blood(e.pos.x, e.pos.z, 0.1, 6);
  }

  function update(state, view, dt) {
    carRig.update(state, view.hazardOn, dt);
    const py = playerRig.update(state, view, dt);
    beasts.update(state, dt);
    scenery.update(state, dt);
    flares.update(state, dt);
    impacts.update(dt);
    tracks.update(state);
    marks.update(dt);
    landmark.setDistance(cfg.arena.landmarkDistance); // your car, parked up on the bank (the rescue is just a timer for now)
    const cp = carToWorld(state.cfg, { x: -cfg.car.halfLength - 0.1, z: 0.45 });
    const cd = carDirToWorld(state.cfg, { x: -1, z: 0 });
    copPipe.set(cp.x, 1.58, cp.z); copDir.set(cd.x, 0, cd.z);
    copExhaust.update(dt, copPipe, copDir);
    landmark.tailpipe(truckPipe, truckDir);
    truckExhaust.update(dt, truckPipe, truckDir);
    breathe(state, view, py, dt);
    puffs.update(dt, cam.camera);
    const gust = hazardRig.update(state, dt);
    snow.update(dt, state.player.pos, gust);
    cam.update(state, view, py, dt);
    debugRings.visible = view.debug;
    if (psx) psx.render(scene, cam.camera);
    else renderer.render(scene, cam.camera);
  }

  // Your breath: a small cloud every few seconds — quicker when you're moving, fast and ragged after a hit.
  function breathe(state, view, py, dt) {
    const P = state.player;
    if (!state.alive && !state.won) return; // no breath after death
    breathT -= dt;
    if (breathT > 0) return;
    const shaken = state.t - lastHitT < 8 || P.health <= 1;
    breathT = shaken ? 1.1 + Math.random() * 0.4 : view.moving ? 1.8 + Math.random() * 0.5 : 3 + Math.random() * 1.2;
    const f = forward(P.yaw);
    const at = new THREE.Vector3(P.pos.x + f.x * 0.28, py + 1.72, P.pos.z + f.z * 0.28);
    for (let i = 0; i < 3; i++) {
      const v = new THREE.Vector3(f.x * (0.45 + Math.random() * 0.2), -0.05 + Math.random() * 0.08, f.z * (0.45 + Math.random() * 0.2));
      puffs.spawn(at.clone().addScaledVector(v, i * 0.05), v, { life: 1.4 + Math.random() * 0.5, size0: 0.05, size1: 0.45, alpha: 0.7 });
    }
  }

  // Screen position (px) of where the gun/flashlight is pointing, for the aim dot.
  function aimScreen() {
    const p = playerRig.aimPoint.clone().project(cam.camera);
    return { x: (p.x + 1) / 2 * canvas.clientWidth, y: (1 - p.y) / 2 * canvas.clientHeight, visible: p.z < 1 };
  }

  resize();
  function reset() { beasts.reset(); marks.reset(); tracks.reset(); hazardRig.reset(); scenery.reset(); }

  return { renderer, psx: psxOn, scene, camera: cam.camera, update, resize, onEvent, reset, aimScreen, modelsReady, loadedModels, playerRig, scenery };
}
