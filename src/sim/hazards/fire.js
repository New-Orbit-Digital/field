// Fire: fuel from the wreck catches at the engine and spreads toward the trunk. It blocks the radio
// (stage 2+) and the trunk (stage 3), makes the roof a hotplate, and blows the car if it isn't out
// before the fuse runs down. Hold E at the engine to fight it: the trunk extinguisher is fast, kicking
// snow is slow. It's light as well, so the monsters keep out of it while it burns.
import { emit } from '../events.js';
import { carToWorld } from '../car.js';
import { dist } from '../math.js';
import { hitPlayer } from '../player.js';
import { attacker } from './common.js';

export function spawnFire(state) {
  const hz = state.hazards;
  if (hz.fire) return;
  hz.fire = { stage: 1, fuse: state.cfg.hazards.fire.fuse, spreadT: 0, douse: 0, roofT: 0 };
  emit(state, 'fire_start', { pos: fireLightPos(state) });
}

// Where the flames are centred: the engine end, creeping back as it spreads.
export function fireLightPos(state) {
  const f = state.hazards.fire;
  const x = 1.8 - ((f ? f.stage : 1) - 1) * 1.6;
  return carToWorld(state.cfg, { x, z: 0 });
}

// Fire as a light source (for perception): { pos, radius } or null.
export function fireLight(state) {
  const f = state.hazards?.fire;
  if (!f) return null;
  return { pos: fireLightPos(state), radius: state.cfg.hazards.fire.lightRadius[f.stage], fire: true, state: 'burning' };
}

// Is a car spot out of reach because it's on fire?
export function fireBlocks(state, spot) {
  const f = state.hazards?.fire;
  if (!f) return false;
  return (spot === 'radio' && f.stage >= 2) || (spot === 'ammo' && f.stage >= 3);
}

export function stepFire(state, dt) {
  const f = state.hazards.fire;
  if (!f) return;
  const fc = state.cfg.hazards.fire;
  const P = state.player;
  f.fuse -= dt;
  f.spreadT += dt;
  if (f.spreadT >= fc.stageEvery && f.stage < 3) {
    f.spreadT = 0; f.stage++;
    emit(state, 'fire_spread', { stage: f.stage, pos: fireLightPos(state) });
  }
  if (P.onCar && f.stage >= 2) {
    f.roofT += dt;
    if (f.roofT >= fc.roofBurnEvery) { f.roofT = 0; if (P.invuln <= 0) { emit(state, 'burned'); hitPlayer(state, attacker('fire', fireLightPos(state))); } }
  } else f.roofT = 0;
  if (f.fuse <= 0 && state.alive) {
    emit(state, 'car_exploded', { pos: carToWorld(state.cfg, { x: 0, z: 0 }) });
    state.alive = false;
    state.deathCause = 'explosion';
    emit(state, 'death', { time: +state.t.toFixed(2), cause: 'explosion' });
  }
}

// Holding E at the engine spot.
export function douseFire(state, dt) {
  const f = state.hazards.fire;
  if (!f) return;
  const fc = state.cfg.hazards.fire;
  const P = state.player;
  let rate = 1 / fc.snowMult;
  if (P.extinguisher > 0) {
    rate = 1;
    P.extinguisher = Math.max(0, P.extinguisher - dt);
    if (P.extinguisher === 0) emit(state, 'extinguisher_empty');
  }
  f.douse += dt * rate;
  if (f.douse >= fc.douse) {
    f.douse = 0; f.stage--; f.spreadT = 0;
    if (f.stage <= 0) { state.hazards.fire = null; emit(state, 'fire_out'); }
    else emit(state, 'fire_down', { stage: f.stage });
  }
}

export function fireWarmth(state, pos) {
  const L = fireLight(state);
  return L && dist(L.pos, pos) < state.cfg.hazards.fire.warmRange ? state.cfg.hazards.cold.fireWarm : 0;
}
