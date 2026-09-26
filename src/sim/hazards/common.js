// Shared bits for hazards: a pseudo-attacker for hitPlayer, spawn points, and grabs.
import { forward, len } from '../math.js';

// hitPlayer wants something shaped like a monster (id, pos, attack bookkeeping).
export const attacker = (id, pos) => ({ id, pos: { ...pos }, attackId: 0, attackSeen: true });

// A point `d` out from the wreck on a random bearing (or a given one).
export function ringPoint(state, d, bearing = state.rng.range(0, Math.PI * 2)) {
  const f = forward(bearing);
  return { x: (state.cfg.car.x || 0) + f.x * d, z: (state.cfg.car.z || 0) + f.z * d };
}

// Opposite side of the field from the player, `d` out.
export function farFromPlayer(state, d) {
  const P = state.player.pos;
  const b = len(P) > 0.5 ? Math.atan2(-P.x, -P.z) : state.rng.range(0, Math.PI * 2);
  return ringPoint(state, d, b + state.rng.range(-0.6, 0.6));
}
