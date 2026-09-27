// Hazards. Active: fire, tentacle, whiteout, zombie — all part of a normal night since packet 08 (each has a
// `random` switch in config). The sandbox (?hazard) still tests them one at a time. Backlogged (code kept,
// out of the sandbox): swarm, cold.
import { armFire, spawnFire, stepFire, stepKnockdown } from './fire.js';
import { scatterSwarm, spawnSwarm, stepSwarm } from './swarm.js';
import { spawnTentacle, stepTentacles, stepTentacleSchedule, tentacleTargets } from './tentacles.js';
import { startCold, stepCold } from './cold.js';
import { spawnGust, stepGust, stepGustSchedule } from './gust.js';
import { spawnZombie, stepZombie, stepZombieSchedule, zombieTargets } from './zombie.js';

export const HAZARD_KINDS = ['fire', 'tentacle', 'gust', 'zombie'];   // the sandbox's list (keys 1–4)
export const BACKLOG_HAZARDS = ['swarm', 'cold'];                     // parked (Justin, 2026-09-26)
const SPAWN = { fire: spawnFire, swarm: spawnSwarm, tentacle: spawnTentacle, cold: startCold, gust: spawnGust, zombie: spawnZombie };

export function createHazards() {
  return { fire: null, fireArmed: false, igniteT: 0, nextGust: null, carBlown: false, downT: 0, swarm: null, tentacles: [], cold: null, gust: null, zombie: null, nextId: 1, carStart: null };
}

export function spawnHazard(state, kind) {
  const fn = SPAWN[kind === 'tentacles' ? 'tentacle' : kind];
  if (!fn) throw new Error(`unknown hazard: ${kind}`);
  fn(state);
}

// The sandbox's way to start one hazard: like spawnHazard, except fire waits for the first flare to go out.
// Testing one hazard switches the night's other random ones (whiteouts, tentacles, fire, zombie) off.
export function isolateHazard(state, kind) {
  const h = state.cfg.hazards;
  if (kind !== 'gust') h.gust.random = false;
  if (kind !== 'tentacle') h.tentacles.random = false;
  if (kind !== 'fire') h.fire.random = false;
  if (kind !== 'zombie') h.zombie.random = false;
}
export function startHazardTest(state, kind) {
  if (kind === 'fire') armFire(state);
  else spawnHazard(state, kind);
}

// Runs after the player step, before the monsters (so e.g. a gust's flicker is what they see).
export function stepHazards(state, input, dt) {
  state.player.speedMult = 1; // hazards multiply into this for next tick's movement
  stepKnockdown(state, dt);
  if (state.cfg.hazards.fire.random && !state.hazards.fireScheduled) { state.hazards.fireScheduled = true; armFire(state); }
  stepFire(state, dt);
  if (!state.alive) return;
  stepSwarm(state, dt);
  stepTentacleSchedule(state, dt);
  stepTentacles(state, input, dt);
  if (!state.alive) return;
  stepCold(state, input, dt);
  stepGustSchedule(state, dt);
  stepGust(state, dt);
  stepZombieSchedule(state);
  stepZombie(state, input, dt);
}

// Things a bullet can hit besides monsters: { pos, radius, onHit }.
export function hazardTargets(state) {
  if (!state.hazards) return [];
  return [...tentacleTargets(state), ...zombieTargets(state)];
}

export { scatterSwarm };
export { fireLight, douseFire, fireLightPos } from './fire.js';
export { exhaustPos } from './cold.js';
