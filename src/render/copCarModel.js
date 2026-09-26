// The loaded cop car (cop-car.glb) turned onto its roof and fitted to the sim's car: 4.75 m long, and tall
// enough that the upturned floor is at cfg.car.top (1.62) with the tyres at ~1.94. The source model is a bit
// low for that, so it is stretched ~1.3x vertically (it reads as the roof having taken the fall).
// Model axes: front +z, up +y, roof top at y ≈ 35.3, floor underside at y ≈ 5.9, length 111 units.
// Sim car-local frame: front +x, up +y, across z.
import * as THREE from 'three';
import { applyGrit, GRIT, gritTexture } from './assets.js';

const SRC = { roof: 35.3, floor: 5.9, zMin: -63.72, zMax: 47.25 };

export function buildCopCarModel(gltf, cfg) {
  const len = SRC.zMax - SRC.zMin;
  const s = (cfg.car.halfLength * 2 + 0.05) / len;      // along the length and across
  const sy = cfg.car.top / (SRC.roof - SRC.floor);        // floor lands on the standing height
  const zc = (SRC.zMax + SRC.zMin) / 2;
  // (x, y, z) -> (z, -y, x): a proper rotation (det +1), so faces keep their winding
  const M = new THREE.Matrix4().set(
    0, 0, s, -zc * s,
    0, -sy, 0, SRC.roof * sy,
    s, 0, 0, 0,
    0, 0, 0, 1,
  );
  const group = new THREE.Group();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld));
    const m = new THREE.Mesh(geo, o.material);
    group.add(m);
  });
  applyGrit(group, GRIT.copCar, { mottleGeometry: false });
  // extra grime on the paint: road salt, mud up the sides and wheel arches
  group.traverse((o) => {
    if (o.isMesh && o.material.map) o.material.map = gritTexture(o.material.map, { ...GRIT.copCar, desat: 0, mix: 0, dark: 1 }, { grime: 0.5, seed: 7 });
  });
  return group;
}

// Glass in the snow from a smashed light bar (smashed-glass.glb): clear, red and blue pieces, on one side.
export function buildGlassModel(gltf, side) {
  const g = new THREE.Group();
  const obj = gltf.scene.clone(true);
  applyGrit(obj, GRIT.glass, { mottleGeometry: false });
  const tints = [0xb8c6d8, 0x6a0a0a, 0x0a1a6a];
  let i = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color.setHex(tints[i++ % 3]);
    o.material.metalness = 0.6;
    o.material.roughness = 0.12;
    o.castShadow = false;
  });
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const k = 1.4 / Math.max(0.01, box.getSize(new THREE.Vector3()).x);
  obj.scale.setScalar(k);
  obj.position.set(-c.x * k, 0.02 - box.min.y * k, -c.z * k);
  g.add(obj);
  g.position.set(0, 0, side * 1.45);
  g.rotation.y = side * 0.4;
  return g;
}
