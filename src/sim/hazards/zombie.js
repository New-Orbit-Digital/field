// Zombie (replaces the statue and the under-car crawler): it just keeps coming, light or no light. It's
// slow, but it grabs you — off the roof, too — and you have a couple of seconds to shove it off by
// alternating A/D before it bites (a hit, and it lets go). A shove knocks it back and it staggers.
// Bullets: each one stops it for a moment; two knock it down (every 5 s a 1-in-6 chance it gets back up);
// two more and it's dead for good — and another one comes in from the edge 20 s later.
import { emit } from '../events.js';
import { pushOutOfCar } from '../car.js';
import { bearingTo, dist, forward, moveToward } from '../math.js';
import { hitPlayer } from '../player.js';
import { attacker, farFromPlayer } from './common.js';

export function spawnZombie(state) {
  const hz = state.hazards;
  if (hz.zombie) return;
  const pos = farFromPlayer(state, state.cfg.hazards.zombie.spawnDist);
  hz.zombie = { pos, yaw: bearingTo(pos, state.player.pos), state: 'walk', t: 0, alt: 0, lastAD: 0, hits: 0 };
  hz.zombieRespawn = null;
  emit(state, 'zombie_start', { pos: { ...pos } });
}

export function stepZombie(state, input, dt) {
  const hz = state.hazards;
  if (hz.zombieRespawn != null) { hz.zombieRespawn -= dt; if (hz.zombieRespawn <= 0) spawnZombie(state); }
  const Z = hz.zombie;
  if (!Z) return;
  const zc = state.cfg.hazards.zombie, P = state.player, cfg = state.cfg;
  Z.t += dt;
  if (Z.state === 'down') {
    Z.upT = (Z.upT || 0) + dt;
    if (Z.upT >= zc.getUpEvery) { Z.upT = 0; if (state.rng.chance(zc.getUpChance)) { Z.state = 'walk'; Z.t = 0; emit(state, 'zombie_up', { pos: { ...Z.pos } }); } }
    return;
  }
  if (Z.state === 'stagger') { if (Z.t >= Z.stagger) { Z.state = 'walk'; Z.t = 0; } return; }
  if (Z.state === 'walk') {
    moveToward(Z.pos, P.pos, zc.speed * dt);
    pushOutOfCar(cfg, Z.pos, 0.4);
    Z.yaw = bearingTo(Z.pos, P.pos);
    const reachable = P.y < cfg.car.top + 0.6 && P.mantle <= 0;
    if (reachable && !P.held && P.invuln <= 0 && dist(Z.pos, P.pos) < zc.grabRange + (P.onCar ? 0.9 : 0)) {
      Z.state = 'grab'; Z.t = 0; Z.alt = 0; Z.lastAD = 0;
      P.held = 'zombie'; P.interacting = false; P.hold = 0;
      if (P.onCar || P.y > 0) {
        P.onCar = false; P.grounded = true; P.y = 0; P.vy = 0;
        pushOutOfCar(cfg, P.pos, cfg.player.radius);
        emit(state, 'knocked_off');
      }
      emit(state, 'zombie_grab', { pos: { ...Z.pos } });
    }
    return;
  }
  // grab: struggle — every change of A/D direction counts
  const s = Math.sign(input.moveX || 0);
  if (s !== 0 && s !== Z.lastAD) { if (Z.lastAD !== 0) Z.alt++; Z.lastAD = s; emit(state, 'struggle', { n: Z.alt }); }
  // stay face to face
  const f = forward(bearingTo(P.pos, Z.pos));
  Z.pos = { x: P.pos.x + f.x * 0.55, z: P.pos.z + f.z * 0.55 };
  if (Z.alt >= zc.shoveFree) {
    P.held = null; P.invuln = Math.max(P.invuln, 1);
    Z.pos = { x: P.pos.x + f.x * zc.shoveDist, z: P.pos.z + f.z * zc.shoveDist };
    pushOutOfCar(cfg, Z.pos, 0.4);
    Z.state = 'stagger'; Z.t = 0; Z.stagger = zc.staggerTime;
    emit(state, 'zombie_shoved', { pos: { ...Z.pos } });
  } else if (Z.t >= zc.biteAfter) {
    P.held = null;
    emit(state, 'zombie_bite', { pos: { ...Z.pos } });
    hitPlayer(state, attacker('zombie', Z.pos));
    Z.state = 'stagger'; Z.t = 0; Z.stagger = 1;
  }
}

// A bullet stops it for a moment (and breaks a grab); two knock it down, four kill it.
export function zombieTargets(state) {
  const Z = state.hazards.zombie;
  if (!Z) return [];
  const zc = state.cfg.hazards.zombie;
  return [{ pos: Z.pos, radius: zc.bodyRadius, onHit() {
    const P = state.player;
    if (Z.state === 'grab') { P.held = null; P.invuln = Math.max(P.invuln, 0.8); }
    Z.hits++;
    emit(state, 'zombie_hit', { pos: { ...Z.pos }, hits: Z.hits });
    if (Z.hits >= zc.hitsToKill) {
      state.hazards.zombie = null;
      state.hazards.zombieRespawn = zc.respawnAfter;
      emit(state, 'zombie_dead', { pos: { ...Z.pos } });
    } else if (Z.hits === zc.hitsToDown) {
      Z.state = 'down'; Z.t = 0; Z.upT = 0;
      emit(state, 'zombie_down', { pos: { ...Z.pos } });
    } else if (Z.state !== 'down') { Z.state = 'stagger'; Z.t = 0; Z.stagger = zc.shotStagger; }
  } }];
}
