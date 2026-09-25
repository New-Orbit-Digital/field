// The vehicle up on the embankment: steady headlights aimed at the wreck. They dimly light the play area
// (casting long shadows back toward you), and it's the way home — after the radio call it drives in (setDistance).
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { groundHeight } from './ground.js';

export function buildDistantHeadlights(cfg) {
  const bearing = cfg.arena.landmarkBearing;
  const group = new THREE.Group();
  group.rotation.y = bearing + Math.PI;
  const core = glowTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,250,235,0.95)'], [0.4, 'rgba(255,240,210,0.25)'], [1, 'rgba(255,230,200,0)']]);
  const halo = glowTexture([[0, 'rgba(255,240,215,0.35)'], [0.5, 'rgba(255,230,200,0.08)'], [1, 'rgba(255,230,200,0)']]);
  const mat = (map, opacity) => new THREE.SpriteMaterial({ map, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  for (const side of [-0.8, 0.8]) {
    const c = new THREE.Sprite(mat(core, 1));
    c.scale.set(2.8, 2.8, 1);
    c.position.set(side, 0.75, 0);
    const h = new THREE.Sprite(mat(halo, 0.9));
    h.scale.set(12, 12, 1);
    h.position.set(side, 0.75, 0);
    group.add(c, h);
  }
  const streakTex = glowTexture([[0, 'rgba(255,245,225,0.55)'], [0.35, 'rgba(255,240,215,0.12)'], [1, 'rgba(255,235,210,0)']]);
  const streak = new THREE.Sprite(mat(streakTex, 0.8));
  streak.scale.set(22, 1.1, 1);
  streak.position.set(0, 0.75, 0);
  group.add(streak);

  // the light itself: one wide, dim beam over the whole play area, with shadows
  const beam = new THREE.SpotLight(0xdfe6ff, 2.6, 0, THREE.MathUtils.degToRad(19), 0.55, 0);
  beam.castShadow = true;
  beam.shadow.mapSize.set(2048, 2048);
  beam.shadow.camera.near = 2;
  beam.shadow.camera.far = 90;
  beam.shadow.bias = -0.0004;
  beam.shadow.normalBias = 0.03;
  beam.target.position.set(0, 0, 0);

  return {
    group,
    lights: [beam, beam.target],
    setDistance(d) {
      const x = Math.sin(bearing) * d, z = Math.cos(bearing) * d;
      const y = groundHeight(x, z);
      group.position.set(x, y, z);
      group.scale.setScalar(Math.max(0.5, Math.min(1, d / 50))); // closer → smaller glow so it doesn't bloom out
      beam.position.set(x, y + 0.8, z);
      // wide enough to cover the play area from wherever it is
      beam.angle = Math.min(1.2, Math.atan2(cfg.arena.darkRadius + 4, d));
      beam.intensity = 2.6 * Math.min(2.2, (50 / d) ** 0.8);
    },
  };
}
