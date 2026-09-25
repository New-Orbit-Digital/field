// Debug-only ground rings: the edge of the light (green) and the start of the deep dark (red).
import * as THREE from 'three';

export function buildDebugRings(cfg) {
  const group = new THREE.Group();
  group.visible = false;
  const ring = (r, color) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 96), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05;
    return m;
  };
  group.add(ring(cfg.arena.lightRadius, 0x33ff88), ring(cfg.arena.lightRadius + cfg.monster.deepDarkMargin, 0xff3355));
  return group;
}
