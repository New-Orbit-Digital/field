// Hazards (packet 05): seven extra threats, each self-contained with its own counter. None is part of a
// normal night yet — they're spawned from the sandbox (?hazard=fire,swarm or ?hazard=all, keys 1–7)
// and by tests. Scheduling and tuning come next.
import { spawnFire, stepFire } from './fire.js';
import { spawnSwarm, stepSwarm, swarmTargets } from './swarm.js';
import { spawnTentacle, stepTentacles, stepTrail, tentacleTargets } from './tentacles.js';
import { startCold, stepCold } from './cold.js';
import { spawnGust, stepGust } from './gust.js';
import { spawnStatue, stepStatue, statueTargets } from './statue.js';
import { spawnCrawler, stepCrawler } from './crawler.js';

export const HAZARD_KINDS = ['fire', 'swarm', 'tentacle', 'cold', 'gust', 'statue', 'crawler'];
const SPAWN = { fire: spawnFire, swarm: spawnSwarm, tentacle: spawnTentacle, cold: startCold, gust: spawnGust, statue: spawnStatue, crawler: spawnCrawler };

export function createHazards() {
  return { fire: null, swarm: null, tentacles: [], cold: null, gust: null, statue: null, crawler: null, trail: [], trailT: 0, trailN: 0, nextId: 1 };
}

export function spawnHazard(state, kind) {
  const fn = SPAWN[kind === 'tentacles' ? 'tentacle' : kind];
  if (!fn) throw new Error(`unknown hazard: ${kind}`);
  fn(state);
}

// Runs after the player step, before the monsters (so e.g. a gust's flicker is what they see).
export function stepHazards(state, input, dt) {
  state.player.speedMult = 1; // hazards multiply into this for next tick's movement
  stepTrail(state, dt);
  stepFire(state, dt);
  if (!state.alive) return;
  stepSwarm(state, dt);
  stepTentacles(state, input, dt);
  if (!state.alive) return;
  stepCold(state, input, dt);
  stepGust(state, dt);
  stepStatue(state, dt);
  stepCrawler(state, dt);
}

// Things a bullet can hit besides monsters: { pos, radius, onHit }.
export function hazardTargets(state) {
  if (!state.hazards) return [];
  return [...swarmTargets(state), ...tentacleTargets(state), ...statueTargets(state)];
}

export { fireLight, fireBlocks, douseFire, fireLightPos } from './fire.js';
export { tipHeight } from './tentacles.js';
export { exhaustPos } from './cold.js';
