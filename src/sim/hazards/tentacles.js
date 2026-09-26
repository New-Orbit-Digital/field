// Tentacles (revised): they go for the car, not you. One creeps in from the dark (light slows it), reaches
// the wreck, bursts the flashing lights one side at a time, then hauls the car toward the dark. If the car
// ends up too far from where it started, it's gone — and so are you. Shoot it twice to sever it.
// (This replaces the rammer, the monster that shoved the car.)
import { emit } from '../events.js';
import { carClosestPoint, carDistance, pushOutOfCar } from '../car.js';
import { dist, moveToward } from '../math.js';
import { inBeam, inFlare } from '../perception.js';
import { fireLight } from './fire.js';
import { ringPoint } from './common.js';

export function spawnTentacle(state) {
  const hz = state.hazards, tc = state.cfg.hazards.tentacles;
  if (hz.tentacles.filter((t) => t.state !== 'retract').length >= tc.max) return;
  const origin = ringPoint(state, tc.spawnDist);
  const T = { id: hz.nextId++, origin, tip: { ...origin }, path: [{ ...origin }], state: 'creep', t: 0, hits: 0, grip: null };
  hz.tentacles.push(T);
  emit(state, 'tentacle_start', { id: T.id, pos: { ...origin } });
}

function slowed(state, pos) {
  const L = fireLight(state);
  return inBeam(state, pos) || !!inFlare(state, pos) || (L && dist(L.pos, pos) < L.radius);
}

function sever(state, T) {
  T.state = 'retract';
  emit(state, 'tentacle_severed', { id: T.id, pos: { ...T.tip } });
}

// Move the wreck by (dx, dz), taking you along if you're on the roof.
function haulCar(state, dx, dz) {
  const { cfg, player: P } = state;
  cfg.car.x = (cfg.car.x || 0) + dx; cfg.car.z = (cfg.car.z || 0) + dz;
  if (P.onCar || P.mantle > 0) { P.pos.x += dx; P.pos.z += dz; }
  else pushOutOfCar(cfg, P.pos, cfg.player.radius);
}

export function stepTentacles(state, input, dt) {
  const hz = state.hazards, tc = state.cfg.hazards.tentacles, cfg = state.cfg;
  if (!hz.carStart) hz.carStart = { x: cfg.car.x || 0, z: cfg.car.z || 0 };
  for (const T of hz.tentacles) {
    T.t += dt;
    if (T.state === 'creep') {
      const goal = carClosestPoint(cfg, T.tip);
      moveToward(T.tip, goal, tc.speed * (slowed(state, T.tip) ? tc.litMult : 1) * dt);
      if (dist(T.tip, T.path[T.path.length - 1]) > 0.4) T.path.push({ ...T.tip });
      if (carDistance(cfg, T.tip) < 0.15) {
        T.state = 'smash'; T.t = 0;
        T.side = state.strobes.findIndex((x) => x);
        if (T.side < 0) { T.state = 'drag'; emit(state, 'tentacle_drag', { id: T.id, pos: { ...T.tip } }); }
        else emit(state, 'tentacle_smash', { id: T.id, side: T.side === 0 ? 1 : -1, pos: { ...T.tip } });
      }
    } else if (T.state === 'smash') {
      if (T.t >= tc.smashTime) {
        if (state.strobes[T.side]) { state.strobes[T.side] = false; emit(state, 'lights_smashed', { id: T.id, side: T.side === 0 ? 1 : -1, pos: { ...T.tip }, cause: 'tentacle' }); }
        T.t = 0;
        T.side = state.strobes.findIndex((x) => x);
        if (T.side < 0) { T.state = 'drag'; emit(state, 'tentacle_drag', { id: T.id, pos: { ...T.tip } }); }
        else emit(state, 'tentacle_smash', { id: T.id, side: T.side === 0 ? 1 : -1, pos: { ...T.tip } });
      }
    } else if (T.state === 'drag') {
      const cx = cfg.car.x || 0, cz = cfg.car.z || 0;
      const dx = T.origin.x - cx, dz = T.origin.z - cz, d = Math.hypot(dx, dz) || 1;
      const step = tc.dragSpeed * dt;
      haulCar(state, (dx / d) * step, (dz / d) * step);
      T.tip.x += (dx / d) * step; T.tip.z += (dz / d) * step;
      // the body shortens as it reels the car in
      while (T.path.length > 1 && dist(T.path[T.path.length - 1], T.origin) > dist(T.tip, T.origin)) T.path.pop();
      if (Math.hypot((cfg.car.x || 0) - hz.carStart.x, (cfg.car.z || 0) - hz.carStart.z) >= tc.loseDist && state.alive) {
        emit(state, 'car_lost', { id: T.id, pos: { ...T.tip } });
        state.alive = false;
        state.deathCause = 'car_lost';
        emit(state, 'death', { time: +state.t.toFixed(2), cause: 'car_lost' });
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
    if (T.hits >= tc.hitsToSever) sever(state, T);
  } }));
}
