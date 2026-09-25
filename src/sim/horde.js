// The crowd at the edge of the dark, and how many of them are hunting you.
// It's one pool: hunters break off from the crowd, and go back to it after they're driven off.
// Shot twice, a monster leaves for good, so the crowd can be whittled down (slowly).
import { emit } from './events.js';
import { bearingTo, len } from './math.js';
import { ATTACKING, HUNTING, MODES } from './modes.js';

export function makeMonster(state, pos, mode = MODES.SHAMBLE) {
  const { cfg, rng } = state;
  const b = bearingTo(state.player.pos, pos);
  const m = {
    id: state.nextMonsterId++,
    mode,
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
    climbT: 0,
    deep: false,
    wounds: 0,
    // wandering in the crowd
    home: Math.atan2(pos.x, pos.z),
    wander: { ...pos },
    wanderT: 0,
    scatterT: 0,
    scatterVel: { x: 0, z: 0 },
    fleeFrom: null,        // where it's running from (null = the player)
    fleeTap: false,        // double-tap: turns straight back instead of rejoining the crowd
  };
  state.monsters.push(m);
  return m;
}

export function createCrowd(state) {
  const { cfg, rng } = state;
  const h = cfg.horde;
  for (let i = 0; i < h.crowd; i++) {
    const b = ((i + rng.range(0.1, 0.9)) / h.crowd) * Math.PI * 2;
    const r = rng.range(h.crowdInner, h.crowdOuter);
    makeMonster(state, { x: Math.sin(b) * r, z: Math.cos(b) * r });
  }
}

export function hunterCount(state) {
  let n = 0;
  for (const m of state.monsters) if (HUNTING.has(m.mode) && !m.deep) n++;
  return n;
}
export function attackerCount(state) {
  let n = 0;
  for (const m of state.monsters) if (ATTACKING.has(m.mode) && !m.deep) n++;
  return n;
}
export function attackerCap(state) {
  const mc = state.cfg.monster;
  return mc.attackerCapBase + Math.floor((Math.max(1, state.hordeTarget) - 1) / mc.attackerPerExtra);
}

// Send one from the crowd after you (the one nearest a random bearing, so it can come from anywhere).
export function breakOff(state) {
  const { rng, player: P } = state;
  const crowd = state.monsters.filter((m) => m.mode === MODES.SHAMBLE && m.scatterT <= 0);
  if (!crowd.length) return null;
  const want = rng.range(-Math.PI, Math.PI);
  let best = null, bestD = Infinity;
  for (const m of crowd) {
    const d = Math.abs(Math.atan2(Math.sin(bearingTo(P.pos, m.pos) - want), Math.cos(bearingTo(P.pos, m.pos) - want)));
    if (d < bestD) { best = m; bestD = d; }
  }
  best.mode = MODES.STALK;
  best.bearing = best.targetBearing = bearingTo(P.pos, best.pos);
  best.timer = rng.range(state.cfg.monster.lullMin, state.cfg.monster.lullMax);
  best.pendingAction = null;
  best.beamAccum = 0;
  emit(state, 'break_off', { id: best.id, pos: { ...best.pos } });
  return best;
}

export function stepHorde(state, dt) {
  const { cfg, radio, rng } = state;
  const h = cfg.horde;
  if (radio.phase === 'repair') {
    const byTime = Math.min(h.repairRampCap, 1 + Math.floor(state.t / h.repairRampEvery));
    state.hordeTarget = Math.max(state.hordeTarget, byTime);
  } else if (radio.phase === 'wait') {
    state.waitSpawnTimer -= dt;
    if (state.waitSpawnTimer <= 0) { state.waitSpawnTimer = h.waitSpawnEvery; state.hordeTarget++; }
  }
  state.hordeTarget = Math.min(h.max, state.hordeTarget);

  // too few hunting? after a short delay, another one breaks off from the crowd
  if (hunterCount(state) < state.hordeTarget) {
    state.breakOffTimer -= dt;
    if (state.breakOffTimer <= 0) {
      breakOff(state);
      state.breakOffTimer = rng.range(h.breakOffMin, h.breakOffMax);
    }
  } else state.breakOffTimer = Math.max(state.breakOffTimer, rng.range(h.breakOffMin, h.breakOffMax) * 0.5);

  // the ones that were shot twice are gone once they're far enough out
  for (const m of state.monsters) {
    if (m.mode === MODES.GONE && len(m.pos) >= h.goneDist) {
      m.removed = true;
      emit(state, 'monster_gone', { id: m.id, left: state.monsters.filter((x) => !x.removed).length });
    }
  }
  if (state.monsters.some((m) => m.removed)) state.monsters = state.monsters.filter((m) => !m.removed);
}
