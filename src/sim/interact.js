// Holding E at a car spot: radio repair/call, ammo from the trunk, flares from the passenger side.
import { emit } from './events.js';
import { spotWorld } from './car.js';
import { bearingTo, dist, wrapAngle } from './math.js';
import { douseFire } from './hazards/fire.js';

export function spotUsable(state, name) {
  const { player: P, cfg, radio } = state;
  if (name === 'fire') return !!state.hazards?.fire;
  if (name === 'ammo' && state.hazards?.fire && !P.hasExtinguisher) return true; // the extinguisher's in there
  if (name === 'radio') return radio.phase === 'repair' || radio.phase === 'call';
  if (name === 'ammo') return P.reserve < cfg.pistol.maxReserve;
  if (name === 'flares') return P.flares < cfg.flares.carryMax && state.carFlares > 0 && state.t >= state.flareReadyAt;
  return false;
}

export function doInteract(state, name, dt) {
  const { player: P, cfg, radio } = state;
  if (name === 'radio') {
    if (radio.phase === 'repair') {
      radio.repair += dt;
      if (radio.repair >= cfg.radio.repairTime) {
        radio.repair = cfg.radio.repairTime;
        radio.phase = 'call';
        state.hordeTarget++;
        emit(state, 'radio_fixed');
      }
    } else if (radio.phase === 'call') {
      radio.call += dt;
      if (radio.call >= cfg.radio.callTime) {
        radio.call = cfg.radio.callTime;
        radio.phase = 'wait';
        radio.rescueLeft = cfg.radio.rescueTime;
        state.hordeTarget++;
        emit(state, 'radio_called');
      }
    }
    return;
  }
  if (name === 'fire') { douseFire(state, dt); return; }
  P.hold += dt;
  if (name === 'ammo' && state.hazards?.fire && !P.hasExtinguisher) {
    if (P.hold >= cfg.hazards.fire.extinguisherPickup) {
      P.hasExtinguisher = true; P.extinguisher = cfg.hazards.fire.extinguisherCharge; P.hold = 0;
      emit(state, 'extinguisher_pickup');
    }
    return;
  }
  if (name === 'ammo' && P.hold >= cfg.pistol.pickupTime) {
    P.reserve = Math.min(cfg.pistol.maxReserve, P.reserve + cfg.pistol.pickupAmount);
    P.hold = 0;
    emit(state, 'ammo_pickup', { reserve: P.reserve });
  }
  if (name === 'flares' && P.hold >= cfg.flares.pickupTime) {
    P.flares++; state.carFlares--; P.hold = 0;
    state.flareReadyAt = state.t + cfg.flares.restockTime;
    emit(state, 'flare_pickup', {});
  }
}

// Which spot (if any) you're standing at and facing; hold E to use it. Must be on the ground, not reloading.
export function stepInteract(state, input, dt) {
  const { player: P, cfg } = state;
  P.activeSpot = null;
  if (P.grounded && !P.onCar && P.reloading <= 0 && !P.held) {
    for (const name of state.hazards?.fire ? ['fire', 'radio', 'ammo', 'flares'] : ['radio', 'ammo', 'flares']) {
      const s = spotWorld(cfg, name);
      if (dist(P.pos, s.stand) > cfg.spots.standRange) continue;
      if (Math.abs(wrapAngle(bearingTo(P.pos, s.face) - P.yaw)) > cfg.spots.faceHalfAngle) continue;
      P.activeSpot = name;
      break;
    }
  }
  const wasInteracting = P.interacting;
  if (P.interactBlock && !input.interact) P.interactBlock = false; // let go of E: you can start again
  P.interacting = !!(input.interact && !P.interactBlock && P.activeSpot && spotUsable(state, P.activeSpot));
  if (P.interacting) {
    if (!wasInteracting) emit(state, 'interact_start', { spot: P.activeSpot });
    doInteract(state, P.activeSpot, dt);
  } else {
    if (wasInteracting) emit(state, 'interact_stop');
    P.hold = 0;
  }
}
