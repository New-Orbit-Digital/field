// Statue: it only moves while it isn't in your flashlight beam, and freezes the moment it is. Light
// doesn't drive it off and bullets don't hurt it. Its touch costs a hit, then it's somewhere far away.
import { emit } from '../events.js';
import { pushOutOfCar } from '../car.js';
import { bearingTo, dist, moveToward } from '../math.js';
import { inBeam } from '../perception.js';
import { hitPlayer } from '../player.js';
import { attacker, farFromPlayer } from './common.js';

export function spawnStatue(state) {
  const hz = state.hazards;
  if (hz.statue) return;
  const pos = farFromPlayer(state, state.cfg.hazards.statue.spawnDist);
  hz.statue = { pos, yaw: bearingTo(pos, state.player.pos), moving: false };
  emit(state, 'statue_start', { pos: { ...pos } });
}

export function stepStatue(state, dt) {
  const S = state.hazards.statue;
  if (!S) return;
  const sc = state.cfg.hazards.statue;
  const P = state.player;
  const frozen = inBeam(state, S.pos);
  if (frozen !== !S.moving) { S.moving = !frozen; emit(state, frozen ? 'statue_freeze' : 'statue_move', { pos: { ...S.pos } }); }
  if (!frozen) {
    moveToward(S.pos, P.pos, sc.speed * dt);
    pushOutOfCar(state.cfg, S.pos, 0.4);
    S.yaw = bearingTo(S.pos, P.pos); // it only turns when you're not looking
  }
  if (dist(S.pos, P.pos) < sc.hitRange && P.invuln <= 0) {
    hitPlayer(state, attacker('statue', S.pos));
    S.pos = farFromPlayer(state, sc.spawnDist);
    S.yaw = bearingTo(S.pos, P.pos);
    emit(state, 'statue_reset', { pos: { ...S.pos } });
  }
}

// It stops bullets but doesn't care.
export function statueTargets(state) {
  const S = state.hazards.statue;
  return S ? [{ pos: S.pos, radius: 0.45, onHit() { emit(state, 'ricochet', { pos: { ...S.pos } }); } }] : [];
}
