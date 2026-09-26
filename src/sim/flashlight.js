// Flashlight on/off and the battery (drains while on, recharges off — faster next to the car).
import { carDistance } from './car.js';
import { emit } from './events.js';

export function setFlashlight(state, want, dt) {
  const { player: P, cfg } = state;
  const fl = cfg.flashlight;
  if (P.flashlightBroken) { P.flashlightOn = false; P.flashlightLocked = true; return; }
  if (P.flashlightLocked && P.battery >= fl.restartThreshold) P.flashlightLocked = false;
  const wasOn = P.flashlightOn;
  P.flashlightOn = want && !P.flashlightLocked && P.battery > 0;
  if (P.flashlightOn !== wasOn) emit(state, P.flashlightOn ? 'flash_on' : 'flash_off');
  if (P.flashlightOn) {
    P.battery -= fl.drainPerSec * dt;
    if (P.battery <= 0) {
      P.battery = 0; P.flashlightOn = false; P.flashlightLocked = true;
      emit(state, 'battery_dead');
    }
  } else {
    const nearCar = carDistance(cfg, P.pos) <= fl.carRechargeRange - 2;
    P.battery = Math.min(fl.batteryMax, P.battery + (nearCar ? fl.carRechargePerSec : fl.rechargePerSec) * dt);
  }
}
