// Footprints: your boots and their four-legged tracks, pressed into the snow as everyone moves.
// Hunters' paths show where they came from; around the wreck the prints pile up over the night.

const BOOT_STRIDE = 0.62;   // metres between your prints (alternating feet)
const PAW_STRIDE = 0.55;    // metres between their diagonal pairs

export function createTracks(marks) {
  const last = new Map(); // id -> { x, z, acc, side }
  function walker(id, x, z, stride, onStep) {
    let w = last.get(id);
    if (!w) { w = { x, z, acc: 0, side: 1 }; last.set(id, w); return; }
    const dx = x - w.x, dz = z - w.z;
    const d = Math.hypot(dx, dz);
    if (d > 3) { w.x = x; w.z = z; return; } // teleported (knockback, reset): don't draw a line of prints
    w.acc += d;
    if (d > 1e-4) w.yaw = Math.atan2(dx, dz);
    w.x = x; w.z = z;
    while (w.acc >= stride) { w.acc -= stride; w.side = -w.side; onStep(w); }
  }
  return {
    reset() { last.clear(); },
    update(state) {
      const P = state.player;
      if (P.grounded && !P.onCar && P.mantle <= 0) {
        walker('player', P.pos.x, P.pos.z, BOOT_STRIDE, (w) => {
          const r = { x: Math.cos(w.yaw), z: -Math.sin(w.yaw) }; // to the right of travel
          marks.print(w.x + r.x * 0.12 * w.side, w.z + r.z * 0.12 * w.side, w.yaw, 'boot');
        });
      } else last.delete('player');
      const alive = new Set();
      for (const m of state.monsters) {
        alive.add(m.id);
        walker(m.id, m.pos.x, m.pos.z, PAW_STRIDE, (w) => {
          // a diagonal pair down: front-left + back-right, then front-right + back-left
          const f = { x: Math.sin(w.yaw), z: Math.cos(w.yaw) }, r = { x: f.z, z: -f.x };
          for (const [fw, sd] of [[0.6, 0.2 * w.side], [-0.6, -0.2 * w.side]]) {
            marks.print(w.x + f.x * fw + r.x * sd, w.z + f.z * fw + r.z * sd, w.yaw, 'paw');
          }
        });
      }
      for (const id of last.keys()) if (id !== 'player' && !alive.has(id)) last.delete(id);
    },
  };
}
