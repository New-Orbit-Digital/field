// Cold: body heat drains, faster standing still and faster again up on the roof. Flares, the fire and
// the car's exhaust warm you. Low: your aim shakes. Empty: you're slowed (no damage — Justin's call).
import { emit } from '../events.js';
import { carToWorld } from '../car.js';
import { dist } from '../math.js';
import { fireWarmth } from './fire.js';

export function startCold(state) {
  const hz = state.hazards;
  if (hz.cold) return;
  hz.cold = { numb: false };
  state.player.heat = state.cfg.hazards.cold.max;
  emit(state, 'cold_start');
}

export function exhaustPos(state) {
  return carToWorld(state.cfg, { x: -state.cfg.car.halfLength - 0.1, z: 0.45 });
}

export function stepCold(state, input, dt) {
  const C = state.hazards.cold;
  const P = state.player;
  if (!C) { P.aimShake = 0; return; }
  const cc = state.cfg.hazards.cold;
  const moving = Math.hypot(input.moveX || 0, input.moveZ || 0) > 0.1 && !P.held;
  let warm = 0;
  for (const f of state.flares) if (f.state === 'burning' && dist(f.pos, P.pos) < cc.flareRange) warm = Math.max(warm, cc.flareWarm);
  warm = Math.max(warm, fireWarmth(state, P.pos));
  if (!P.onCar && dist(exhaustPos(state), P.pos) < cc.exhaustRange) warm = Math.max(warm, cc.exhaustWarm);
  C.warming = warm > 0;
  const drain = cc.drain * (moving ? 1 : cc.stillMult) * (P.onCar ? cc.roofMult : 1);
  P.heat = Math.max(0, Math.min(cc.max, P.heat + (warm > 0 ? warm : -drain) * dt));
  P.aimShake = P.heat < cc.shakeBelow ? cc.shakeMax * (1 - P.heat / cc.shakeBelow) : 0;
  P.shakePhase = (P.shakePhase || 0) + dt * 23;
  if (P.heat <= 0 && !C.numb) { C.numb = true; emit(state, 'cold_numb'); }
  if (P.heat > cc.max * 0.15 && C.numb) { C.numb = false; emit(state, 'cold_recovered'); }
  if (C.numb) P.speedMult *= cc.slowMult;
}
