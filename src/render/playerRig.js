// The player in the scene: model + animation, the flashlight (with recoil waver),
// the muzzle flash, and the world point the aim dot is projected from.
import * as THREE from 'three';
import { forward, aimYaw } from '../sim/game.js';
import { buildPlayer } from './player.js';

export function createPlayerRig(scene, cfg) {
  const player = buildPlayer();
  scene.add(player.group);
  const flash = new THREE.SpotLight(0xfff3dd, 0, cfg.flashlight.beamRange + 4, cfg.flashlight.beamHalfAngle * 1.35, 0.45, 1.1);
  flash.castShadow = true;
  flash.shadow.mapSize.set(1024, 1024);
  flash.shadow.camera.near = 0.3;
  const muzzle = new THREE.PointLight(0xffc070, 0, 12, 1.5);
  scene.add(flash, flash.target, muzzle);
  let muzzleT = 0;
  const aimPoint = new THREE.Vector3();

  return {
    aimPoint,
    onEvent(e) {
      if (e.type === 'shot') muzzleT = 0.06;
    },
    // Returns the player's visual height (used by the camera).
    update(state, view, dt) {
      const t = state.t, P = state.player;
      const py = P.mantle > 0 ? cfg.car.top * (1 - P.mantle / cfg.player.mantleTime) : P.y;
      player.group.position.set(P.pos.x, py, P.pos.z);
      player.group.rotation.y = P.yaw;
      const bob = view.moving && P.grounded ? Math.abs(Math.sin(t * 9)) * 0.05 : Math.sin(t * 2) * 0.01;
      player.body.position.y = 0.85 + bob;
      player.body.rotation.x = P.mantle > 0 ? 0.5 : 0;
      player.arm.rotation.x = P.reloading > 0 ? -0.4 + Math.sin(t * 14) * 0.15 : P.interacting ? -0.6 : -1.2;
      player.group.visible = !(P.invuln > 0 && Math.floor(t * 20) % 2 === 0);

      const f = forward(P.yaw);
      const aim = forward(aimYaw(state));
      const kick = P.recoil * Math.cos(P.recoilPhase * 1.3) * 6; // vertical waver from recoil
      const lift = py + 1.25 + Math.tan(view.pitch) * 10 - 0.9 + kick;
      flash.position.set(P.pos.x + f.x * 0.45 - f.z * 0.3, py + 1.27, P.pos.z + f.z * 0.45 + f.x * 0.3);
      flash.target.position.set(P.pos.x + aim.x * 10, lift, P.pos.z + aim.z * 10);
      aimPoint.set(P.pos.x + aim.x * 12, py + 1.25 + Math.tan(view.pitch) * 12 - 0.9 + kick, P.pos.z + aim.z * 12);
      const flicker = P.battery < 20 ? (Math.random() < 0.15 ? 0.3 : 1) : 1;
      flash.intensity = P.flashlightOn ? 160 * flicker : 0;
      muzzleT = Math.max(0, muzzleT - dt);
      muzzle.position.copy(flash.position);
      muzzle.intensity = muzzleT > 0 ? 60 : 0;
      return py;
    },
  };
}
