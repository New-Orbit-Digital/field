// Player step: the order of operations for one tick. Each system lives in its own module.
import { carDistance, pushOutOfCar } from './car.js';
import { emit } from './events.js';
import { bearingTo, forward, wrapAngle } from './math.js';
import { stepRecoilAndReload, tryFire } from './pistol.js';
import { stepMovement, stepMantle } from './movement.js';
import { stepInteract } from './interact.js';
import { tryThrowFlare } from './flares.js';
import { setFlashlight } from './flashlight.js';

export function stepPlayer(state, input, dt) {
  const { player: P } = state;
  P.yaw = wrapAngle(input.yaw ?? P.yaw);
  P.invuln = Math.max(0, P.invuln - dt);
  P.fireCd = Math.max(0, P.fireCd - dt);

  // hauling yourself onto the car: nothing else happens
  if (stepMantle(state, dt)) { setFlashlight(state, false, dt); return; }

  stepRecoilAndReload(state, input, dt);
  // returns true if a mantle just started this tick
  if (stepMovement(state, input, dt)) { setFlashlight(state, false, dt); return; }
  stepInteract(state, input, dt);
  tryFire(state, input);
  tryThrowFlare(state, input);
  setFlashlight(state, !!input.flashlight && P.reloading <= 0 && !P.interacting, dt);
}

export function hitPlayer(state, M) {
  const { player: P, cfg } = state;
  P.health -= 1;
  P.invuln = cfg.player.invulnTime;
  P.reloading = 0;
  P.reloadWindow = null;
  P.mantle = 0;
  const away = bearingTo(M.pos, P.pos);
  const f = forward(away);
  P.pos.x += f.x * cfg.player.knockback;
  P.pos.z += f.z * cfg.player.knockback;
  if (P.onCar) {
    // knocked clean off the wreck, away from the attacker
    P.onCar = false; P.grounded = false; P.vy = 2;
    for (let i = 0; i < 60 && carDistance(cfg, P.pos) < cfg.player.radius + 0.1; i++) { P.pos.x += f.x * 0.1; P.pos.z += f.z * 0.1; }
    emit(state, 'knocked_off');
  }
  if (P.y < cfg.car.top - 0.05) pushOutOfCar(cfg, P.pos, cfg.player.radius);
  emit(state, 'hit', { id: M.id, attack: M.attackId, health: P.health, seen: M.attackSeen });
  if (P.health <= 0) {
    state.alive = false;
    emit(state, 'death', { time: +state.t.toFixed(2) });
  }
}
