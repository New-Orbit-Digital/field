// The overturned car as an oriented box: collision, standing on top, and the pickup spots.
// Its pose (cfg.car.x, cfg.car.z, cfg.car.yaw) can change during a night: rammers shove it around.

export function worldToCar(cfg, p) {
  const c = Math.cos(cfg.car.yaw), s = Math.sin(cfg.car.yaw);
  const x = p.x - (cfg.car.x || 0), z = p.z - (cfg.car.z || 0);
  return { x: x * c - z * s, z: x * s + z * c };
}
export function carToWorld(cfg, l) {
  const c = Math.cos(cfg.car.yaw), s = Math.sin(cfg.car.yaw);
  return { x: l.x * c + l.z * s + (cfg.car.x || 0), z: -l.x * s + l.z * c + (cfg.car.z || 0) };
}
// direction (not a point) from car-local to world
export function carDirToWorld(cfg, l) {
  const c = Math.cos(cfg.car.yaw), s = Math.sin(cfg.car.yaw);
  return { x: l.x * c + l.z * s, z: -l.x * s + l.z * c };
}
// Signed distance from a world point to the car's footprint (negative = inside).
export function carDistance(cfg, p) {
  const l = worldToCar(cfg, p);
  const dx = Math.abs(l.x) - cfg.car.halfLength, dz = Math.abs(l.z) - cfg.car.halfWidth;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
export function carClosestPoint(cfg, p) {
  const l = worldToCar(cfg, p);
  const hx = cfg.car.halfLength, hz = cfg.car.halfWidth;
  let cx = Math.max(-hx, Math.min(hx, l.x)), cz = Math.max(-hz, Math.min(hz, l.z));
  if (Math.abs(l.x) <= hx && Math.abs(l.z) <= hz) {
    // inside: snap to nearest face
    if (hx - Math.abs(l.x) < hz - Math.abs(l.z)) cx = Math.sign(l.x || 1) * hx; else cz = Math.sign(l.z || 1) * hz;
  }
  return carToWorld(cfg, { x: cx, z: cz });
}
export function pushOutOfCar(cfg, p, r) {
  const d = carDistance(cfg, p);
  if (d >= r) return false;
  const q = carClosestPoint(cfg, p);
  let nx = p.x - q.x, nz = p.z - q.z;
  let n = Math.hypot(nx, nz);
  if (d < 0 || n < 1e-6) { nx = -nx; nz = -nz; n = Math.hypot(nx, nz) || 1; }
  const push = d < 0 ? r + n : r;
  p.x = q.x + (nx / n) * push;
  p.z = q.z + (nz / n) * push;
  return true;
}
export function insideCarTop(cfg, p, margin = 0) {
  const l = worldToCar(cfg, p);
  return Math.abs(l.x) <= cfg.car.halfLength - margin && Math.abs(l.z) <= cfg.car.halfWidth - margin;
}
export function spotWorld(cfg, name) {
  const s = cfg.spots[name];
  return { stand: carToWorld(cfg, s.stand), face: carToWorld(cfg, s.face) };
}
