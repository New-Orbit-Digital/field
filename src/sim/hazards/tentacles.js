// Tentacles: they creep in from the dark along your footprints. Light (beam, flare, fire) only slows
// them. One that reaches you grabs you (off the roof, too) and drags you back to where it came from.
// Break free by alternating A/D, or shoot it twice. Dragged all the way in: you're gone.
import { emit } from '../events.js';
import { carDistance, insideCarTop, pushOutOfCar } from '../car.js';
import { dist, moveToward } from '../math.js';
import { inBeam, inFlare } from '../perception.js';
import { fireLight } from './fire.js';
import { ringPoint } from './common.js';

// Your footprints: a position every trailEvery seconds you've moved, numbered so they can be followed.
export function stepTrail(state, dt) {
  const hz = state.hazards, tc = state.cfg.hazards.tentacles, P = state.player;
  hz.trailT += dt;
  if (hz.trailT < tc.trailEvery) return;
  hz.trailT = 0;
  const last = hz.trail[hz.trail.length - 1];
  if (last && dist(last, P.pos) < 0.2) return;
  hz.trail.push({ x: P.pos.x, z: P.pos.z, n: hz.trailN++ });
  if (hz.trail.length > tc.trailMax) hz.trail.shift();
}

export function spawnTentacle(state) {
  const hz = state.hazards, tc = state.cfg.hazards.tentacles;
  if (hz.tentacles.filter((t) => t.state !== 'retract').length >= tc.max) return;
  const origin = ringPoint(state, tc.spawnDist);
  // start on the footprint nearest to where it comes in
  let nextN = hz.trailN, bd = Infinity;
  for (const p of hz.trail) { const d = dist(p, origin); if (d < bd) { bd = d; nextN = p.n; } }
  const T = { id: hz.nextId++, origin, tip: { ...origin }, path: [{ ...origin }], nextN, state: 'creep', hits: 0, alt: 0, lastAD: 0 };
  hz.tentacles.push(T);
  emit(state, 'tentacle_start', { id: T.id, pos: { ...origin } });
}

function slowed(state, pos) {
  const L = fireLight(state);
  return inBeam(state, pos) || !!inFlare(state, pos) || (L && dist(L.pos, pos) < L.radius);
}

function release(state, T, type) {
  const P = state.player;
  T.state = 'retract';
  if (P.held === T.id) { P.held = null; P.invuln = Math.max(P.invuln, state.cfg.hazards.tentacles.regrabGrace); }
  emit(state, type, { id: T.id, pos: { ...T.tip } });
}

export function stepTentacles(state, input, dt) {
  const hz = state.hazards, tc = state.cfg.hazards.tentacles, P = state.player, cfg = state.cfg;
  for (const T of hz.tentacles) {
    if (T.state === 'creep') {
      const trail = hz.trail;
      if (trail.length && trail[0].n > T.nextN) T.nextN = trail[0].n; // those prints have faded
      const wp = trail.find((p) => p.n >= T.nextN);
      const goal = wp || P.pos;
      const sp = tc.speed * (slowed(state, T.tip) ? tc.litMult : 1);
      moveToward(T.tip, goal, sp * dt);
      if (wp && dist(T.tip, wp) < 0.3) T.nextN = wp.n + 1;
      if (dist(T.tip, T.path[T.path.length - 1]) > 0.4) { T.path.push({ ...T.tip }); if (T.path.length > 80) T.path.splice(1, 1); }
      // it can reach up the side of the car for you
      const reachable = P.y < cfg.car.top + 0.6;
      if (reachable && !P.held && P.invuln <= 0 && P.mantle <= 0 && dist(T.tip, P.pos) < tc.grabReach) {
        T.state = 'grab'; T.alt = 0; T.lastAD = 0;
        P.held = T.id;
        P.interacting = false; P.hold = 0;
        if (P.onCar || P.y > 0) {
          P.onCar = false; P.grounded = true; P.y = 0; P.vy = 0;
          pushOutOfCar(cfg, P.pos, cfg.player.radius);
          emit(state, 'knocked_off');
        }
        emit(state, 'tentacle_grab', { id: T.id, pos: { ...P.pos } });
      }
    } else if (T.state === 'grab') {
      // struggle: every change of A/D direction counts
      const s = Math.sign(input.moveX || 0);
      if (s !== 0 && s !== T.lastAD) { if (T.lastAD !== 0) T.alt++; T.lastAD = s; emit(state, 'struggle', { id: T.id, n: T.alt }); }
      if (T.alt >= tc.breakFree) { release(state, T, 'tentacle_escaped'); continue; }
      moveToward(P.pos, T.origin, tc.dragSpeed * dt);
      pushOutOfCar(cfg, P.pos, cfg.player.radius);
      T.tip.x = P.pos.x; T.tip.z = P.pos.z;
      // trim the body as it reels in
      while (T.path.length > 1 && dist(T.path[T.path.length - 1], T.origin) > dist(P.pos, T.origin)) T.path.pop();
      if (dist(P.pos, T.origin) < tc.killDist && state.alive) {
        emit(state, 'dragged_away', { id: T.id, pos: { ...P.pos } });
        state.alive = false;
        state.deathCause = 'dragged';
        emit(state, 'death', { time: +state.t.toFixed(2), cause: 'dragged' });
        return;
      }
    } else if (T.state === 'retract') {
      const back = T.path.length > 1 ? T.path[T.path.length - 1] : T.origin;
      moveToward(T.tip, back, tc.retractSpeed * dt);
      if (T.path.length > 1 && dist(T.tip, back) < 0.3) T.path.pop();
      if (T.path.length <= 1 && dist(T.tip, T.origin) < 0.3) { T.state = 'gone'; emit(state, 'tentacle_gone', { id: T.id }); }
    }
  }
  hz.tentacles = hz.tentacles.filter((T) => T.state !== 'gone');
}

export function tentacleTargets(state) {
  const tc = state.cfg.hazards.tentacles;
  return state.hazards.tentacles.filter((T) => T.state !== 'retract').map((T) => ({ pos: T.tip, radius: tc.bodyRadius, onHit() {
    T.hits++;
    emit(state, 'tentacle_hit', { id: T.id, pos: { ...T.tip }, hits: T.hits });
    if (T.hits >= tc.hitsToSever) release(state, T, 'tentacle_severed');
  } }));
}

// Height of a tentacle tip for rendering: up on the roof if it's over the car.
export function tipHeight(state, p) { return insideCarTop(state.cfg, p) ? state.cfg.car.top : carDistance(state.cfg, p) < 0.3 ? 0.8 : 0; }
