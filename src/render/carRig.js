// The wreck in the scene: car model, the steady fill light that makes the circle,
// the red/blue strobe pattern, and the pickup-spot tells.
import * as THREE from 'three';
import { buildCar, buildSpots, makeStrobe } from './car.js';

export function createCarRig(scene, cfg) {
  const car = buildCar(cfg);
  const spots = buildSpots(cfg);
  scene.add(car.group, spots.group);

  const fill = new THREE.PointLight(0xc8d4ff, 45, cfg.arena.lightRadius + 4, 1.3);
  fill.position.set(0, 2.4, 0);
  const red = makeStrobe(0xff1a1a, +1);
  const blue = makeStrobe(0x2250ff, -1);
  scene.add(fill, red, red.target, blue, blue.target);

  return {
    update(state) {
      const t = state.t;
      // strobe: double-flash red, then double-flash blue
      const ph = (t % (1 / cfg.arena.strobeHz)) * cfg.arena.strobeHz;
      const pulse = (a, b) => (ph >= a && ph < b ? 1 : 0);
      const redOn = pulse(0.0, 0.12) || pulse(0.2, 0.32);
      const blueOn = pulse(0.5, 0.62) || pulse(0.7, 0.82);
      red.intensity = redOn ? 420 : 8;
      blue.intensity = blueOn ? 520 : 8;
      car.redMat.emissiveIntensity = redOn ? 6 : 0.3;
      car.blueMat.emissiveIntensity = blueOn ? 6 : 0.3;
      spots.update(state, t);
    },
  };
}
