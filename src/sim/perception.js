// What can be seen and lit: view cone, flashlight beam (with recoil waver), flares, the dim play area, the deep dark.
// There's no circle of light at the wreck any more: the far headlights and the strobes only light it dimly.
import { bearingTo, dist, len, wrapAngle } from './math.js';

export function inViewGeometry(state, pos) {
  const { player, cfg } = state;
  const d = dist(player.pos, pos);
  const rel = Math.abs(wrapAngle(bearingTo(player.pos, pos) - player.yaw));
  if (rel <= cfg.perception.viewHalfAngle) return true;
  if (rel >= Math.PI - cfg.perception.rearHalfAngle && d <= cfg.perception.rearRange) return true;
  return false;
}

// Where the gun and flashlight actually point: facing plus recoil waver.
export function aimYaw(state) {
  const P = state.player;
  return wrapAngle(P.yaw + P.recoil * Math.sin(P.recoilPhase));
}

export function inBeam(state, pos) {
  const { player, cfg } = state;
  if (!player.flashlightOn) return false;
  const d = dist(player.pos, pos);
  if (d > cfg.flashlight.beamRange) return false;
  const rel = Math.abs(wrapAngle(bearingTo(player.pos, pos) - aimYaw(state)));
  return rel <= cfg.flashlight.beamHalfAngle;
}

// Signed angle from the beam's centre line to pos (for steering out of it).
export function beamOffset(state, pos) {
  return wrapAngle(bearingTo(state.player.pos, pos) - aimYaw(state));
}

export function inFlare(state, pos, pad = 0) {
  for (const f of state.flares) if (f.state === 'burning' && dist(f.pos, pos) < state.cfg.flares.radius + pad) return f;
  return null;
}

// Dimly lit by the headlights on the embankment (enough to make out a shape).
export function inDimArea(state, pos) {
  return len(pos) <= state.cfg.arena.darkRadius;
}

export function isLit(state, pos) {
  return inDimArea(state, pos) || inBeam(state, pos) || !!inFlare(state, pos);
}

export function monsterVisible(state, m) {
  return isLit(state, m.pos) && inViewGeometry(state, m.pos);
}

export function inDeepDark(state) {
  return len(state.player.pos) > state.cfg.arena.darkRadius;
}
