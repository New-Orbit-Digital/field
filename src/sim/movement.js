// Walking, the low jump, gravity, standing on the car, mantling onto it, and collisions.
import { carClosestPoint, carDistance, carToWorld, insideCarTop, pushOutOfCar, worldToCar } from './car.js';
import { emit } from './events.js';
import { bearingTo, forward, len, wrapAngle } from './math.js';

// Mantle in progress? Advance it; returns true while the player is busy climbing.
export function stepMantle(state, dt) {
  const { player: P, cfg } = state;
  if (P.mantle <= 0) return false;
  P.mantle -= dt;
  if (P.mantle <= 0) {
    P.mantle = 0;
    // pull onto the top, a little in from the edge
    const l = worldToCar(cfg, P.pos);
    l.x = Math.max(-cfg.car.halfLength + 0.4, Math.min(cfg.car.halfLength - 0.4, l.x));
    l.z = Math.max(-cfg.car.halfWidth + 0.4, Math.min(cfg.car.halfWidth - 0.4, l.z));
    P.pos = carToWorld(cfg, l);
    P.y = cfg.car.top; P.vy = 0; P.grounded = true; P.onCar = true;
    emit(state, 'mantle_done');
  }
  return true;
}

// Move, jump, fall, maybe start a mantle, collide. Returns true if a mantle started this tick.
export function stepMovement(state, input, dt) {
  const { player: P, cfg } = state;
  const pc = cfg.player;

  // --- walking (slower while reloading) ---
  const f = forward(P.yaw);
  const left = { x: f.z, z: -f.x };
  let mx = input.moveX || 0, mz = input.moveZ || 0;
  if (P.held) { mx = 0; mz = 0; } // grabbed: A/D is for struggling, not walking
  const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  const spd = pc.speed * (P.reloading > 0 ? 0.6 : 1) * (P.speedMult ?? 1);
  P.pos.x += (f.x * mz - left.x * mx) * spd * dt;
  P.pos.z += (f.z * mz - left.z * mx) * spd * dt;

  // --- jump / gravity ---
  if (input.jump && P.grounded && !P.held) {
    P.vy = pc.jumpVelocity; P.grounded = false;
    emit(state, 'jump');
  }
  if (P.onCar && P.grounded && !insideCarTop(cfg, P.pos)) {
    P.onCar = false; P.grounded = false; P.vy = 0; // walked off the edge
    emit(state, 'fall');
  }
  if (!P.grounded) {
    P.vy -= pc.gravity * dt;
    P.y += P.vy * dt;
    const floor = insideCarTop(cfg, P.pos) && P.y >= cfg.car.top - 0.25 ? cfg.car.top : 0;
    if (P.y <= floor) {
      P.y = floor; P.vy = 0; P.grounded = true; P.onCar = floor > 0;
      emit(state, 'land', { onCar: P.onCar });
    }
  }

  // --- mantle check: airborne, close to the hull, pushing into it, facing it ---
  if (!P.grounded && !P.onCar && P.y >= pc.mantleMinHeight && mz > 0.3) {
    const d = carDistance(cfg, P.pos);
    if (d <= pc.radius + pc.mantleReach) {
      const q = carClosestPoint(cfg, P.pos);
      const rel = Math.abs(wrapAngle(bearingTo(P.pos, q) - P.yaw));
      if (rel <= pc.mantleFaceAngle) {
        P.mantle = pc.mantleTime;
        P.vy = 0;
        emit(state, 'mantle_start');
        return true;
      }
    }
  }

  // --- collisions ---
  if (P.y < cfg.car.top - 0.05) pushOutOfCar(cfg, P.pos, pc.radius);
  const r = len(P.pos);
  if (r > cfg.arena.boundRadius) { P.pos.x *= cfg.arena.boundRadius / r; P.pos.z *= cfg.arena.boundRadius / r; }
  return false;
}
