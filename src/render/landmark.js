// The distant vehicle on the horizon — steady headlights aimed at the wreck. Lights nothing, ignores fog,
// monsters occlude it. After the radio call it drives in (setDistance).
import * as THREE from 'three';
import { glowTexture } from './textures.js';

export function buildDistantHeadlights(bearing) {
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
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshBasicMaterial({ map: halo, transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.05, 1.5);
  group.add(pool);
  return {
    group,
    setDistance(d) {
      group.position.set(Math.sin(bearing) * d, 0, Math.cos(bearing) * d);
      group.scale.setScalar(Math.max(0.5, Math.min(1, d / 50))); // closer → smaller glow so it doesn't bloom out
    },
  };
}
