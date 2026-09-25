// The wreck in the scene: car model, the red/blue strobes on BOTH sides (each side alternates red and blue,
// opposite to the other, and each flash casts shadows), the blinking amber hazards, and the pickup-spot tells.
// There's no steady light of its own any more: the flare and the far headlights do the lighting.
import * as THREE from 'three';
import { carToWorld } from '../sim/game.js';
import { buildCar, buildSpots } from './car.js';

function sideStrobe(cfg, side) {
  const light = new THREE.SpotLight(0xff1a1a, 0, 24, THREE.MathUtils.degToRad(82), 0.55, 1.3);
  const p = carToWorld(cfg, { x: 0, z: side * (cfg.car.halfWidth + 0.15) });
  const t = carToWorld(cfg, { x: 0, z: side * 12 });
  light.position.set(p.x, 0.35, p.z);
  light.target.position.set(t.x, 0, t.z);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.2;
  light.shadow.bias = -0.0006;
  return light;
}

export function createCarRig(scene, cfg) {
  const car = buildCar(cfg);
  const spots = buildSpots(cfg);
  scene.add(car.group, spots.group);

  const strobes = [sideStrobe(cfg, +1), sideStrobe(cfg, -1)];
  for (const s of strobes) scene.add(s, s.target);

  // hazards: one small amber light at each end (no shadows — they're weak)
  const hazards = [+1, -1].map((end) => {
    const l = new THREE.PointLight(0xff9a20, 0, 5, 1.8);
    const p = carToWorld(cfg, { x: end * (cfg.car.halfLength + 0.2), z: 0 });
    l.position.set(p.x, 0.9, p.z);
    scene.add(l);
    return l;
  });

  const RED = new THREE.Color(0xff1a1a), BLUE = new THREE.Color(0x2250ff);

  return {
    update(state) {
      const t = state.t;
      // strobe: double-flash, then double-flash in the other colour; the two sides are always opposite
      const ph = (t % (1 / cfg.arena.strobeHz)) * cfg.arena.strobeHz;
      const pulse = (a, b) => (ph >= a && ph < b ? 1 : 0);
      const aOn = pulse(0.0, 0.12) || pulse(0.2, 0.32);
      const bOn = pulse(0.5, 0.62) || pulse(0.7, 0.82);
      // side +1: red on A, blue on B.  side -1: blue on A, red on B.
      strobes[0].color.copy(aOn ? RED : BLUE);
      strobes[1].color.copy(aOn ? BLUE : RED);
      const on = aOn || bOn;
      strobes[0].intensity = on ? (aOn ? 150 : 190) : 0;
      strobes[1].intensity = on ? (aOn ? 190 : 150) : 0;
      for (const [i, m] of car.bars.entries()) {
        const isRed = m.userData.red;
        const lit = isRed ? (m.userData.side > 0 ? aOn : bOn) : (m.userData.side > 0 ? bOn : aOn);
        m.material.emissiveIntensity = lit ? 6 : 0.25;
      }
      // hazards: steady 1.5 Hz blink, all four together
      const hz = Math.sin(t * Math.PI * 2 * 0.75) > 0 ? 1 : 0;
      for (const l of hazards) l.intensity = hz ? 2.5 : 0;
      for (const m of car.hazards) m.material.emissiveIntensity = hz ? 5 : 0.1;
      spots.update(state, t);
    },
  };
}
