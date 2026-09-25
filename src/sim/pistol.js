// Pistol: firing (with recoil), reloading, and the active 'perfect reload' window.
import { emit } from './events.js';
import { bearingTo, dist, forward, wrapAngle } from './math.js';
import { bulletScare, woundMonster } from './monster.js';
import { MODES } from './modes.js';
import { aimYaw } from './perception.js';

export function reloadProgress(P) {
  return P.reloadTotal > 0 ? 1 - P.reloading / P.reloadTotal : 0;
}

export function startReload(state) {
  const { player: P, cfg, rng } = state;
  const pc = cfg.pistol;
  P.reloading = pc.reloadTime;
  P.reloadTotal = pc.reloadTime;
  P.reloadTried = false;
  const a = rng.range(pc.perfectStartMin, pc.perfectStartMax);
  P.reloadWindow = { a, b: a + pc.perfectWidth };
  emit(state, 'reload_start', { window: P.reloadWindow });
}

export function finishReload(state, perfect) {
  const { player: P, cfg } = state;
  const n = Math.min(cfg.pistol.magSize - P.mag, P.reserve);
  P.mag += n; P.reserve -= n;
  P.reloadWindow = null;
  emit(state, perfect ? 'reload_perfect' : 'reload_done', { mag: P.mag, reserve: P.reserve });
}

export function fire(state) {
  const { player: P, cfg } = state;
  const aim = aimYaw(state); // the shot goes where you're pointing right now, waver included
  P.mag--;
  P.fireCd = cfg.pistol.fireCooldown;
  P.recoil = Math.min(cfg.pistol.recoilMax, P.recoil + cfg.pistol.recoilKick);
  P.recoilPhase = state.rng.range(0, Math.PI * 2);
  let best = null, bestD = Infinity;
  for (const m of state.monsters) {
    if (m.mode === MODES.GONE) continue;
    const d = dist(P.pos, m.pos);
    if (d > cfg.pistol.range || d < 0.01) continue;
    const tol = cfg.pistol.aimTolerance + Math.atan(cfg.pistol.bodyRadius / d);
    const rel = Math.abs(wrapAngle(bearingTo(P.pos, m.pos) - aim));
    if (rel <= tol && d < bestD) { best = m; bestD = d; }
  }
  emit(state, 'shot', { hit: best ? best.id : null, mag: P.mag });
  // where the bullet ends up: in the monster, or in the snow further out
  const f = forward(aim);
  const at = best ? { ...best.pos } : { x: P.pos.x + f.x * cfg.monster.impactDist, z: P.pos.z + f.z * cfg.monster.impactDist };
  emit(state, 'bullet_impact', { pos: at, hit: best ? best.id : null });
  if (best) {
    emit(state, 'shot_hit', { id: best.id, pos: { ...best.pos }, attack: best.attackId, wounds: best.wounds + 1 });
    woundMonster(state, best);
  }
  bulletScare(state, at, best ? best.id : null);
}

// Recoil settles; reload advances (or a perfect/jam attempt resolves); or a reload starts.
export function stepRecoilAndReload(state, input, dt) {
  const { player: P, cfg } = state;
  P.recoil = Math.max(0, P.recoil - cfg.pistol.recoilDecay * dt);
  P.recoilPhase += cfg.pistol.recoilWobbleHz * Math.PI * 2 * dt;

  if (P.reloading > 0) {
    if (input.reload && !P.reloadTried) {
      P.reloadTried = true;
      const prog = reloadProgress(P);
      if (prog >= P.reloadWindow.a && prog <= P.reloadWindow.b) {
        P.reloading = 0;
        finishReload(state, true);
      } else {
        P.reloading += cfg.pistol.jamPenalty;
        P.reloadTotal += cfg.pistol.jamPenalty;
        emit(state, 'reload_jam', { progress: +prog.toFixed(3) });
      }
    }
    if (P.reloading > 0) {
      P.reloading -= dt;
      if (P.reloading <= 0) { P.reloading = 0; finishReload(state, false); }
    }
  } else if (input.reload && P.mag < cfg.pistol.magSize && P.reserve > 0) {
    startReload(state);
  }
}

// Trigger pull: fire, or click empty (which starts a reload if there's ammo).
export function tryFire(state, input) {
  const { player: P, cfg } = state;
  if (!input.fire || P.fireCd > 0 || P.reloading > 0 || P.interacting) return;
  if (P.mag > 0) fire(state);
  else if (P.reserve > 0) { emit(state, 'dry_fire'); startReload(state); }
  else { emit(state, 'dry_fire'); P.fireCd = cfg.pistol.fireCooldown; }
}
