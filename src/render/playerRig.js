// The player in the scene: model + animation, the flashlight (with recoil waver),
// the muzzle flash, and the world point the aim dot is projected from.
import * as THREE from 'three';
import { forward, aimYaw } from '../sim/game.js';
import { buildPlayer, posePlayer } from './player.js';
import { buildSoldier } from './soldier.js';
import { onModel, model } from './assets.js';

export function createPlayerRig(scene, cfg) {
  const player = buildPlayer();
  const root = new THREE.Group();   // what moves, turns and blinks; holds whichever figure is showing
  root.add(player.group);
  scene.add(root);
  // the Soldier model takes over from the procedural figure once it (and ideally the pistol) has loaded
  let soldier = null;
  const trySoldier = () => {
    if (soldier || !model('soldier')) return;
    soldier = buildSoldier(model('soldier'), model('pistol'));
    root.remove(player.group);
    root.add(soldier.group);
  };
  onModel((key) => { if (key === 'soldier' || (key === 'pistol' && !soldier)) trySoldier(); });
  const flash = new THREE.SpotLight(0xfff3dd, 0, cfg.flashlight.beamRange + 4, cfg.flashlight.beamHalfAngle * 1.35, 0.45, 1.1);
  flash.castShadow = true;
  flash.shadow.mapSize.set(1024, 1024);
  flash.shadow.camera.near = 0.3;
  const muzzle = new THREE.PointLight(0xffc070, 0, 12, 1.5);
  scene.add(flash, flash.target, muzzle);
  let muzzleT = 0, walk = 0, aimK = 0, lastShot = -9;
  const aimPoint = new THREE.Vector3();
  const lastPos = { x: 0, z: 0 };

  return {
    aimPoint,
    onEvent(e) {
      if (e.type === 'shot') { muzzleT = 0.06; lastShot = e.t; soldier?.shot(); }
      if (e.type === 'hit') soldier?.hit();
    },
    get soldier() { return soldier; },
    // Returns the player's visual height (used by the camera).
    update(state, view, dt) {
      const t = state.t, P = state.player;
      const py = P.mantle > 0 ? cfg.car.top * (1 - P.mantle / cfg.player.mantleTime) : P.y;
      root.position.set(P.pos.x, py, P.pos.z);
      root.rotation.y = P.yaw;
      // walk cycle driven by how far you actually moved
      const mdx = P.pos.x - lastPos.x, mdz = P.pos.z - lastPos.z;
      const moved = Math.hypot(mdx, mdz);
      lastPos.x = P.pos.x; lastPos.z = P.pos.z;
      const speed = P.grounded && moved < 0.5 ? Math.min(1, moved / Math.max(dt, 1e-3) / cfg.player.speed) : 0;
      walk += moved * 5.2;
      // arms come up to aim with the light on, or just after a shot
      const wantAim = P.flashlightOn || P.flicker || t - lastShot < 1.2 ? 1 : 0;
      aimK += (wantAim - aimK) * Math.min(1, dt * 10);
      const pose = { phase: walk, speed, aim: aimK, reloading: P.reloading > 0, interacting: P.interacting, mantling: P.mantle > 0, t };
      if (soldier) {
        const f0 = forward(P.yaw);
        const n = Math.max(moved, 1e-6);
        soldier.update({ ...pose, fwd: (mdx * f0.x + mdz * f0.z) / n, side: (mdx * f0.z - mdz * f0.x) / n, dead: !state.alive && !state.won }, dt);
      } else posePlayer(player, pose);
      (soldier?.lens || player.lens).material.emissiveIntensity = P.flashlightOn ? 4 : 0;
      root.visible = !(P.invuln > 0 && Math.floor(t * 20) % 2 === 0);

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
