// FIELD — bootstrap and the fixed-step game loop. Everything else lives in:
//   src/sim     game rules (no rendering)      src/render  three.js scene
//   src/audio   procedural sound               src/ui      input, HUD, overlays, debug
import { createGame, step, MODES, wrapAngle, spotWorld } from './sim/game.js';
import { randomSeed } from './sim/rng.js';
import { objectiveBot } from './sim/bots.js';
import { createWorld } from './render/world.js';
import { createAudio } from './audio/index.js';
import { createInput } from './ui/input.js';
import * as hud from './ui/hud.js';
import { renderDebug } from './ui/debugPanel.js';
import { showOverlay, setupTitle, showGameOver } from './ui/screens.js';
import { $, safeGet, safeSet } from './ui/dom.js';

const canvas = $('game');
const params = new URLSearchParams(location.search);

let seed = params.get('seed') || randomSeed();
let game = createGame(seed);
const world = createWorld(canvas, game.cfg);
let audio = null;

const view = { pitch: -0.05, debug: params.has('debug'), moving: false };
let phase = 'title'; // title | playing | paused | over
let eventCursor = 0;
let best = Number(safeGet('field.best') || 0);

// Demo mode: a scripted player plays so the game can be previewed on phones.
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
const demo = params.has('demo') || touchOnly;
let bot = null, botCursor = 0;

const input = createInput(canvas, {
  isPlaying: () => phase === 'playing',
  onLook(dx, dy) {
    game.player.yaw = wrapAngle(game.player.yaw - dx * 0.0023);
    view.pitch = Math.max(-0.5, Math.min(0.35, view.pitch - dy * 0.0018));
  },
  onDebug() { view.debug = !view.debug; $('debug').hidden = !view.debug; },
  onKey(code) { if (code === 'KeyR' && phase === 'over') start(seed); },
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && phase === 'playing' && !demo) pause();
});
$('overlay').addEventListener('click', () => {
  if (phase === 'title') start(seed);
  else if (phase === 'paused') resume();
  else if (phase === 'over') start(randomSeed());
});
addEventListener('resize', () => world.resize());

function lock() { if (!demo) canvas.requestPointerLock?.(); }

function start(newSeed) {
  seed = newSeed;
  game = createGame(seed);
  world.reset();
  eventCursor = 0;
  input.reset();
  if (audio) audio.stopAll();
  if (!audio) audio = createAudio();
  audio.resume();
  bot = demo ? objectiveBot({ reaction: 0.45, missChance: 0.15, seed: Math.floor(Math.random() * 1e6) }) : null;
  botCursor = 0;
  $('demoTag').hidden = !demo;
  phase = 'playing';
  showOverlay(null);
  lock();
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  history.replaceState(null, '', url);
}
function pause() { phase = 'paused'; audio?.suspend(); showOverlay('paused'); }
function resume() { phase = 'playing'; audio?.resume(); showOverlay(null); lock(); }

function over() {
  phase = 'over';
  document.exitPointerLock?.();
  if (game.won && (!best || game.t < best)) { best = game.t; safeSet('field.best', String(best)); }
  showGameOver(game, seed, best);
}

// ---------- fixed-step loop ----------
let last = performance.now();
let acc = 0;
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (phase === 'playing' && !window.__field?.frozen) {
    const axes = input.axes();
    view.moving = axes.moveX !== 0 || axes.moveZ !== 0;
    acc += dtReal;
    const dt = game.cfg.sim.dt;
    while (acc >= dt && game.alive) {
      let tickInput = input.sample(game.player.yaw);
      if (bot) {
        const fresh = game.events.slice(botCursor);
        botCursor = game.events.length;
        tickInput = bot(game, fresh, dt);
        view.moving = (tickInput.moveZ || 0) !== 0 || (tickInput.moveX || 0) !== 0;
      }
      step(game, tickInput, dt);
      acc -= dt;
    }
    for (; eventCursor < game.events.length; eventCursor++) {
      const e = game.events[eventCursor];
      audio?.onEvent(e, game);
      world.onEvent(e, game);
      hud.onEvent(e, game);
    }
    audio?.tick(dtReal, game, view.moving);
    if (!game.alive) over();
  } else {
    acc = 0;
    view.moving = false;
  }

  world.update(game, view, dtReal);
  hud.update(game, phase, world);
  if (view.debug) renderDebug(game, seed);
  requestAnimationFrame(frame);
}

$('debug').hidden = !view.debug;
setupTitle({ seed, best, demo });
showOverlay('title');
requestAnimationFrame(frame);

// Test hook for headless screenshots (no pointer lock / audio needed).
window.__field = {
  get game() { return game; },
  startHeadless(s) { seed = s; game = createGame(s); world.reset(); eventCursor = 0; phase = 'playing'; showOverlay(null); },
  set(fn) { fn(game, view); },
  frozen: false,
  spot: (name) => spotWorld(game.cfg, name),
  MODES,
};
