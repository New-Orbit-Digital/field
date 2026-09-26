// All monsters in the scene: one view per sim monster (the crowd and the hunters), removed when one leaves for good.
import * as THREE from 'three';
import { animateBeast, buildBeast } from './beast.js';

export function createBeastPool(scene, marks) {
  const beasts = new Map(); // id -> view
  const group = new THREE.Group();
  scene.add(group);
  return {
    onEvent(e) {
      const v = e.id != null ? beasts.get(e.id) : null;
      if (v && (e.type === 'repel' || e.type === 'shot_hit' || e.type === 'spotted' || e.type === 'scatter')) v.flinch = 0.45;
    },
    reset() {
      for (const v of beasts.values()) group.remove(v.group);
      beasts.clear();
    },
    update(state, dt) {
      const alive = new Set();
      for (const m of state.monsters) {
        alive.add(m.id);
        let v = beasts.get(m.id);
        if (!v) { v = buildBeast(m.kind); beasts.set(m.id, v); group.add(v.group); v.vis.set(m.pos.x, 0, m.pos.z); }
        animateBeast(v, m, state, dt);
        // wounded: a trail of blood in the snow as it goes
        if (m.wounds > 0) {
          v.bleed += Math.hypot(v.vis.x - (v.lastX ?? v.vis.x), v.vis.z - (v.lastZ ?? v.vis.z));
          if (v.bleed > 0.25) { v.bleed = 0; marks.blood(v.vis.x, v.vis.z, m.wounds > 1 ? 0.14 : 0.11); }
        }
        v.lastX = v.vis.x; v.lastZ = v.vis.z;
      }
      for (const [id, v] of beasts) if (!alive.has(id)) { group.remove(v.group); beasts.delete(id); }
    },
  };
}
