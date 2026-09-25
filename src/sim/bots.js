// Scripted players for headless testing and the phone demo. Not used by the game itself.
// Bots hear warnings (like a player with headphones), react after a delay, and turn at a
// limited rate — they don't get to snap-aim.
import { bearingTo, wrapAngle, spotWorld, inFlare, worldToCar, carToWorld, MODES } from './game.js';

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
}

function turnToward(cur, target, rate, dt) {
  const d = wrapAngle(target - cur);
  return wrapAngle(cur + Math.sign(d) * Math.min(Math.abs(d), rate * dt));
}

// Around the wreck rather than into it: if the target is on the other long side, go via the nearer end.
function waypoint(s, to) {
  const cfg = s.cfg;
  const a = worldToCar(cfg, s.player.pos), b = worldToCar(cfg, to);
  const hz = cfg.car.halfWidth, hx = cfg.car.halfLength;
  const blocked = a.z * b.z < 0 && (Math.abs(a.x) < hx + 0.6 || Math.abs(b.x) < hx + 0.6);
  if (!blocked || Math.abs(a.z) < 0.1) return to;
  const ex = (a.x + b.x >= 0 ? 1 : -1) * (hx + 1.1);
  if (Math.abs(a.x) < hx + 0.6) return carToWorld(cfg, { x: ex, z: Math.sign(a.z) * (hz + 0.9) });
  return carToWorld(cfg, { x: ex, z: Math.sign(b.z) * (hz + 0.9) });
}

// Local move input that walks toward a world point regardless of facing.
function moveTo(s, to) {
  const P = s.player;
  to = waypoint(s, to);
  const b = bearingTo(P.pos, to);
  const d = { x: Math.sin(b), z: Math.cos(b) };
  const f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) };
  const l = { x: f.z, z: -f.x };
  return { moveX: -(d.x * l.x + d.z * l.z), moveZ: d.x * f.x + d.z * f.z };
}

// Never reacts: stands still, slowly turns.
export function idleBot() {
  return (s) => ({ moveX: 0, moveZ: 0, yaw: s.player.yaw + 0.002, flashlight: false });
}

// Core reaction logic shared by the bots below.
function threatTracker({ reaction, missChance, seed, trackLag = 0.22 }) {
  const rand = lcg(seed);
  const pending = []; // { at, id }
  let threatId = null;
  const history = []; // { t, x, z } of the current threat — aim lags reality like a human's would
  return {
    rand,
    aimPos(s, m) {
      history.push({ t: s.t, x: m.pos.x, z: m.pos.z });
      while (history.length > 2 && history[1].t <= s.t - trackLag) history.shift();
      return history[0];
    },
    update(s, events) {
      for (const e of events) {
        if (e.type === 'warn' && rand() >= missChance) pending.push({ at: s.t + reaction * (0.8 + rand() * 0.4), id: e.id });
        if ((e.type === 'repel' || e.type === 'hit' || e.type === 'give_up' || e.type === 'shot_hit' || e.type === 'spotted' || e.type === 'retreat') && e.id === threatId) threatId = null;
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (s.t >= pending[i].at) { if (threatId === null) { threatId = pending[i].id; history.length = 0; } pending.splice(i, 1); }
      }
      const m = threatId !== null ? s.monsters.find((x) => x.id === threatId) : null;
      if (m && m.mode === MODES.RETREAT) { threatId = null; return null; }
      return m || null;
    },
  };
}

// Flashlight-only defender (optionally with the pistol). Stays put, scans, turns to warnings.
export function reactiveBot({ reaction = 0.35, missChance = 0, scanRate = 0.6, turnRate = 6, gun = false, seed = 12345 } = {}) {
  const T = threatTracker({ reaction, missChance, seed });
  return (s, events, dt = 1 / 60) => {
    const P = s.player;
    const threat = T.update(s, events);
    let yaw = P.yaw, flashlight = false, fire = false, reload = false, moveZ = 0, moveX = 0;
    if (threat) {
      const want = bearingTo(P.pos, T.aimPos(s, threat));
      yaw = turnToward(P.yaw, want, turnRate, dt);
      flashlight = true;
      if (gun && P.mag > 0 && Math.abs(wrapAngle(want - P.yaw)) < 0.05 && threat.mode === MODES.COMMIT && T.rand() < 0.15) fire = true;
    } else {
      yaw = wrapAngle(P.yaw + scanRate * dt);
      if (gun && P.mag === 0 && P.reserve > 0 && P.reloading <= 0) reload = true;
      if (P.battery < 40) {
        const mv = moveTo(s, { x: 0, z: 0 });
        if (Math.hypot(P.pos.x, P.pos.z) > 3.5) { moveX = mv.moveX; moveZ = mv.moveZ; }
      }
    }
    return { moveX, moveZ, yaw, flashlight, fire, reload };
  };
}

// Plays the objective: repair and call on the radio, fetch ammo, defend with light + gun.
export function objectiveBot({ reaction = 0.4, missChance = 0.1, turnRate = 6, aimNoise = 0.03, seed = 777, flares = true, flareMargin = 3 } = {}) {
  const T = threatTracker({ reaction, missChance, seed });
  let lastFire = 0;
  return (s, events, dt = 1 / 60) => {
    const P = s.player, cfg = s.cfg;
    const threat = T.update(s, events);
    const out = { moveX: 0, moveZ: 0, yaw: P.yaw, flashlight: false, interact: false, fire: false, reload: false, throw: false, jump: false };

    if (threat) {
      const want = bearingTo(P.pos, T.aimPos(s, threat)) + (T.rand() - 0.5) * aimNoise;
      out.yaw = turnToward(P.yaw, want, turnRate, dt);
      out.flashlight = true;
      const aligned = Math.abs(wrapAngle(want - P.yaw)) < 0.04;
      if (P.mag > 0 && aligned && (threat.mode === MODES.COMMIT || threat.mode === MODES.CLIMB) && s.t - lastFire > 0.4) {
        out.fire = true; lastFire = s.t;
      }
      return out;
    }

    // calm moment: housekeeping
    if (P.reloading > 0) return out;
    if (P.mag === 0 && P.reserve > 0) { out.reload = true; return out; }

    const walkTo = (to, face) => {
      const d = Math.hypot(to.x - P.pos.x, to.z - P.pos.z);
      if (d > 0.5) {
        const mv = moveTo(s, to);
        out.moveX = mv.moveX; out.moveZ = mv.moveZ;
        out.yaw = turnToward(P.yaw, bearingTo(P.pos, waypoint(s, to)), turnRate, dt);
        return false;
      }
      if (face) out.yaw = turnToward(P.yaw, bearingTo(P.pos, face), turnRate, dt);
      return true;
    };
    // a flare that will keep lighting `pos` for a few more seconds?
    const covered = (pos) => { const f = inFlare(s, pos); return f && f.burn - f.t > flareMargin; };

    let goal = null;
    if (P.mag + P.reserve < 6) goal = 'ammo';
    else if (s.radio.phase === 'repair' || s.radio.phase === 'call') goal = 'radio';

    if (flares && goal !== 'ammo') {
      // keep a flare burning where we're working (or waiting)
      const here = goal === 'radio' ? spotWorld(cfg, 'radio').stand : spotWorld(cfg, 'flares').stand;
      if (!covered(here)) {
        if (P.flares > 0) {
          if (walkTo(here)) out.throw = true;
          return out;
        }
        if (s.t >= s.flareReadyAt) {
          const sp = spotWorld(cfg, 'flares');
          if (walkTo(sp.stand, sp.face)) out.interact = true;
          return out;
        }
      }
    }

    if (goal) {
      const sp = spotWorld(cfg, goal);
      if (walkTo(sp.stand, sp.face)) out.interact = true;
      return out;
    }
    // waiting for rescue: stand near the car and scan
    out.yaw = wrapAngle(P.yaw + 0.7 * dt);
    return out;
  };
}
