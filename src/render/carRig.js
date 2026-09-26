// The wreck in the scene: the car model (copCar.js), its red/blue strobes on BOTH sides (each side alternates
// red and blue, opposite to the other, and each flash casts shadows), the amber hazards at the front corners,
// and the pickup-spot tells. Everything hangs off one group that follows the car's pose — rammers shove it.
// A breaker can smash one side's strobe for good: that side goes dark and there's glass in the snow.
import * as THREE from 'three';
import { buildCopCar, buildShards } from './copCar.js';
import { buildCopCarModel, buildGlassModel } from './copCarModel.js';
import { onModel } from './assets.js';

function sideStrobe(cfg, side) {
  const light = new THREE.SpotLight(0xff1a1a, 0, 24, THREE.MathUtils.degToRad(82), 0.55, 1.3);
  light.position.set(0, 0.35, side * (cfg.car.halfWidth + 0.15));
  light.target.position.set(0, 0, side * 12);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.2;
  light.shadow.bias = -0.0006;
  return light;
}

// Small tells on the hull so each pickup spot is findable in the dark (car-local, so they move with it).
function buildSpots(cfg) {
  const group = new THREE.Group();
  const mk = (color, size) => new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.5 }));
  const place = (mesh, name, y) => {
    const s = cfg.spots[name];
    const inward = { x: s.face.x - s.stand.x, z: s.face.z - s.stand.z };
    const n = Math.hypot(inward.x, inward.z);
    mesh.position.set(s.face.x - (inward.x / n) * 0.05, y, s.face.z - (inward.z / n) * 0.05);
    mesh.rotation.y = Math.atan2(inward.x, inward.z);
    group.add(mesh);
    return mesh;
  };
  const radio = place(mk(0xffa020, [0.22, 0.1, 0.04]), 'radio', 0.55);      // radio display through the window
  const ammo = place(mk(0x40ff80, [0.3, 0.06, 0.04]), 'ammo', 1.05);        // trunk latch glow
  const flares = place(mk(0xff3020, [0.25, 0.08, 0.04]), 'flares', 0.6);    // flare box
  return {
    group,
    update(state, t) {
      const ph = state.radio.phase;
      radio.material.emissiveIntensity = ph === 'repair' ? (Math.sin(t * 13) > 0.6 ? 2 : 0.2) : ph === 'call' ? 1 + Math.sin(t * 4) : 2.2;
      radio.material.emissive.setHex(ph === 'repair' ? 0xff6010 : 0x30ff60);
      ammo.material.emissiveIntensity = state.player.reserve < state.cfg.pistol.maxReserve ? 1.2 + Math.sin(t * 3) * 0.5 : 0.2;
      flares.material.emissiveIntensity = state.t >= state.flareReadyAt ? 1.2 + Math.sin(t * 3 + 1) * 0.5 : 0.08;
    },
  };
}

export function createCarRig(scene, cfg) {
  const car = buildCopCar(cfg);
  const root = car.group;
  const spots = buildSpots(cfg);
  root.add(spots.group);
  scene.add(root);

  const strobes = [sideStrobe(cfg, +1), sideStrobe(cfg, -1)];
  for (const s of strobes) root.add(s, s.target);
  const shards = [buildShards(+1), buildShards(-1)];
  root.add(...shards);

  // Loaded models replace the procedural shell (the strobe lenses, hazard lamps and underside frame stay:
  // they carry the lights, and the frame is what you stand on) and the glass.
  onModel((key, gltf) => {
    if (key === 'copCar') {
      car.model.traverse((o) => {
        if (o.isMesh && !o.userData.under && !car.bars.includes(o) && !car.hazards.includes(o)) o.visible = false;
      });
      root.add(buildCopCarModel(gltf, cfg));
    } else if (key === 'glass') {
      shards.forEach((sh, i) => {
        sh.clear();
        sh.add(buildGlassModel(gltf, i === 0 ? +1 : -1));
      });
    }
  });

  // hazards: one small amber light at each front corner (no shadows — they're weak)
  const hazards = [+1, -1].map((zs) => {
    const l = new THREE.PointLight(0xff9a20, 0, 5, 1.8);
    l.position.set(cfg.car.halfLength + 0.25, 1.04, zs * 0.86);
    root.add(l);
    return l;
  });

  const RED = new THREE.Color(0xff1a1a), BLUE = new THREE.Color(0x2250ff);
  let shakeT = 0;

  return {
    onEvent(e) { if (e.type === 'car_rammed') shakeT = e.kind === 'jostle' ? 0.25 : 0.45; },
    update(state, hazardOn = null, dt = 1 / 60) {
      const t = state.t, c = state.cfg.car;
      // follow the car's pose (+ a shudder when it's hit)
      shakeT = Math.max(0, shakeT - dt);
      const sh = shakeT > 0 ? shakeT * 0.12 : 0;
      root.position.set((c.x || 0) + (Math.random() - 0.5) * sh, 0, (c.z || 0) + (Math.random() - 0.5) * sh);
      root.rotation.set((Math.random() - 0.5) * sh * 0.3, c.yaw, (Math.random() - 0.5) * sh * 0.3);

      // strobe: double-flash, then double-flash in the other colour; the two sides are always opposite
      const ph = (t % (1 / cfg.arena.strobeHz)) * cfg.arena.strobeHz;
      const pulse = (a, b) => (ph >= a && ph < b ? 1 : 0);
      const aOn = pulse(0.0, 0.12) || pulse(0.2, 0.32);
      const bOn = pulse(0.5, 0.62) || pulse(0.7, 0.82);
      const alive = state.strobes || [true, true];
      // side +1: red on A, blue on B.  side -1: blue on A, red on B.
      strobes[0].color.copy(aOn ? RED : BLUE);
      strobes[1].color.copy(aOn ? BLUE : RED);
      const on = aOn || bOn;
      strobes[0].intensity = alive[0] && on ? (aOn ? 150 : 190) : 0;
      strobes[1].intensity = alive[1] && on ? (aOn ? 190 : 150) : 0;
      for (const m of car.bars) {
        const idx = m.userData.side > 0 ? 0 : 1;
        const isRed = m.userData.red;
        const lit = isRed ? (m.userData.side > 0 ? aOn : bOn) : (m.userData.side > 0 ? bOn : aOn);
        m.material.emissiveIntensity = alive[idx] ? (lit ? 6 : 0.25) : 0;
        m.material.opacity = alive[idx] ? 0.95 : 0.35;
      }
      shards[0].visible = !alive[0];
      shards[1].visible = !alive[1];
      // hazards: all four together, in step with the relay ticking in the audio when it's playing
      const hz = (hazardOn ?? (Math.sin(t * Math.PI * 2 * 0.655) > 0)) ? 1 : 0;
      for (const l of hazards) l.intensity = hz ? 2.5 : 0;
      for (const m of car.hazards) m.material.emissiveIntensity = hz ? 5 : 0.1;
      spots.update(state, t);
    },
  };
}
