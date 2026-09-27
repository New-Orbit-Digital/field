// Whiteout gusts: a warning, then a burst of blizzard from one direction. Flares burn down faster and the
// flashlight cuts in and out. Intensity (G.k) ramps up and down; the renderer drives the snow along G.dir.
import { emit } from '../events.js';
import { pushOutOfCar } from '../car.js';

export function spawnGust(state) {
  const hz = state.hazards;
  if (hz.gust) return;
  hz.gust = { phase: 'warn', t: 0, flickT: 0, flickOff: false, dir: state.rng.range(0, Math.PI * 2) };
  emit(state, 'gust_warn');
}

// Random whiteouts through a normal night (cfg.hazards.gust.random).
export function stepGustSchedule(state, dt) {
  const gc = state.cfg.hazards.gust, hz = state.hazards;
  if (!gc.random) return;
  if (hz.nextGust == null) hz.nextGust = state.t + state.rng.range(gc.firstMin, gc.firstMax);
  if (!hz.gust && state.t >= hz.nextGust) { spawnGust(state); hz.nextGust = state.t + state.rng.range(gc.gapMin, gc.gapMax); }
}

export function stepGust(state, dt) {
  const G = state.hazards.gust;
  if (!G) return;
  const gc = state.cfg.hazards.gust;
  const P = state.player;
  G.t += dt;
  if (G.phase === 'warn' && G.t >= gc.warnTime) { G.phase = 'blow'; G.t = 0; emit(state, 'gust_start'); }
  if (G.phase !== 'blow') return;
  if (G.t >= gc.blowTime) { state.hazards.gust = null; P.flicker = false; emit(state, 'gust_end'); return; }
  // intensity ramps up and down instead of switching on at full strength
  G.k = Math.min(1, G.t / gc.rampTime, (gc.blowTime - G.t) / gc.rampTime);
  for (const f of state.flares) if (f.state === 'burning') f.t += dt * (gc.flareBurnMult - 1) * G.k;
  G.flickT += dt;
  if (G.flickT >= gc.flickerEvery) { G.flickT = 0; G.flickOff = state.rng.chance(gc.flickerOffChance * G.k); }
  P.flicker = G.flickOff;
  // the wind shoves you along with it — on the roof too, where it can blow you off the edge (grabbed or knocked
  // flat, it doesn't move you)
  if (P.grounded && !P.held && P.mantle <= 0) {
    const f = gc.push * G.k * dt;
    P.pos.x += Math.sin(G.dir) * f; P.pos.z += Math.cos(G.dir) * f;
    if (!P.onCar) pushOutOfCar(state.cfg, P.pos, state.cfg.player.radius); // (off the roof edge, movement drops you)
  }
  if (G.flickOff && P.flashlightOn) P.flashlightOn = false; // cuts out (quietly — no click)
}
