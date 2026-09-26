// Fire (revised): once the first flare is out, the engine has a chance to catch (in the fire test: every
// 10 s, 1 in 6). It smoulders briefly, then burns. It doesn't spread. The longer it burns, the likelier the car
// goes up. If it does: the car's lights are gone for good, and if you're close you're knocked down, take a
// hit, and your flashlight is dead. Hold E at the engine to put it out (extinguisher from the trunk: fast;
// kicking snow: slow). While it burns it's light, so the monsters keep out of it.
import { emit } from '../events.js';
import { carDistance, carToWorld } from '../car.js';
import { dist } from '../math.js';
import { hitPlayer } from '../player.js';
import { attacker } from './common.js';

export function spawnFire(state) {
  const hz = state.hazards;
  if (hz.fire || hz.carBlown) return;
  hz.fire = { phase: 'smolder', t: 0, burnT: 0, douse: 0 };
  emit(state, 'fire_start', { pos: fireLightPos(state) });
}

// The sandbox's fire test: arm it. Once the first flare is out it rolls every igniteEvery s.
export function armFire(state) { state.hazards.fireArmed = true; state.hazards.igniteT = 0; }

export function fireLightPos(state) {
  return carToWorld(state.cfg, { x: 1.8, z: 0 });
}

// Fire as a light source (for perception): { pos, radius } or null.
export function fireLight(state) {
  const f = state.hazards?.fire;
  if (!f) return null;
  const fc = state.cfg.hazards.fire;
  const radius = f.phase === 'smolder' ? 0 : Math.min(fc.lightMax, fc.lightMin + f.burnT * fc.lightGrow);
  return radius > 0 ? { pos: fireLightPos(state), radius, fire: true, state: 'burning' } : null;
}

export function stepFire(state, dt) {
  const hz = state.hazards;
  const fc = state.cfg.hazards.fire;
  if (hz.fireArmed && !hz.fire && !hz.carBlown && !state.flares.some((f) => f.state !== 'out')) {
    hz.igniteT += dt;
    if (hz.igniteT >= fc.igniteEvery) { hz.igniteT = 0; if (state.rng.chance(fc.igniteChance)) { hz.fireArmed = false; spawnFire(state); } }
  }
  const f = hz.fire;
  if (!f) return;
  f.t += dt;
  if (f.phase === 'smolder') {
    if (f.t >= fc.smolderTime) { f.phase = 'burn'; emit(state, 'fire_grow', { pos: fireLightPos(state) }); }
    return;
  }
  f.burnT += dt;
  if (state.rng.next() < f.burnT * fc.explodeK * dt) explode(state);
}

function explode(state) {
  const hz = state.hazards, fc = state.cfg.hazards.fire, P = state.player;
  const at = carToWorld(state.cfg, { x: 0, z: 0 });
  hz.fire = null;
  hz.carBlown = true;
  emit(state, 'car_exploded', { pos: at });
  // every light on the car is gone
  for (let i = 0; i < state.strobes.length; i++) if (state.strobes[i]) { state.strobes[i] = false; emit(state, 'lights_smashed', { side: i === 0 ? 1 : -1, pos: at, cause: 'explosion' }); }
  if (P.onCar || carDistance(state.cfg, P.pos) < fc.blastRange) {
    if (P.flashlightOn || P.battery > 0) emit(state, 'flashlight_broken');
    P.battery = 0; P.flashlightOn = false; P.flashlightLocked = true; P.flashlightBroken = true;
    hitPlayer(state, attacker('explosion', at));
    if (state.alive) { P.held = 'down'; hz.downT = fc.downTime; P.interacting = false; emit(state, 'knocked_down', { time: fc.downTime }); }
  }
}

export function stepKnockdown(state, dt) {
  const hz = state.hazards, P = state.player;
  if (P.held !== 'down') return;
  hz.downT -= dt;
  if (hz.downT <= 0) { P.held = null; emit(state, 'got_up'); }
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
  if (f.douse >= fc.douse) { state.hazards.fire = null; emit(state, 'fire_out'); }
}

export function fireWarmth(state, pos) {
  const L = fireLight(state);
  return L && dist(L.pos, pos) < state.cfg.hazards.fire.warmRange ? state.cfg.hazards.cold.fireWarm : 0;
}
