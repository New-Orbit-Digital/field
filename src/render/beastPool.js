// All monsters in the scene: one view per sim monster, created and removed as the horde changes.
import * as THREE from 'three';
import { animateBeast, buildBeast } from './beast.js';

export function createBeastPool(scene) {
  const beasts = new Map(); // id -> view
  const group = new THREE.Group();
  scene.add(group);
  return {
    onEvent(e) {
      const v = e.id != null ? beasts.get(e.id) : null;
      if (v && (e.type === 'repel' || e.type === 'shot_hit' || e.type === 'spotted')) v.flinch = 0.45;
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
        if (!v) { v = buildBeast(); beasts.set(m.id, v); group.add(v.group); v.vis.set(m.pos.x, 0, m.pos.z); }
        animateBeast(v, m, state.player, state.t, dt);
      }
      for (const [id, v] of beasts) if (!alive.has(id)) { group.remove(v.group); beasts.delete(id); }
    },
  };
}
