// Thrown flares: flight, burn, burn-out.
import { emit } from './events.js';
import { forward, len } from './math.js';

export function stepFlares(state, dt) {
  const fc = state.cfg.flares;
  for (const f of state.flares) {
    f.t += dt;
    if (f.state === 'flying' && f.t >= fc.flightTime) { f.state = 'burning'; f.t = 0; emit(state, 'flare_land', { pos: { ...f.pos } }); }
    else if (f.state === 'burning' && f.t >= fc.burnTime) { f.state = 'out'; emit(state, 'flare_out', { pos: { ...f.pos } }); }
  }
  state.flares = state.flares.filter((f) => f.state !== 'out');
}

// Q: throw the flare you're carrying ~throwDist ahead (clamped to the field).
export function tryThrowFlare(state, input) {
  const { player: P, cfg } = state;
  if (!input.throw || P.flares <= 0 || P.reloading > 0 || P.interacting) return;
  P.flares--;
  const f = forward(P.yaw);
  const d = cfg.flares.throwDist;
  const to = { x: P.pos.x + f.x * d, z: P.pos.z + f.z * d };
  const tr = len(to);
  if (tr > cfg.arena.boundRadius) { to.x *= cfg.arena.boundRadius / tr; to.z *= cfg.arena.boundRadius / tr; }
  state.flares.push({ pos: to, from: { ...P.pos }, state: 'flying', t: 0 });
  emit(state, 'flare_throw', { to });
}
