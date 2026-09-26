// Hazards (packet 05, revised): six extra threats, each self-contained with its own counter. None is part
// of a normal night yet — the sandbox (?hazard) tests them one at a time, and so do the tests.
// Scheduling and tuning come next.
import { armFire, spawnFire, stepFire, stepKnockdown } from './fire.js';
import { scatterSwarm, spawnSwarm, stepSwarm } from './swarm.js';
import { spawnTentacle, stepTentacles, tentacleTargets } from './tentacles.js';
import { startCold, stepCold } from './cold.js';
import { spawnGust, stepGust } from './gust.js';
import { spawnZombie, stepZombie, zombieTargets } from './zombie.js';

export const HAZARD_KINDS = ['fire', 'swarm', 'tentacle', 'cold', 'gust', 'zombie'];
const SPAWN = { fire: spawnFire, swarm: spawnSwarm, tentacle: spawnTentacle, cold: startCold, gust: spawnGust, zombie: spawnZombie };

export function createHazards() {
  return { fire: null, fireArmed: false, carBlown: false, downT: 0, swarm: null, tentacles: [], cold: null, gust: null, zombie: null, nextId: 1, carStart: null };
}

export function spawnHazard(state, kind) {
  const fn = SPAWN[kind === 'tentacles' ? 'tentacle' : kind];
  if (!fn) throw new Error(`unknown hazard: ${kind}`);
  fn(state);
}

// The sandbox's way to start one hazard: like spawnHazard, except fire waits for the first flare to go out.
export function startHazardTest(state, kind) {
  if (kind === 'fire') armFire(state);
  else spawnHazard(state, kind);
}

// Runs after the player step, before the monsters (so e.g. a gust's flicker is what they see).
export function stepHazards(state, input, dt) {
  state.player.speedMult = 1; // hazards multiply into this for next tick's movement
  stepKnockdown(state, dt);
  stepFire(state, dt);
  if (!state.alive) return;
  stepSwarm(state, dt);
  stepTentacles(state, input, dt);
  if (!state.alive) return;
  stepCold(state, input, dt);
  stepGust(state, dt);
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
