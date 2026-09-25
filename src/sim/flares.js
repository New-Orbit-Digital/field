// Flares: dropped at your feet (Q), burn, burn out. One is already burning when the night starts.
import { emit } from './events.js';
import { forward, len } from './math.js';
import { pushOutOfCar } from './car.js';

export function startFlare(state) {
  const { cfg } = state;
  const b = cfg.arena.landmarkBearing + Math.PI; // the side away from the headlights
  const pos = { x: Math.sin(b) * cfg.flares.startDistance, z: Math.cos(b) * cfg.flares.startDistance };
  state.flares.push({ pos, from: { ...pos }, state: 'burning', t: 0, burn: cfg.flares.startBurnTime });
  emit(state, 'flare_land', { pos: { ...pos }, burn: cfg.flares.startBurnTime });
}

export function stepFlares(state, dt) {
  const fc = state.cfg.flares;
  for (const f of state.flares) {
    f.t += dt;
    if (f.state === 'flying' && f.t >= fc.flightTime) { f.state = 'burning'; f.t = 0; emit(state, 'flare_land', { pos: { ...f.pos }, burn: f.burn }); }
    else if (f.state === 'burning' && f.t >= f.burn) { f.state = 'out'; emit(state, 'flare_out', { pos: { ...f.pos } }); }
  }
  state.flares = state.flares.filter((f) => f.state !== 'out');
}

// Q: drop the flare you're carrying just in front of your feet.
export function tryThrowFlare(state, input) {
  const { player: P, cfg } = state;
  if (!input.throw || P.flares <= 0 || P.reloading > 0 || P.interacting) return;
  P.flares--;
  const f = forward(P.yaw);
  const d = cfg.flares.dropDist;
  const to = { x: P.pos.x + f.x * d, z: P.pos.z + f.z * d };
  const tr = len(to);
  if (tr > cfg.arena.boundRadius) { to.x *= cfg.arena.boundRadius / tr; to.z *= cfg.arena.boundRadius / tr; }
  pushOutOfCar(cfg, to, 0.15); // facing the hull? it lands at the foot of it
  state.flares.push({ pos: to, from: { ...P.pos }, state: 'flying', t: 0, burn: cfg.flares.burnTime });
  emit(state, 'flare_throw', { to });
}
