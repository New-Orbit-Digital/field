// Geometry helpers. Conventions: ground plane is (x, z), y is up; the car sits at the origin.
// Facing yaw θ means forward = (sin θ, cos θ); increasing yaw turns left.
import { TAU } from './config.js';

export const forward = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export const bearingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export const wrapAngle = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const len = (v) => Math.hypot(v.x, v.z);

export function moveToward(pos, target, maxStep) {
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxStep || d < 1e-6) { pos.x = target.x; pos.z = target.z; return d; }
  pos.x += (dx / d) * maxStep;
  pos.z += (dz / d) * maxStep;
  return d - maxStep;
}
