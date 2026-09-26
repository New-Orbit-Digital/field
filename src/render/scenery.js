// Scenery from the loaded models (visual only; the sim never sees any of it):
//   - dead trees scattered out past the crowd, never on the line to the far headlights
//   - zombies shambling among the crowd at the edge of the dark; they turn and shuffle off out of your beam
import * as THREE from 'three';
import { onModel, applyGrit, GRIT } from './assets.js';
import { groundHeight } from './ground.js';
import { inBeam } from '../sim/game.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Each top-level piece in dead-trees.glb (trees, a fallen branch, a stump) as its own variant, feet at y = 0.
function treeVariants(gltf) {
  const root = gltf.scene;
  applyGrit(root, GRIT.trees);
  root.updateMatrixWorld(true);
  const pieces = [];
  let parent = root;
  while (parent.children.length === 1) parent = parent.children[0];
  for (const ch of parent.children) {
    const box = new THREE.Box3().setFromObject(ch);
    if (box.isEmpty()) continue;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    const copy = ch.clone(true);
    // bake the piece's world transform in, then centre it
    copy.matrix.copy(ch.matrixWorld); copy.matrixAutoUpdate = false;
    const inner = new THREE.Group();
    inner.position.set(-c.x, -box.min.y, -c.z);
    inner.add(copy);
    holder.add(inner);
    pieces.push({ holder, height: size.y, width: Math.max(size.x, size.z) });
  }
  return pieces;
}

export function createScenery(scene, cfg) {
  const trees = new THREE.Group();
  scene.add(trees);
  const zombies = [];
  const zGroup = new THREE.Group();
  scene.add(zGroup);

  onModel((key, gltf) => {
    if (key === 'trees') plantTrees(gltf);
    if (key === 'zombie') spawnZombies(gltf);
  });

  function plantTrees(gltf) {
    const pieces = treeVariants(gltf);
    if (!pieces.length) return;
    const tallest = Math.max(...pieces.map((p) => p.height));
    const k = 7 / tallest; // tallest tree ~7 m
    const r = rng(2026);
    const avoid = cfg.arena.landmarkBearing;
    let placed = 0;
    for (let tries = 0; placed < 26 && tries < 400; tries++) {
      const b = r() * Math.PI * 2;
      const d = Math.atan2(Math.sin(b - avoid), Math.cos(b - avoid));
      if (Math.abs(d) < 0.35) continue; // keep the headlights' line clear
      const dist = 25 + r() * 26;
      const p = pieces[Math.floor(r() * pieces.length)];
      const t = p.holder.clone(true);
      const x = Math.sin(b) * dist, z = Math.cos(b) * dist;
      t.position.set(x, groundHeight(x, z) - 0.05, z);
      t.rotation.y = r() * Math.PI * 2;
      t.scale.setScalar(k * (0.75 + r() * 0.5));
      t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      trees.add(t);
      placed++;
    }
  }

  function spawnZombies(gltf) {
    applyGrit(gltf.scene, GRIT.zombie);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.8 / size.y;
    const c = box.getCenter(new THREE.Vector3());
    const r = rng(77);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const sway = new THREE.Group();
      const m = gltf.scene.clone(true);
      m.scale.setScalar(k * (0.92 + r() * 0.16));
      m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      sway.add(m);
      g.add(sway);
      const b = r() * Math.PI * 2;
      const dist = cfg.horde.crowdInner + 2 + r() * (cfg.horde.crowdOuter - cfg.horde.crowdInner + 3);
      const z = { g, sway, bearing: b, dist, home: dist, yaw: r() * 6.28, phase: r() * 10, speed: 0.25 + r() * 0.2, turnT: 0, fleeT: 0 };
      g.position.set(Math.sin(b) * dist, 0, Math.cos(b) * dist);
      zGroup.add(g);
      zombies.push(z);
    }
  }

  const pos = { x: 0, z: 0 };
  return {
    zombies, trees,
    update(state, dt) {
      for (const z of zombies) {
        // drift slowly around the ring; out of your beam and away for a while if it catches them
        pos.x = z.g.position.x; pos.z = z.g.position.z;
        if (inBeam(state, pos)) z.fleeT = 4 + Math.random() * 2;
        z.fleeT = Math.max(0, z.fleeT - dt);
        const fleeing = z.fleeT > 0;
        const targetDist = fleeing ? z.home + 7 : z.home;
        z.bearing += (fleeing ? 0 : z.speed * 0.02) * dt;
        z.dist += Math.sign(targetDist - z.dist) * Math.min(Math.abs(targetDist - z.dist), (fleeing ? 1.1 : 0.3) * dt);
        const nx = Math.sin(z.bearing) * z.dist, nz = Math.cos(z.bearing) * z.dist;
        const dx = nx - z.g.position.x, dz = nz - z.g.position.z;
        const moved = Math.hypot(dx, dz);
        z.g.position.set(nx, groundHeight(nx, nz), nz);
        if (moved > 1e-4) {
          const want = Math.atan2(dx, dz);
          let d = want - z.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          z.yaw += d * Math.min(1, dt * 2);
        }
        z.g.rotation.y = z.yaw;
        // the shamble: a lurching sway and a dragging bob
        z.phase += dt * (fleeing ? 3.2 : 1.6);
        z.sway.rotation.z = Math.sin(z.phase) * 0.09;
        z.sway.rotation.x = 0.12 + Math.sin(z.phase * 2) * 0.04;
        z.sway.position.y = Math.abs(Math.sin(z.phase)) * 0.04;
      }
    },
    reset() {
      zombies.forEach((z) => { z.dist = z.home; z.fleeT = 0; });
    },
  };
}
