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
import { buildSnow } from './snow.js';
import { createFollowCamera } from './followCamera.js';
import { buildDebugRings } from './debugRings.js';

export function createWorld(canvas, cfg) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.resize(w, h);
  }

  function onEvent(e) {
    cam.onEvent(e);
    playerRig.onEvent(e);
    beasts.onEvent(e);
    impacts.onEvent(e);
    if (e.type === 'wounded' || e.type === 'fled_for_good') marks.blood(e.pos.x, e.pos.z, 0.1, 6);
  }

  function update(state, view, dt) {
    carRig.update(state);
    const py = playerRig.update(state, view, dt);
    beasts.update(state, dt);
    flares.update(state, dt);
    impacts.update(dt);
    marks.update(dt);
    landmark.setDistance(state.radio.rescueDist); // parked on the horizon until called, then drives in
    snow.update(dt, state.player.pos);
    cam.update(state, view, py, dt);
    debugRings.visible = view.debug;
    renderer.render(scene, cam.camera);
  }

  // Screen position (px) of where the gun/flashlight is pointing, for the aim dot.
  function aimScreen() {
    const p = playerRig.aimPoint.clone().project(cam.camera);
    return { x: (p.x + 1) / 2 * canvas.clientWidth, y: (1 - p.y) / 2 * canvas.clientHeight, visible: p.z < 1 };
  }

  resize();
  function reset() { beasts.reset(); marks.reset(); }

  return { renderer, scene, camera: cam.camera, update, resize, onEvent, reset, aimScreen };
}
