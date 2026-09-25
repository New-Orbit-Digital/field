// The snowy field: a big plane with gentle drifts (flatter right around the car).
import * as THREE from 'three';

export function buildGround() {
  const geo = new THREE.PlaneGeometry(140, 140, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const r = Math.hypot(x, z);
    const drift = Math.sin(x * 0.35 + z * 0.12) * 0.12 + Math.sin(z * 0.5 - x * 0.2) * 0.08 + Math.sin(x * 1.7) * Math.cos(z * 1.3) * 0.03;
    gp.setY(i, r < 4 ? drift * 0.2 : drift);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe4ebf2, roughness: 0.93 }));
  ground.receiveShadow = true;
  return ground;
}
