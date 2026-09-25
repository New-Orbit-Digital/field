// One monster's AI: stalk → probe → warn → commit (lunge) → climb → retreat, plus dodging the beam.
import { pushOutOfCar } from './car.js';
import { MODES } from './modes.js';
import { emit } from './events.js';
import { attackerCap, attackerCount } from './horde.js';
import { bearingTo, dist, forward, len, moveToward, wrapAngle } from './math.js';
import { inBeam, inDeepDark, inFlare, inViewGeometry, isLit } from './perception.js';
import { hitPlayer } from './player.js';

export function stalkDistance(state, bearing) {
  const { player, cfg } = state;
  const need = cfg.arena.lightRadius + cfg.monster.darkMargin;
  const f = forward(bearing);
  const b = player.pos.x * f.x + player.pos.z * f.z;
  const c = player.pos.x ** 2 + player.pos.z ** 2 - need * need;
  const disc = b * b - c;
  const rho = disc > 0 ? -b + Math.sqrt(disc) : 0;
  return Math.max(cfg.monster.stalkMinDist, rho);
}

export function placeAround(state, bearing, rho) {
  const f = forward(bearing);
  return { x: state.player.pos.x + f.x * rho, z: state.player.pos.z + f.z * rho };
}

export function stepMonster(state, M, dt) {
  const { player: P, cfg, rng } = state;
  const mc = cfg.monster;
  const beamed = inBeam(state, M.pos);
  const deepNow = inDeepDark(state);

  // beam bookkeeping + scramble out of the beam
  M.dodgeCd = Math.max(0, M.dodgeCd - dt);
  M.beamTime = beamed ? M.beamTime + dt : 0;
  if (beamed) M.beamAccum += dt;
  else M.beamAccum = Math.max(0, M.beamAccum - mc.beamDecay * dt);
  const canDodge = M.mode === MODES.COMMIT; // only scrambles when it's coming for you — stalkers just get chased off
  if (beamed && canDodge && M.dodgeT <= 0 && M.dodgeCd <= 0 && M.beamTime >= mc.dodgeReaction) {
    if (rng.chance(mc.dodgeChance)) {
      const away = bearingTo(P.pos, M.pos);
      const side = rng.chance(0.5) ? 1 : -1;
      // sideways out of the beam — and, when it's hunting you, forward too
      const angle = M.mode === MODES.COMMIT ? away + side * (Math.PI / 2 + mc.dodgeForwardAngle) : away + side * Math.PI / 2;
      const perp = forward(angle);
      M.dodgeVel = { x: perp.x * mc.dodgeSpeed, z: perp.z * mc.dodgeSpeed };
      M.dodgeT = mc.dodgeTime;
      M.dodgeCd = mc.dodgeCooldown;
      emit(state, 'dodge', { id: M.id, pos: { ...M.pos } });
    } else {
      M.dodgeCd = mc.dodgeCooldown * 0.5;
    }
  }
  if (M.dodgeT > 0) {
    M.dodgeT -= dt;
    M.pos.x += M.dodgeVel.x * dt;
    M.pos.z += M.dodgeVel.z * dt;
    pushOutOfCar(cfg, M.pos, 0.4);
    if (M.mode === MODES.COMMIT) M.commitTime += dt;
    return;
  }

  switch (M.mode) {
    case MODES.STALK: {
      if (deepNow) {
        // no lull, no circling: out in the dark it's already right there
        const b = bearingTo(P.pos, M.pos);
        const f = forward(b);
        M.pos = { x: P.pos.x + f.x * mc.deepDarkStrikeDist, z: P.pos.z + f.z * mc.deepDarkStrikeDist };
        M.bearing = b;
        beginWarn(state, M, true);
        break;
      }
      const diff = wrapAngle(M.targetBearing - M.bearing);
      const stepA = Math.sign(diff) * Math.min(Math.abs(diff), mc.orbitSpeed * dt);
      M.bearing = wrapAngle(M.bearing + stepA);
      const goal = placeAround(state, M.bearing, stalkDistance(state, M.bearing));
      const moved = moveToward(M.pos, goal, mc.retreatSpeed * dt) > 0.05 || Math.abs(stepA) > 1e-4;
      footsteps(state, M, dt, moved);
      if (inFlare(state, M.pos) || M.beamAccum >= mc.spotRepelTime) { spotted(state, M); break; }

      if (M.pendingAction) {
        if (Math.abs(wrapAngle(M.targetBearing - M.bearing)) < 0.12) {
          if (M.pendingAction === 'attack') {
            if (attackerCount(state) < attackerCap(state)) beginWarn(state, M, false);
            else toStalk(state, M, rng.range(1, 3)); // wait its turn
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
      M.timer -= dt;
      const inT = M.timer > mc.probeTime / 2;
      const edge = Math.max(2.5, stalkDistance(state, M.bearing) - (inT ? 4 : 0));
      const goal = placeAround(state, M.bearing, edge);
      moveToward(M.pos, goal, (inT ? 5 : 7) * dt);
      pushOutOfCar(cfg, M.pos, 0.4);
      footsteps(state, M, dt, true);
      if (inFlare(state, M.pos) || M.beamAccum >= mc.spotRepelTime) { spotted(state, M); break; }
      if (M.timer <= 0) toStalk(state, M, rng.range(mc.lullMin, mc.lullMax));
      break;
    }

    case MODES.WARN: {
      M.timer -= dt;
      if (M.timer <= 0) {
        M.mode = MODES.COMMIT;
        M.commitTime = 0;
        M.beamAccum = 0;
        emit(state, 'lunge', { id: M.id, attack: M.attackId, pos: { ...M.pos } });
      }
      break;
    }

    case MODES.COMMIT: {
      M.commitTime += dt;
      const deep = deepNow;
      let speed = len(M.pos) <= cfg.arena.lightRadius ? mc.commitSpeedLight : mc.commitSpeedDark;
      if (deep) speed *= mc.deepDarkSpeedMult;
      if (beamed) speed *= deep ? mc.deepDarkBeamSlow : mc.beamSlow;
      if (M.beamAccum >= mc.repelTime && (!deep || mc.deepDarkCanRepel)) {
        emit(state, 'repel', { id: M.id, attack: M.attackId, pos: { ...M.pos } });
        toRetreat(state, M);
        break;
      }
      if (inFlare(state, M.pos)) { spotted(state, M); break; }
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
      } else if (M.commitTime > mc.commitTimeout && !deep) {
        emit(state, 'give_up', { id: M.id, attack: M.attackId });
        toRetreat(state, M);
      }
      break;
    }

    case MODES.CLIMB: {
      M.climbT -= dt;
      if (M.beamAccum >= mc.repelTime) {
        emit(state, 'repel', { id: M.id, attack: M.attackId, pos: { ...M.pos } });
        toRetreat(state, M);
        break;
      }
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
      const away = bearingTo(P.pos, M.pos);
      const goal = placeAround(state, away, deepNow ? mc.deepDarkStrikeDist : Math.max(mc.retreatDist, stalkDistance(state, away)));
      const rem = moveToward(M.pos, goal, mc.retreatSpeed * dt);
      pushOutOfCar(cfg, M.pos, 0.4);
      footsteps(state, M, dt, true);
      if (rem < 0.2) {
        M.bearing = away;
        M.targetBearing = away;
        if (deepNow) toStalk(state, M, mc.deepDarkReturnDelay);
        else if (rng.chance(mc.doubleTapChance)) {
          toStalk(state, M, rng.range(mc.doubleTapDelayMin, mc.doubleTapDelayMax));
          emit(state, 'double_tap_armed', { id: M.id });
        } else toStalk(state, M, rng.range(mc.lullMin, mc.lullMax));
      }
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

export function toStalk(state, M, lull) {
  M.mode = MODES.STALK;
  M.timer = lull;
  M.pendingAction = null;
  M.beamAccum = 0;
}

export function toRetreat(state, M) {
  M.mode = MODES.RETREAT;
  M.dodgeT = 0;
  emit(state, 'retreat', { id: M.id });
}

export function spotted(state, M) {
  emit(state, 'spotted', { id: M.id, pos: { ...M.pos }, from: M.mode });
  toRetreat(state, M);
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
