// Over-the-shoulder camera: portrait-aware, kept out of the wreck, with hit/shot shake.
import * as THREE from 'three';
import { forward } from '../sim/game.js';

export function createFollowCamera() {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
  const pos = new THREE.Vector3(0, 2, 8);
  const look = new THREE.Vector3();
  let shake = 0;
  return {
    camera,
    resize(w, h) {
      camera.aspect = w / h;
      camera.fov = camera.aspect < 1 ? 88 : 65; // portrait phones need a wider view
      camera.updateProjectionMatrix();
    },
    onEvent(e) {
      if (e.type === 'hit') shake = 0.6;
      if (e.type === 'shot') shake = Math.max(shake, 0.12);
    },
    update(state, view, py, dt) {
      const P = state.player;
      const f = forward(P.yaw);
      const pitch = view.pitch;
      const portrait = camera.aspect < 1;
      const back = portrait ? 4.2 : 3.6, side = portrait ? 0.3 : 0.95, height = portrait ? 2.4 : 2.1;
      const right = { x: -f.z, z: f.x };
      const target = new THREE.Vector3(
        P.pos.x - f.x * back + right.x * side,
        py + height + Math.sin(-pitch) * 1.2,
        P.pos.z - f.z * back + right.z * side,
      );
      if (py < 0.5) {
        // never inside the wreck: push the camera radially clear
        const cr = Math.hypot(target.x, target.z), minR = 3.0;
        if (cr < minR) {
          const k = cr < 1e-3 ? 0 : minR / cr;
          target.x *= k; target.z *= k;
          target.y = Math.max(target.y, 2.9);
        }
      }
      pos.lerp(target, Math.min(1, dt * 12));
      look.set(P.pos.x + f.x * 6 + right.x * side, py + 1.2 + Math.tan(pitch) * 6, P.pos.z + f.z * 6 + right.z * side);
      camera.position.copy(pos);
      if (shake > 0) {
        shake = Math.max(0, shake - dt);
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      }
      camera.lookAt(look);
    },
  };
}
