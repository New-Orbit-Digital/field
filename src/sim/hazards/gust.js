// Whiteout gusts: a warning, then a burst of blizzard from one direction. Flares burn down faster and the
// flashlight cuts in and out. (The renderer triples the snow and drives it hard along state.hazards.gust.dir.)
import { emit } from '../events.js';

export function spawnGust(state) {
  const hz = state.hazards;
  if (hz.gust) return;
  hz.gust = { phase: 'warn', t: 0, flickT: 0, flickOff: false, dir: state.rng.range(0, Math.PI * 2) };
  emit(state, 'gust_warn');
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
  for (const f of state.flares) if (f.state === 'burning') f.t += dt * (gc.flareBurnMult - 1);
  G.flickT += dt;
  if (G.flickT >= gc.flickerEvery) { G.flickT = 0; G.flickOff = state.rng.chance(gc.flickerOffChance); }
  P.flicker = G.flickOff;
  if (G.flickOff && P.flashlightOn) P.flashlightOn = false; // cuts out (quietly — no click)
}
