// Swarm: a cloud of small things that goes for light — your beam first, then flares. On you it drains
// the flashlight and bites; on a flare it smothers it. Light doesn't scare it; only bullets thin it out.
import { emit } from '../events.js';
import { dist, moveToward } from '../math.js';
import { hitPlayer } from '../player.js';
import { attacker, farFromPlayer } from './common.js';

export function spawnSwarm(state) {
  const hz = state.hazards;
  if (hz.swarm) return;
  const sc = state.cfg.hazards.swarm;
  hz.swarm = { pos: farFromPlayer(state, sc.spawnDist), count: sc.size, hurtT: 0, target: 'player' };
  emit(state, 'swarm_start', { pos: { ...hz.swarm.pos } });
}

export function stepSwarm(state, dt) {
  const S = state.hazards.swarm;
  if (!S) return;
  const sc = state.cfg.hazards.swarm;
  const P = state.player;
  // brightest thing nearby: your beam, else the nearest burning flare, else it just drifts your way
  let goal = P.pos, speed = sc.idleSpeed, target = 'drift';
  if (P.flashlightOn && dist(S.pos, P.pos) < sc.seekRange) { speed = sc.speed; target = 'player'; }
  else {
    let best = null, bd = sc.seekRange;
    for (const f of state.flares) if (f.state === 'burning' && dist(S.pos, f.pos) < bd) { best = f; bd = dist(S.pos, f.pos); }
    if (best) { goal = best.pos; speed = sc.speed; target = 'flare'; S.flare = best; }
  }
  S.target = target;
  moveToward(S.pos, goal, speed * dt);

  if (target === 'flare' && dist(S.pos, S.flare.pos) < sc.reach) {
    S.flare.t += dt * (sc.smotherRate - 1); // it burns down fast under them
  }
  if (dist(S.pos, P.pos) < sc.reach) {
    S.on = true;
    P.battery = Math.max(0, P.battery - sc.drainPerSec * dt);
    if (P.battery === 0 && !P.flashlightLocked) { P.flashlightLocked = true; P.flashlightOn = false; emit(state, 'battery_dead'); }
    S.hurtT += dt;
    if (S.hurtT >= sc.hurtEvery) { S.hurtT = 0; if (P.invuln <= 0) hitPlayer(state, attacker('swarm', S.pos)); }
  } else { S.on = false; S.hurtT = Math.min(S.hurtT, sc.hurtEvery * 0.5); }
}

export function swarmTargets(state) {
  const S = state.hazards.swarm;
  if (!S) return [];
  return [{ pos: S.pos, radius: state.cfg.hazards.swarm.radius, onHit() {
    S.count -= state.cfg.hazards.swarm.perHit;
    emit(state, 'swarm_hit', { pos: { ...S.pos }, left: Math.max(0, S.count) });
    if (S.count <= 0) { state.hazards.swarm = null; emit(state, 'swarm_scattered', { pos: { ...S.pos } }); }
  } }];
}
