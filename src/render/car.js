// The overturned cop car (light bar lenses on both sides, hazard lamps) and the glowing tells at each pickup spot.
import * as THREE from 'three';
import { spotWorld } from '../sim/game.js';

export function buildCar(cfg) {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.45, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.1, metalness: 0.8 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const L = cfg.car.halfLength * 2, W = cfg.car.halfWidth * 2;
  const car = new THREE.Group();
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, W - 0.25), glass);
  cabin.position.set(-0.15, 0.38, 0);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(L, 0.45, W), white);
  lower.position.set(0, 0.98, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(L, cfg.car.top - 1.2, W), black);
  upper.position.set(0, 1.2 + (cfg.car.top - 1.2) / 2, 0);
  car.add(cabin, lower, upper);
  for (const [x, z] of [[1.45, 0.9], [-1.45, 0.9], [1.45, -0.9], [-1.45, -0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), tire);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, cfg.car.top + 0.05, z);
    car.add(w);
  }
  // light bar (the roof is on the snow): red and blue lenses facing out of BOTH sides
  const bars = [];
  for (const side of [1, -1]) {
    for (const red of [true, false]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.2), new THREE.MeshStandardMaterial({
        color: red ? 0x400000 : 0x000840, emissive: red ? 0xff1010 : 0x2050ff, emissiveIntensity: 1,
      }));
      m.position.set((red ? 0.35 : -0.35) * side, 0.08, side * (W / 2 - 0.02));
      m.userData = { red, side };
      car.add(m);
      bars.push(m);
    }
  }
  // hazard lamps at the four corners (upside down, so low on the body)
  const hazards = [];
  for (const [x, z] of [[1, 0.7], [1, -0.7], [-1, 0.7], [-1, -0.7]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0x302000, emissive: 0xff9010, emissiveIntensity: 0.1 }));
    m.position.set(x * (L / 2 + 0.02), 1.02, z);
    car.add(m);
    hazards.push(m);
  }
  car.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  car.rotation.y = cfg.car.yaw;
  group.add(car);
  return { group, bars, hazards };
}

// Small tells on the hull so each pickup spot is findable in the dark.
export function buildSpots(cfg) {
  const group = new THREE.Group();
  const mk = (color, size) => new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.5 }));
  const place = (mesh, name, y) => {
    const s = spotWorld(cfg, name);
    const inward = { x: s.face.x - s.stand.x, z: s.face.z - s.stand.z };
    const n = Math.hypot(inward.x, inward.z);
    mesh.position.set(s.face.x - (inward.x / n) * 0.03, y, s.face.z - (inward.z / n) * 0.03);
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
