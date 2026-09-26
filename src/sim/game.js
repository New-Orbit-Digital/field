// FIELD simulation — pure logic, no rendering, no DOM. Runs identically in the browser and under Node.
// This file wires the systems together and re-exports the public API.
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';
import { startFlare, stepFlares } from './flares.js';
import { createCrowd, stepHorde } from './horde.js';
import { stepDeepDark, stepMonster } from './monster.js';
import { stepPlayer } from './player.js';
import { stepRadio } from './radio.js';

// ---------- setup ----------
export function createGame(seed, overrides = {}) {
  const cfg = mergeConfig(CONFIG, overrides);
  const rng = makeRng(seed);
  const state = {
    seed: String(seed),
    cfg,
    rng,
    t: 0,
    alive: true,
    won: false,
    events: [],
    attackId: 0,
    nextMonsterId: 1,
    hordeTarget: 1,          // how many should be hunting you (the rest shamble at the edge)
    breakOffTimer: 3,
    waitSpawnTimer: cfg.horde.waitSpawnEvery,
    radio: { phase: 'repair', repair: 0, call: 0, rescueLeft: null, rescueDist: cfg.arena.landmarkDistance },
    flares: [],            // { pos, state: 'flying'|'burning', t, from }
    carFlares: cfg.flares.carSupply,
    flareReadyAt: 0,       // the flare box hands out the next one from this time
    strobes: [true, true], // the red/blue flashers on each side of the car: [side +1, side -1]. Breakers smash them.
    player: {
      pos: { x: 0, z: 5 },
      y: 0, vy: 0, grounded: true, onCar: false, mantle: 0,
      yaw: 0,
      health: cfg.player.maxHealth,
      invuln: 0,
      battery: cfg.flashlight.batteryMax,
      flashlightOn: false,
      flashlightLocked: false,
      mag: cfg.pistol.magSize,
      reserve: cfg.pistol.startReserve,
      reloading: 0,
      reloadTotal: 0,      // length of the current reload (grows on a jam)
      reloadWindow: null,  // { a, b } fraction of the reload bar that's the 'perfect' zone
      reloadTried: false,  // one attempt per reload
      recoil: 0,           // current aim kick (radians), decays
      recoilPhase: 0,
      fireCd: 0,
      flares: 0,
      activeSpot: null,    // spot you're standing at and facing (for prompts)
      hold: 0,             // pickup hold progress
      interacting: false,
      interactBlock: false, // a ram knocked you off what you were doing: let go of E and press it again
    },
    monsters: [],
  };
  createCrowd(state);
  startFlare(state);
  return state;
}

export function mergeConfig(base, over) {
  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = typeof base[k] === 'object' ? { ...base[k], ...(over[k] || {}) } : base[k];
  }
  return out;
}

// ---------- step ----------
// input: { moveX, moveZ, yaw, flashlight, interact } (held) + { fire, reload, throw, jump } (edge-triggered)
export function step(state, input, dt = state.cfg.sim.dt) {
  if (!state.alive) return;
  state.t += dt;
  stepPlayer(state, input, dt);
  stepRadio(state, dt);
  stepFlares(state, dt);
  stepHorde(state, dt);
  stepDeepDark(state);
  for (const m of state.monsters) stepMonster(state, m, dt);
}

// Convenience for headless runs.
export function runHeadless(seed, policy, { maxTime = 600, overrides } = {}) {
  const s = createGame(seed, overrides);
  const dt = s.cfg.sim.dt;
  let seen = 0;
  while (s.alive && s.t < maxTime) {
    const newEvents = s.events.slice(seen);
    seen = s.events.length;
    const input = policy(s, newEvents, dt);
    step(s, input, dt);
  }
  return s;
}

// ---------- public API (used by the renderer, UI, bots and tests) ----------
export { forward, bearingTo, wrapAngle } from './math.js';
export { worldToCar, carToWorld, carDirToWorld, carDistance, spotWorld } from './car.js';
export { aimYaw, inViewGeometry, inBeam, inFlare, flareRadius, inDimArea, isLit, monsterVisible, inDeepDark } from './perception.js';
export { MODES, HUNTING } from './modes.js';
export { attackerCap, hunterCount } from './horde.js';
export { reloadProgress } from './pistol.js';
