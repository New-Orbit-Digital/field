// Packet 05 hazards, one at a time on a quiet stage: each does its damage and each counter works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, spotWorld, bearingTo, MODES, spawnHazard, carDistance, fireLight, inFlare, aimYaw, exhaustPos } from '../src/sim/game.js';

const idle = { moveX: 0, moveZ: 0, flashlight: false, interact: false };
const ticks = (s, n, input = idle) => { for (let i = 0; i < n && s.alive; i++) step(s, typeof input === 'function' ? input(s, i) : { yaw: s.player.yaw, ...input }); };
const secs = (s, t) => Math.round(t / s.cfg.sim.dt);
const types = (s) => s.events.map((e) => e.type);
function quiet(seed = 'HZ') {
  const s = createGame(seed);
  s.flares = []; s.hordeTarget = 0; s.breakOffTimer = 1e9; s.cfg.horde.repairRampCap = 0;
  s.monsters.forEach((m, i) => { m.mode = MODES.SHAMBLE; m.pos = { x: Math.sin(i) * 27, z: Math.cos(i) * 27 }; m.wander = { ...m.pos }; m.wanderT = 1e9; });
  return s;
}
const faceSpot = (s, name) => { const sp = spotWorld(s.cfg, name); s.player.pos = { ...sp.stand }; s.player.yaw = bearingTo(sp.stand, sp.face); };
const aimAt = (s, p) => { s.player.yaw = bearingTo(s.player.pos, p); s.player.recoil = 0; };

// ---------- fire ----------
test('fire: ignored, it spreads, blocks the radio then the trunk, and the car explodes', () => {
  const s = quiet(); spawnHazard(s, 'fire');
  ticks(s, secs(s, 13));
  assert.equal(s.hazards.fire.stage, 2);
  faceSpot(s, 'radio'); ticks(s, 2, { ...idle, interact: true });
  assert.equal(s.player.interacting, false, 'radio blocked at stage 2');
  ticks(s, secs(s, 60));
  assert.equal(s.alive, false);
  assert.ok(types(s).includes('car_exploded'));
  assert.equal(s.deathCause, 'explosion');
});

test('fire: extinguisher from the trunk puts it out fast; snow alone is slower but works', () => {
  const s = quiet(); spawnHazard(s, 'fire');
  faceSpot(s, 'ammo'); ticks(s, secs(s, 1.4), { ...idle, interact: true });
  assert.ok(s.player.hasExtinguisher && s.player.extinguisher > 0);
  faceSpot(s, 'fire'); ticks(s, secs(s, 12), { ...idle, interact: true });
  assert.equal(s.hazards.fire, null);
  assert.ok(types(s).includes('fire_out'));

  const n = quiet('HZ2'); spawnHazard(n, 'fire');
  faceSpot(n, 'fire'); ticks(n, secs(n, 8.5), { ...idle, interact: true });
  assert.ok(n.hazards.fire, 'snow: a stage takes 9 s');
  ticks(n, secs(n, 1), { ...idle, interact: true });
  assert.equal(n.hazards.fire, null, 'snow alone beats a fire you start on straight away');
});

test('fire: a light source (monsters keep out), and the roof over it burns', () => {
  const s = quiet(); spawnHazard(s, 'fire');
  assert.ok(inFlare(s, fireLight(s).pos));
  ticks(s, secs(s, 12.2));
  s.player.pos = { x: 0, z: 0 }; s.player.y = s.cfg.car.top; s.player.onCar = true; s.player.grounded = true;
  const hp = s.player.health;
  ticks(s, secs(s, 2.8));
  assert.ok(s.player.health < hp);
  assert.equal(s.player.onCar, false, 'knocked off the roof');
});

// ---------- swarm ----------
test('swarm: goes for the beam, drains the battery and bites; four shots scatter it', () => {
  const s = quiet(); spawnHazard(s, 'swarm');
  s.player.pos = { x: 0, z: 6 };
  s.hazards.swarm.pos = { x: 0, z: 14 };
  ticks(s, secs(s, 2.5), { ...idle, flashlight: true });
  assert.ok(s.hazards.swarm.on, 'reached you');
  const b = s.player.battery; ticks(s, secs(s, 1), idle);
  assert.ok(s.player.battery < b);
  ticks(s, secs(s, 4));
  assert.ok(s.player.health < s.cfg.player.maxHealth);

  const g = quiet('SW2'); spawnHazard(g, 'swarm');
  g.player.pos = { x: 0, z: 6 }; g.player.reserve = 18;
  g.hazards.swarm.pos = { x: 0, z: 16 };
  let shots = 0;
  for (let i = 0; i < 8 && g.hazards.swarm; i++) {
    g.hazards.swarm.pos = { x: 0, z: 16 };
    aimAt(g, g.hazards.swarm.pos); ticks(g, 1, { ...idle, fire: true }); shots++;
    ticks(g, secs(g, 0.4));
  }
  assert.equal(g.hazards.swarm, null);
  assert.equal(shots, 4);
});

test('swarm: smothers a flare it sits on', () => {
  const s = quiet(); spawnHazard(s, 'swarm');
  s.player.pos = { x: 0, z: 6 };
  s.flares.push({ pos: { x: 8, z: 8 }, from: { x: 8, z: 8 }, state: 'burning', t: 0, burn: 20 });
  s.hazards.swarm.pos = { x: 8, z: 9 };
  ticks(s, secs(s, 3.5));
  assert.equal(s.flares.length, 0, 'flare out in a few seconds');
});

// ---------- tentacles ----------
test('tentacles: follow your footprints, grab, drag; dragged all the way in = death', () => {
  const s = quiet(); s.player.pos = { x: 4, z: 6 };
  // walk a little so there's a trail
  ticks(s, secs(s, 1.5), { ...idle, moveZ: 1 });
  spawnHazard(s, 'tentacle');
  const T = s.hazards.tentacles[0];
  ticks(s, secs(s, 40));
  assert.ok(types(s).includes('tentacle_grab'));
  assert.equal(s.alive, false);
  assert.equal(s.deathCause, 'dragged');
});

test('tentacles: alternating A/D breaks free; two shots sever it; grab pulls you off the roof', () => {
  const s = quiet(); s.player.pos = { x: 4, z: 6 };
  spawnHazard(s, 'tentacle');
  const T = s.hazards.tentacles[0];
  T.tip = { x: 4, z: 6.3 };
  ticks(s, 2);
  assert.ok(s.player.held);
  ticks(s, 40, (g, i) => ({ yaw: g.player.yaw, ...idle, moveX: Math.floor(i / 4) % 2 ? 1 : -1 }));
  assert.ok(types(s).includes('tentacle_escaped'));
  assert.equal(s.player.held, null);

  const g = quiet('TN2'); g.player.pos = { x: 4, z: 6 };
  spawnHazard(g, 'tentacle');
  g.hazards.tentacles[0].tip = { x: 4, z: 9 };
  for (let i = 0; i < 2; i++) { aimAt(g, g.hazards.tentacles[0].tip); ticks(g, 1, { ...idle, fire: true }); ticks(g, secs(g, 0.4)); }
  assert.ok(types(g).includes('tentacle_severed'));

  const r = quiet('TN3'); r.player.pos = { x: 0, z: 0 }; r.player.y = r.cfg.car.top; r.player.onCar = true; r.player.grounded = true;
  spawnHazard(r, 'tentacle'); r.hazards.tentacles[0].tip = { x: 0, z: 0.3 };
  ticks(r, 2);
  assert.equal(r.player.onCar, false);
  assert.ok(carDistance(r.cfg, r.player.pos) >= r.cfg.player.radius - 1e-6);
});

test('tentacles: light only slows them', () => {
  const run = (beam) => {
    const s = quiet('TL'); s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
    spawnHazard(s, 'tentacle'); const T = s.hazards.tentacles[0];
    T.origin = { x: 0, z: 18 }; T.tip = { x: 0, z: 18 }; T.path = [{ ...T.tip }]; T.nextN = 1e9;
    ticks(s, secs(s, 3), { ...idle, flashlight: beam });
    return 18 - T.tip.z;
  };
  const dark = run(false), lit = run(true);
  assert.ok(lit > 0.1 && lit < dark * 0.7, `lit ${lit} vs dark ${dark}`);
});

// ---------- cold ----------
test('cold: drains faster standing still and on the roof; flares and exhaust warm; empty = slowed, no damage', () => {
  const walk = quiet('C1'); spawnHazard(walk, 'cold'); walk.player.pos = { x: 6, z: 6 };
  ticks(walk, secs(walk, 10), (g, i) => ({ yaw: g.player.yaw + 0.05, ...idle, moveZ: 1 }));
  const still = quiet('C2'); spawnHazard(still, 'cold'); still.player.pos = { x: 6, z: 6 };
  ticks(still, secs(still, 10));
  const roof = quiet('C3'); spawnHazard(roof, 'cold'); roof.player.pos = { x: 0, z: 0 }; roof.player.y = roof.cfg.car.top; roof.player.onCar = true;
  ticks(roof, secs(roof, 10));
  assert.ok(walk.player.heat > still.player.heat && still.player.heat > roof.player.heat);

  const warm = quiet('C4'); spawnHazard(warm, 'cold'); warm.player.heat = 20; warm.player.pos = exhaustPos(warm);
  ticks(warm, secs(warm, 3));
  assert.ok(warm.player.heat > 20);

  const numb = quiet('C5'); spawnHazard(numb, 'cold'); numb.player.heat = 0.1; numb.player.pos = { x: 6, z: 6 }; numb.player.yaw = 0;
  ticks(numb, secs(numb, 1));
  const z0 = numb.player.pos.z; ticks(numb, secs(numb, 1), { ...idle, moveZ: 1 });
  const moved = numb.player.pos.z - z0;
  assert.ok(moved < numb.cfg.player.speed * 0.7, `slowed (${moved})`);
  assert.equal(numb.player.health, numb.cfg.player.maxHealth);
  numb.player.heat = 10; ticks(numb, 1);
  assert.ok(numb.player.aimShake > 0);
});

// ---------- gust ----------
test('gust: a warning first, then flares burn fast and the flashlight cuts out', () => {
  const s = quiet(); s.player.pos = { x: 6, z: 6 };
  s.flares.push({ pos: { x: 3, z: 8 }, from: { x: 3, z: 8 }, state: 'burning', t: 0, burn: 20 });
  spawnHazard(s, 'gust');
  assert.equal(types(s).at(-1), 'gust_warn');
  let off = 0, n = 0;
  ticks(s, secs(s, 1.3), { ...idle, flashlight: true });
  ticks(s, secs(s, 6), (g) => { n++; if (!g.player.flashlightOn) off++; return { yaw: g.player.yaw, ...idle, flashlight: true }; });
  assert.ok(off / n > 0.15 && off / n < 0.6, `flicker ${off / n}`);
  assert.ok(s.flares[0].t > 15, 'about 3x burn');
  ticks(s, secs(s, 3));
  assert.equal(s.hazards.gust, null);
  assert.ok(types(s).includes('gust_end'));
});

// ---------- statue ----------
test('statue: frozen in the beam (flares do not count), moves when unlit, hits then resets far away', () => {
  const s = quiet(); s.player.pos = { x: 0, z: 5 };
  spawnHazard(s, 'statue'); s.hazards.statue.pos = { x: 0, z: 15 };
  s.player.yaw = 0;
  s.flares.push({ pos: { x: 0, z: 14 }, from: { x: 0, z: 14 }, state: 'burning', t: 0, burn: 20 });
  ticks(s, secs(s, 2), { ...idle, flashlight: true });
  assert.ok(Math.abs(s.hazards.statue.pos.z - 15) < 1e-6, 'frozen by the beam');
  ticks(s, secs(s, 1));
  assert.ok(s.hazards.statue.pos.z < 14, 'the flare alone does not hold it');
  ticks(s, secs(s, 6));
  assert.ok(types(s).includes('statue_reset'));
  assert.equal(s.player.health, s.cfg.player.maxHealth - 1);
  // shooting it does nothing
  const hp = s.hazards.statue;
  s.player.reserve = 6; aimAt(s, hp.pos); ticks(s, 1, { ...idle, fire: true });
  assert.ok(types(s).includes('ricochet'));
});

// ---------- crawler ----------
test('crawler: near the hull → tell → lunge (rooted, hit, off the roof); beam during the tell repels it', () => {
  const s = quiet(); spawnHazard(s, 'crawler');
  s.player.pos = { x: 0, z: 0 }; s.player.y = s.cfg.car.top; s.player.onCar = true; s.player.grounded = true;
  ticks(s, secs(s, 7));
  const tell = s.events.find((e) => e.type === 'crawler_tell'), grab = s.events.find((e) => e.type === 'crawler_grab');
  assert.ok(tell && grab && grab.t - tell.t >= s.cfg.hazards.crawler.tellTime - 1e-6, 'honest tell');
  assert.equal(s.player.onCar, false);
  assert.ok(s.player.health < s.cfg.player.maxHealth);

  const r = quiet('CR2'); spawnHazard(r, 'crawler');
  const sp = spotWorld(r.cfg, 'radio'); r.player.pos = { ...sp.stand }; r.player.yaw = bearingTo(sp.stand, sp.face);
  ticks(r, secs(r, 7), (g) => ({ yaw: g.player.yaw, ...idle, flashlight: g.hazards.crawler.state === 'tell' }));
  assert.ok(types(r).includes('crawler_repelled'));
  assert.equal(r.player.health, r.cfg.player.maxHealth);

  const w = quiet('CR3'); spawnHazard(w, 'crawler'); w.player.pos = { x: 8, z: 8 };
  ticks(w, secs(w, 10));
  assert.ok(!types(w).includes('crawler_tell'), 'stays put while you keep away');
});

// ---------- general ----------
test('hazards: none active in a normal night; all seven spawn together without errors', () => {
  const s = createGame('NORM');
  ticks(s, secs(s, 30));
  const hz = s.hazards;
  assert.ok(!hz.fire && !hz.swarm && !hz.tentacles.length && !hz.cold && !hz.gust && !hz.statue && !hz.crawler);
  const a = quiet('ALL');
  for (const k of ['fire', 'swarm', 'tentacle', 'cold', 'gust', 'statue', 'crawler']) spawnHazard(a, k);
  ticks(a, secs(a, 60), (g, i) => ({ yaw: g.player.yaw + 0.02, ...idle, moveZ: i % 300 < 150 ? 1 : 0, flashlight: i % 120 < 60, fire: i % 90 === 0 }));
  assert.ok(a.t > 1);
});
