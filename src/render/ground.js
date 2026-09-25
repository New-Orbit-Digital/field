// The snowy field: gentle drifts (flatter right around the car) and the embankment the far vehicle sits on.
// groundHeight() is shared so anything placed on the terrain (the far vehicle) sits on it.
import * as THREE from 'three';

let RIDGE = null; // { bx, bz, dist, height }

export function setEmbankment(cfg) {
  const b = cfg.arena.landmarkBearing;
  RIDGE = { bx: Math.sin(b), bz: Math.cos(b), dist: cfg.arena.landmarkDistance, height: cfg.arena.embankmentHeight };
}

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const drift = Math.sin(x * 0.35 + z * 0.12) * 0.12 + Math.sin(z * 0.5 - x * 0.2) * 0.08 + Math.sin(x * 1.7) * Math.cos(z * 1.3) * 0.03;
  let h = r < 4 ? drift * 0.2 : drift;
  if (RIDGE) {
    const along = x * RIDGE.bx + z * RIDGE.bz;
    const across = x * RIDGE.bz - z * RIDGE.bx;
    // a long, flat-topped bank running across the headlights' line, about 8 m deep
    const t = (along - RIDGE.dist) / 7;
    const profile = t < -1 ? Math.exp(-((t + 1) ** 2) * 2.5) : t > 1 ? Math.exp(-((t - 1) ** 2) * 0.6) : 1;
    const ends = 1 / (1 + Math.exp((Math.abs(across) - 38) / 4));
    h += RIDGE.height * profile * ends;
  }
  return h;
}

export function buildGround(cfg) {
  setEmbankment(cfg);
  const geo = new THREE.PlaneGeometry(160, 160, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe4ebf2, roughness: 0.93 }));
  ground.receiveShadow = true;
  return ground;
}
