// One monster's AI.
//   shamble (in the crowd at the edge) → break off → stalk → probe / warn → commit (lunge) → climb
//   → retreat back to the dark → rejoin the crowd.  Shot twice → gone for good.
// Light is the rule: any beam that lands on it sends it running (scattering, for the crowd), unless it's
// already within `closeCharge` of you mid-lunge. It won't enter a flare's circle. It runs from bullet impacts.
import { pushOutOfCar } from './car.js';
import { MODES, ATTACKING } from './modes.js';
import { emit } from './events.js';
import { attackerCap, attackerCount } from './horde.js';
import { bearingTo, dist, forward, len, moveToward, wrapAngle } from './math.js';
import { beamOffset, inBeam, inDeepDark, inDimArea, inFlare, inViewGeometry, isLit } from './perception.js';
import { hitPlayer } from './player.js';

// Where a hunter waits: a few metres from you, but never inside a flare's circle.
export function stalkPoint(state, bearing, rho = state.cfg.monster.stalkMinDist) {
  const f = forward(bearing);
  const p = { x: state.player.pos.x + f.x * rho, z: state.player.pos.z + f.z * rho };
  return outsideFlares(state, p, 1.2);
}

export function outsideFlares(state, p, pad) {
  const R = state.cfg.flares.radius + pad;
  for (let pass = 0; pass < 3; pass++) {
    const fl = inFlare(state, p, pad);
    if (!fl) break;
    let dx = p.x - fl.pos.x, dz = p.z - fl.pos.z;
    let n = Math.hypot(dx, dz);
    if (n < 1e-3) { dx = 1; dz = 0; n = 1; }
    p = { x: fl.pos.x + (dx / n) * R, z: fl.pos.z + (dz / n) * R };
  }
  return p;
}

// Steering for anything running: away from `from`, out of the beam, away from flares.
function fleeDir(state, M, from) {
  const mc = state.cfg.monster;
  let ax = M.pos.x - from.x, az = M.pos.z - from.z;
  let n = Math.hypot(ax, az) || 1;
  ax /= n; az /= n;
  const P = state.player;
  if (inBeam(state, M.pos) || (P.flashlightOn && Math.abs(beamOffset(state, M.pos)) < state.cfg.flashlight.beamHalfAngle * 1.6 && dist(P.pos, M.pos) < state.cfg.flashlight.beamRange)) {
    // veer toward the nearer edge of the beam
    const side = beamOffset(state, M.pos) >= 0 ? 1 : -1;
    const lat = forward(bearingTo(P.pos, M.pos) + side * Math.PI / 2);
    ax += lat.x * mc.fleeBeamSteer; az += lat.z * mc.fleeBeamSteer;
  }
  for (const fl of state.flares) {
    if (fl.state !== 'burning') continue;
    const d = dist(fl.pos, M.pos), R = state.cfg.flares.radius + 2;
    if (d < R) {
      const k = mc.fleeFlareSteer * (1 - d / R) * 2;
      ax += ((M.pos.x - fl.pos.x) / (d || 1)) * k; az += ((M.pos.z - fl.pos.z) / (d || 1)) * k;
    }
  }
  n = Math.hypot(ax, az) || 1;
  return { x: ax / n, z: az / n };
}

// Walked out into the dark? The nearest of the crowd come for you, fast.
export function stepDeepDark(state) {
  if (!inDeepDark(state)) return;
  const { player: P, cfg } = state;
  const mc = cfg.monster;
  let deep = 0;
  for (const m of state.monsters) if (m.deep && ATTACKING.has(m.mode)) deep++;
  if (deep >= mc.deepDarkPack) return;
  const cands = state.monsters
    .filter((m) => !ATTACKING.has(m.mode) && m.mode !== MODES.GONE && dist(m.pos, P.pos) <= mc.deepDarkRange && !inFlare(state, m.pos))
    .sort((a, b) => dist(a.pos, P.pos) - dist(b.pos, P.pos));
  for (const m of cands.slice(0, mc.deepDarkPack - deep)) beginWarn(state, m, true);
}

export function stepMonster(state, M, dt) {
  const { player: P, cfg, rng } = state;
  const mc = cfg.monster;
  const beamed = inBeam(state, M.pos);
  M.beamTime = beamed ? M.beamTime + dt : 0;
  if (beamed) M.beamAccum += dt;
  else M.beamAccum = Math.max(0, M.beamAccum - mc.beamDecay * dt);
  const lit = M.beamTime >= mc.fleeReaction;
  if (M.deep && !inDeepDark(state) && M.mode === MODES.COMMIT) M.deep = false; // you made it back: normal rules

  switch (M.mode) {
    case MODES.SHAMBLE: {
      if (M.scatterT > 0) {
        M.scatterT -= dt;
        M.pos.x += M.scatterVel.x * dt; M.pos.z += M.scatterVel.z * dt;
        break;
      }
      const flare = inFlare(state, M.pos, 0.5);
      if (lit || flare) { scatter(state, M, flare ? flare.pos : P.pos); break; }
      const h = cfg.horde;
      M.wanderT -= dt;
      if (M.wanderT <= 0 || dist(M.pos, M.wander) < 0.3) {
        const b = M.home + rng.range(-0.35, 0.35);
        const r = rng.range(h.crowdInner, h.crowdOuter);
        M.wander = outsideFlares(state, { x: Math.sin(b) * r, z: Math.cos(b) * r }, 1);
        M.wanderT = rng.range(4, 12);
      }
      moveToward(M.pos, M.wander, h.shambleSpeed * dt);
      break;
    }

    case MODES.STALK: {
      if (lit || inFlare(state, M.pos)) { spotted(state, M); break; }
      const diff = wrapAngle(M.targetBearing - M.bearing);
      const stepA = Math.sign(diff) * Math.min(Math.abs(diff), mc.orbitSpeed * dt);
      M.bearing = wrapAngle(M.bearing + stepA);
      const goal = stalkPoint(state, M.bearing);
      const moved = moveToward(M.pos, goal, mc.fleeSpeed * 0.8 * dt) > 0.05 || Math.abs(stepA) > 1e-4;
      pushOutOfCar(cfg, M.pos, 0.4);
      footsteps(state, M, dt, moved);

      if (M.pendingAction) {
        if (Math.abs(wrapAngle(M.targetBearing - M.bearing)) < 0.12) {
          if (M.pendingAction === 'attack') {
            // no attacking into a flare's light: while you stand in one, they wait at its edge
            if (!inFlare(state, P.pos, 1) && attackerCount(state) < attackerCap(state)) beginWarn(state, M, false);
            else toStalk(state, M, rng.range(1, 3));
          } else beginProbe(state, M);
        }
      } else {
        M.timer -= dt;
        if (M.timer <= 0) chooseNext(state, M);
        else if (rng.chance(dt * 0.25)) M.targetBearing = wrapAngle(M.bearing + rng.range(-0.8, 0.8));
      }
      break;
    }

    case MODES.PROBE: {
      if (lit || inFlare(state, M.pos)) { spotted(state, M); break; }
      M.timer -= dt;
      const inT = M.timer > mc.probeTime / 2;
      const goal = stalkPoint(state, M.bearing, Math.max(2.5, mc.stalkMinDist - (inT ? 4 : 0)));
      moveToward(M.pos, goal, (inT ? 5 : 7) * dt);
      pushOutOfCar(cfg, M.pos, 0.4);
      footsteps(state, M, dt, true);
      if (M.timer <= 0) toStalk(state, M, rng.range(mc.lullMin, mc.lullMax));
      break;
    }

    case MODES.WARN: {
      if (!M.deep && (lit || inFlare(state, M.pos))) { repel(state, M); break; }
      M.timer -= dt;
      if (M.timer <= 0) {
        M.mode = MODES.COMMIT;
        M.commitTime = 0;
        M.beamAccum = 0;
        emit(state, 'lunge', { id: M.id, attack: M.attackId, pos: { ...M.pos }, deep: M.deep });
      }
      break;
    }

    case MODES.COMMIT: {
      M.commitTime += dt;
      const d = dist(M.pos, P.pos);
      if (inFlare(state, M.pos)) { spotted(state, M); break; }
      if (!M.deep && lit && d > mc.closeCharge) { repel(state, M); break; }
      let speed = inDimArea(state, M.pos) ? mc.commitSpeedLight : mc.commitSpeedDark;
      if (M.deep) speed *= mc.deepDarkSpeedMult;
      if (inViewGeometry(state, M.pos) && isLit(state, M.pos)) M.attackSeen = true;
      const remaining = moveToward(M.pos, P.pos, speed * dt);
      pushOutOfCar(cfg, M.pos, 0.4);
      if (P.onCar && P.mantle <= 0) {
        if (dist(M.pos, P.pos) <= mc.climbReach) {
          M.mode = MODES.CLIMB;
          M.climbT = mc.climbTime;
          M.beamAccum = 0;
          emit(state, 'climb', { id: M.id, attack: M.attackId, pos: { ...M.pos } });
        }
      } else if (remaining <= mc.hitRange) {
        if (P.invuln <= 0) hitPlayer(state, M);
        toRetreat(state, M);
      } else if (M.commitTime > mc.commitTimeout && !M.deep) {
        emit(state, 'give_up', { id: M.id, attack: M.attackId });
        toRetreat(state, M);
      }
      break;
    }

    case MODES.CLIMB: {
      M.climbT -= dt;
      if (M.beamAccum >= mc.spotRepelTime) { repel(state, M); break; }
      if (M.climbT <= 0) {
        if (P.onCar && dist(M.pos, P.pos) <= mc.climbReach + 0.6 && P.invuln <= 0) {
          hitPlayer(state, M);
          toRetreat(state, M);
        } else {
          M.mode = MODES.COMMIT; // you got down — keep coming
        }
      }
      break;
    }

    case MODES.RETREAT: {
      const from = M.fleeFrom || P.pos;
      const dir = fleeDir(state, M, from);
      M.pos.x += dir.x * mc.fleeSpeed * dt; M.pos.z += dir.z * mc.fleeSpeed * dt;
      pushOutOfCar(cfg, M.pos, 0.4);
      footsteps(state, M, dt, true);
      M.timer -= dt;
      const outInDark = M.timer < 5.2 && len(M.pos) >= cfg.horde.crowdInner && !beamed && !inFlare(state, M.pos, 1);
      if (outInDark || M.timer <= 0) {
        if (M.fleeTap && !inDeepDark(state)) {
          M.bearing = M.targetBearing = bearingTo(P.pos, M.pos);
          toStalk(state, M, rng.range(0.6, 1.3));
          emit(state, 'double_tap_armed', { id: M.id });
        } else toShamble(state, M);
      }
      break;
    }

    case MODES.GONE: {
      const dir = fleeDir(state, M, { x: 0, z: 0 });
      M.pos.x += dir.x * mc.fleeSpeed * 0.8 * dt; M.pos.z += dir.z * mc.fleeSpeed * 0.8 * dt;
      pushOutOfCar(cfg, M.pos, 0.4);
      break;
    }
  }
}

export function footsteps(state, M, dt, moving) {
  if (!moving) return;
  M.stepTimer -= dt;
  if (M.stepTimer <= 0) {
    M.stepTimer = state.cfg.monster.stepInterval * state.rng.range(0.8, 1.25);
    emit(state, 'step', { id: M.id, pos: { ...M.pos } });
  }
}

// A shambler caught in the light (or a flare, or near a bullet impact) scatters: a quick run away and sideways.
export function scatter(state, M, from) {
  const { cfg, rng } = state;
  const mc = cfg.monster;
  const away = bearingTo(from, M.pos) + rng.range(-0.7, 0.7);
  let f = forward(away);
  const tmp = { pos: M.pos };
  const d = fleeDir(state, tmp, from); // prefers leaving the beam sideways
  f = { x: (f.x + d.x) / 2, z: (f.z + d.z) / 2 };
  const n = Math.hypot(f.x, f.z) || 1;
  M.scatterVel = { x: (f.x / n) * mc.scatterSpeed, z: (f.z / n) * mc.scatterSpeed };
  M.scatterT = mc.scatterTime * rng.range(0.8, 1.3);
  M.wanderT = 0;
  emit(state, 'scatter', { id: M.id, pos: { ...M.pos } });
}

export function toShamble(state, M) {
  M.mode = MODES.SHAMBLE;
  M.deep = false;
  M.home = Math.atan2(M.pos.x, M.pos.z);
  M.wanderT = 0;
  M.pendingAction = null;
  M.fleeFrom = null;
}

export function toStalk(state, M, lull) {
  M.mode = MODES.STALK;
  M.deep = false;
  M.timer = lull;
  M.pendingAction = null;
  M.beamAccum = 0;
  M.fleeFrom = null;
}

// Run for the dark. `from` is what it's running from (default: you).
export function toRetreat(state, M, from = null) {
  M.mode = MODES.RETREAT;
  M.fleeFrom = from ? { ...from } : null;
  M.fleeTap = state.rng.chance(state.cfg.monster.doubleTapChance);
  M.timer = 6;
  M.scatterT = 0;
  emit(state, 'retreat', { id: M.id });
}

export function repel(state, M) {
  emit(state, 'repel', { id: M.id, attack: M.attackId, pos: { ...M.pos } });
  toRetreat(state, M);
}

export function spotted(state, M) {
  emit(state, 'spotted', { id: M.id, pos: { ...M.pos }, from: M.mode });
  toRetreat(state, M);
}

// Shot: the first hit makes it bleed and run; the second, it leaves the field for good.
export function woundMonster(state, M) {
  M.wounds++;
  if (M.wounds >= 2) {
    M.mode = MODES.GONE;
    M.deep = false;
    emit(state, 'fled_for_good', { id: M.id, pos: { ...M.pos } });
  } else {
    emit(state, 'wounded', { id: M.id, pos: { ...M.pos } });
    toRetreat(state, M);
  }
}

// Everything near where a bullet lands runs from that spot.
export function bulletScare(state, at, exceptId) {
  const r = state.cfg.monster.impactRadius;
  for (const m of state.monsters) {
    if (m.id === exceptId || m.mode === MODES.GONE || m.deep || dist(m.pos, at) > r) continue;
    if (m.mode === MODES.SHAMBLE) scatter(state, m, at);
    else if (m.mode !== MODES.RETREAT) toRetreat(state, m, at);
  }
}

export function chooseNext(state, M) {
  const { player: P, cfg, rng } = state;
  const mc = cfg.monster;
  const SECTORS = 12;
  const rels = [], weights = [];
  for (let i = 0; i < SECTORS; i++) {
    const rel = wrapAngle((i / SECTORS) * Math.PI * 2 + rng.range(-0.2, 0.2));
    rels.push(rel);
    weights.push(Math.abs(rel) <= cfg.perception.viewHalfAngle ? mc.seenWeight : mc.unseenWeight);
  }
  const rel = rng.pickWeighted(rels, weights);
  M.targetBearing = wrapAngle(P.yaw + rel);
  M.pendingAction = rng.chance(mc.probeChance) ? 'probe' : 'attack';
  emit(state, 'choose', { id: M.id, action: M.pendingAction, rel: +rel.toFixed(3) });
}

export function beginProbe(state, M) {
  M.mode = MODES.PROBE;
  M.timer = state.cfg.monster.probeTime;
  M.pendingAction = null;
  M.beamAccum = 0;
  emit(state, 'probe', { id: M.id, pos: { ...M.pos } });
}

export function beginWarn(state, M, deep) {
  const P = state.player;
  M.mode = MODES.WARN;
  M.timer = deep ? state.cfg.monster.deepDarkWarnTime : state.cfg.monster.warnTime;
  M.pendingAction = null;
  M.attackId = ++state.attackId;
  M.attackSeen = false;
  M.deep = deep;
  M.scatterT = 0;
  M.approachRel = wrapAngle(bearingTo(P.pos, M.pos) - P.yaw);
  emit(state, 'warn', {
    id: M.id,
    attack: M.attackId,
    pos: { ...M.pos },
    rel: +M.approachRel.toFixed(3),
    inView: inViewGeometry(state, M.pos),
    deep,
  });
}
