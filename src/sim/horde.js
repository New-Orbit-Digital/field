// How many monsters exist and how many may attack at once.
import { emit } from './events.js';
import { bearingTo } from './math.js';
import { ATTACKING, MODES } from './modes.js';

export function spawnMonster(state, pos) {
  const { cfg, rng } = state;
  if (!pos) {
    const b = rng.range(-Math.PI, Math.PI);
    pos = { x: Math.sin(b) * cfg.horde.spawnDist, z: Math.cos(b) * cfg.horde.spawnDist };
  }
  const b = bearingTo(state.player.pos, pos);
  const m = {
    id: state.nextMonsterId++,
    mode: MODES.STALK,
    pos: { ...pos },
    bearing: b,
    targetBearing: b,
    timer: rng.range(cfg.monster.lullMin, cfg.monster.lullMax),
    pendingAction: null,
    stepTimer: rng.range(0, 0.5),
    beamAccum: 0,
    beamTime: 0,
    commitTime: 0,
    attackId: 0,
    attackSeen: false,
    approachRel: 0,
    dodgeT: 0,
    dodgeCd: 0,
    dodgeVel: { x: 0, z: 0 },
    climbT: 0,
    deep: false,
  };
  state.monsters.push(m);
  if (state.monsters.length > 1) emit(state, 'spawn', { id: m.id, count: state.monsters.length, pos: { ...m.pos } });
  return m;
}

export function attackerCount(state) {
  let n = 0;
  for (const m of state.monsters) if (ATTACKING.has(m.mode)) n++;
  return n;
}
export function attackerCap(state) {
  const mc = state.cfg.monster;
  return mc.attackerCapBase + Math.floor((state.monsters.length - 1) / mc.attackerPerExtra);
}

export function stepHorde(state, dt) {
  const { cfg, radio } = state;
  const h = cfg.horde;
  if (radio.phase === 'repair') {
    const byTime = Math.min(h.repairRampCap, 1 + Math.floor(state.t / h.repairRampEvery));
    state.hordeTarget = Math.max(state.hordeTarget, byTime);
  } else if (radio.phase === 'wait') {
    state.waitSpawnTimer -= dt;
    if (state.waitSpawnTimer <= 0) { state.waitSpawnTimer = h.waitSpawnEvery; state.hordeTarget++; }
  }
  state.hordeTarget = Math.min(h.max, state.hordeTarget);
  while (state.monsters.length < state.hordeTarget) spawnMonster(state);
}
