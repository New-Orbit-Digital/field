// Debug-only ground rings: the edge of the dim play area / start of the deep dark (red), and the crowd's band (grey).
import * as THREE from 'three';

export function buildDebugRings(cfg) {
  const group = new THREE.Group();
  group.visible = false;
  const ring = (r, color) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 96), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05;
    return m;
  };
  group.add(ring(cfg.arena.darkRadius, 0xff3355), ring(cfg.horde.crowdInner, 0x777777), ring(cfg.horde.crowdOuter, 0x777777));
  return group;
}
