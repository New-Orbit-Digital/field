// Packet 05 hazards (revised after the first playtest), one at a time on a quiet stage: each does its
// damage and each counter works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, spotWorld, bearingTo, MODES, spawnHazard, startHazardTest, carDistance, fireLight, inFlare, exhaustPos } from '../src/sim/game.js';

const idle = { moveX: 0, moveZ: 0, flashlight: false, interact: false };
const ticks = (s, n, input = idle) => { for (let i = 0; i < n && s.alive; i++) step(s, typeof input === 'function' ? input(s, i) : { yaw: s.player.yaw, ...input }); };
const secs = (s, t) => Math.round(t / s.cfg.sim.dt);
const types = (s) => s.events.map((e) => e.type);
function quiet(seed = 'HZ', { keepFlare = false } = {}) {
  const s = createGame(seed);
  if (!keepFlare) s.flares = [];
  s.hordeTarget = 0; s.breakOffTimer = 1e9; s.cfg.horde.repairRampCap = 0;
  s.monsters.forEach((m, i) => { m.mode = MODES.SHAMBLE; m.pos = { x: Math.sin(i) * 27, z: Math.cos(i) * 27 }; m.wander = { ...m.pos }; m.wanderT = 1e9; });
  return s;
}
const faceSpot = (s, name) => { const sp = spotWorld(s.cfg, name); s.player.pos = { ...sp.stand }; s.player.yaw = bearingTo(sp.stand, sp.face); };
const aimAt = (s, p) => { s.player.yaw = bearingTo(s.player.pos, p); s.player.recoil = 0; };

// ---------- fire ----------
test('fire: in the test it can only catch once the first flare is out; then it smoulders, then burns (no spreading)', () => {
  const s = quiet('F0', { keepFlare: true }); s.cfg.hazards.fire.igniteChance = 1; // make the roll certain
  startHazardTest(s, 'fire');
  ticks(s, secs(s, 15));
  assert.equal(s.hazards.fire, null, 'not while the first flare burns');
  s.flares[0].t = s.flares[0].burn; // burn it out
  ticks(s, secs(s, 9.5));
  assert.equal(s.hazards.fire, null, 'the first roll is 10 s after');
  ticks(s, secs(s, 0.6));
  assert.equal(s.hazards.fire.phase, 'smolder');
  assert.equal(fireLight(s), null, 'no light while smouldering');
  ticks(s, secs(s, 2.1));
  assert.equal(s.hazards.fire.phase, 'burn');
  assert.ok(inFlare(s, fireLight(s).pos), 'burning, it is a light');
  faceSpot(s, 'radio'); ticks(s, 2, { ...idle, interact: true });
  assert.equal(s.player.interacting, true, 'it never blocks the radio');
});

test('fire: every 10 s after the first flare, a 1-in-6 chance to catch', () => {
  const rolls = []; const N = 300;
  for (let i = 0; i < N; i++) {
    const s = quiet('FI' + i); s.cfg.hazards.fire.explodeK = 0; s.player.pos = { x: 8, z: 8 };
    startHazardTest(s, 'fire');
    for (let k = 1; k <= 30 && !s.hazards.fire; k++) { ticks(s, secs(s, 10)); if (s.hazards.fire) rolls.push(k); }
  }
  const firstRoll = rolls.filter((k) => k === 1).length / N;
  assert.ok(firstRoll > 0.1 && firstRoll < 0.24, `caught on the first roll: ${firstRoll}`);
  const mean = rolls.reduce((a, b) => a + b, 0) / rolls.length;
  assert.ok(mean > 4.5 && mean < 7.5, `mean rolls to catch ${mean} (expect ~6)`);
});

test('fire: the longer it burns the likelier the car explodes (roughly 1 - exp(-t²/900))', () => {
  let by15 = 0, by30 = 0; const N = 200;
  for (let i = 0; i < N; i++) {
    const s = quiet('FX' + i); s.player.pos = { x: 10, z: 10 };
    spawnHazard(s, 'fire'); ticks(s, secs(s, 2));
    const at = () => s.events.find((e) => e.type === 'car_exploded')?.t;
    ticks(s, secs(s, 15)); if (at()) by15++;
    ticks(s, secs(s, 15)); if (at()) by30++;
  }
  assert.ok(by15 / N > 0.1 && by15 / N < 0.4, `by 15 s: ${by15 / N}`);
  assert.ok(by30 / N > 0.45 && by30 / N < 0.8, `by 30 s: ${by30 / N}`);
});

test('fire: exploding with you close: knocked down, a hit, flashlight dead for good, car lights out; far away: just the lights', () => {
  const s = quiet('FB'); s.cfg.hazards.fire.explodeK = 100; // goes up the moment it burns
  faceSpot(s, 'radio'); s.player.flashlightOn = true;
  spawnHazard(s, 'fire'); ticks(s, secs(s, 2.2));
  assert.ok(types(s).includes('car_exploded'));
  assert.deepEqual(s.strobes, [false, false]);
  assert.equal(s.player.health, s.cfg.player.maxHealth - 1);
  assert.equal(s.player.held, 'down');
  ticks(s, secs(s, 0.5), { ...idle, moveZ: 1, flashlight: true });
  assert.equal(s.player.flashlightOn, false);
  ticks(s, secs(s, 20), { ...idle, flashlight: true });
  assert.equal(s.player.flashlightOn, false, 'flashlight never comes back');
  assert.equal(s.player.held, null, 'back on your feet');
  spawnHazard(s, 'fire'); assert.equal(s.hazards.fire, null, 'a blown car does not catch again');

  const f = quiet('FB2'); f.cfg.hazards.fire.explodeK = 100; f.player.pos = { x: 8, z: 8 };
  spawnHazard(f, 'fire'); ticks(f, secs(f, 2.2));
  assert.deepEqual(f.strobes, [false, false]);
  assert.equal(f.player.health, f.cfg.player.maxHealth);
});

test('fire: extinguisher from the trunk puts it out in 3 s; kicking snow takes 9 s', () => {
  const s = quiet('FE'); s.cfg.hazards.fire.explodeK = 0;
  spawnHazard(s, 'fire');
  faceSpot(s, 'ammo'); ticks(s, secs(s, 1.4), { ...idle, interact: true });
  assert.ok(s.player.hasExtinguisher);
  faceSpot(s, 'fire'); ticks(s, secs(s, 3.1), { ...idle, interact: true });
  assert.equal(s.hazards.fire, null);

  const n = quiet('FS'); n.cfg.hazards.fire.explodeK = 0;
  spawnHazard(n, 'fire'); faceSpot(n, 'fire');
  ticks(n, secs(n, 8.5), { ...idle, interact: true });
  assert.ok(n.hazards.fire);
  ticks(n, secs(n, 0.7), { ...idle, interact: true });
  assert.equal(n.hazards.fire, null);
});

// ---------- swarm ----------
test('swarm: goes for the beam, drains the battery and bites; any shot — even a miss — scatters it', () => {
  const s = quiet(); spawnHazard(s, 'swarm');
  s.player.pos = { x: 0, z: 6 }; s.hazards.swarm.pos = { x: 0, z: 14 };
  ticks(s, secs(s, 2.5), { ...idle, flashlight: true });
  assert.ok(s.hazards.swarm.on);
  const b = s.player.battery; ticks(s, secs(s, 1));
  assert.ok(s.player.battery < b);
  ticks(s, secs(s, 4));
  assert.ok(s.player.health < s.cfg.player.maxHealth);

  const g = quiet('SW2'); spawnHazard(g, 'swarm');
  g.player.pos = { x: 0, z: 6 }; g.hazards.swarm.pos = { x: 0, z: 16 };
  aimAt(g, { x: 20, z: 6 }); // nowhere near it
  ticks(g, 1, { ...idle, fire: true });
  assert.equal(g.hazards.swarm, null);
  assert.ok(types(g).includes('swarm_scattered'));
});

test('swarm: smothers a flare it sits on', () => {
  const s = quiet(); spawnHazard(s, 'swarm');
  s.player.pos = { x: 0, z: 6 };
  s.flares.push({ pos: { x: 8, z: 8 }, from: { x: 8, z: 8 }, state: 'burning', t: 0, burn: 20 });
  s.hazards.swarm.pos = { x: 8, z: 9 };
  ticks(s, secs(s, 3.5));
  assert.equal(s.flares.length, 0);
});

// ---------- tentacle ----------
test('tentacle: goes for the car, bursts both light bars, then hauls the car into the dark (game over)', () => {
  const s = quiet(); s.player.pos = { x: 8, z: 8 };
  spawnHazard(s, 'tentacle');
  ticks(s, secs(s, 60));
  const e = types(s);
  assert.ok(e.indexOf('tentacle_smash') < e.indexOf('lights_smashed'));
  assert.equal(s.events.filter((x) => x.type === 'lights_smashed').length, 2);
  assert.ok(e.includes('tentacle_drag'));
  assert.equal(s.alive, false);
  assert.equal(s.deathCause, 'car_lost');
  assert.equal(s.player.health, s.cfg.player.maxHealth, 'it never touches you');
});

test('tentacle: two shots sever it; while dragging it takes you along on the roof', () => {
  const g = quiet('TN2'); g.player.pos = { x: 4, z: 6 };
  spawnHazard(g, 'tentacle');
  g.hazards.tentacles[0].tip = { x: 4, z: 9 };
  for (let i = 0; i < 2; i++) { aimAt(g, g.hazards.tentacles[0].tip); ticks(g, 1, { ...idle, fire: true }); ticks(g, secs(g, 0.4)); }
  assert.ok(types(g).includes('tentacle_severed'));
  ticks(g, secs(g, 6));
  assert.equal(g.hazards.tentacles.length, 0, 'retracted and gone');

  const r = quiet('TN3'); r.player.pos = { x: 0, z: 0 }; r.player.y = r.cfg.car.top; r.player.onCar = true; r.player.grounded = true;
  spawnHazard(r, 'tentacle'); const T = r.hazards.tentacles[0];
  T.state = 'drag'; T.tip = { x: 2, z: 0 }; r.strobes = [false, false];
  const x0 = r.player.pos.x, c0 = r.cfg.car.x;
  ticks(r, secs(r, 2));
  assert.ok(Math.abs((r.player.pos.x - x0) - (r.cfg.car.x - c0)) < 1e-6 && r.cfg.car.x !== c0);
});

test('tentacle: light only slows it on the way in', () => {
  const run = (beam) => {
    const s = quiet('TL'); s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
    spawnHazard(s, 'tentacle'); const T = s.hazards.tentacles[0];
    T.origin = { x: 0, z: 18 }; T.tip = { x: 0, z: 18 }; T.path = [{ ...T.tip }];
    ticks(s, secs(s, 3), { ...idle, flashlight: beam });
    return 18 - T.tip.z;
  };
  const dark = run(false), lit = run(true);
  assert.ok(lit > 0.1 && lit < dark * 0.7, `lit ${lit} vs dark ${dark}`);
});

// ---------- cold ----------
test('cold: drains faster standing still and on the roof; flares and exhaust warm; empty = slowed, no damage', () => {
  const walk = quiet('C1'); spawnHazard(walk, 'cold'); walk.player.pos = { x: 6, z: 6 };
  ticks(walk, secs(walk, 10), (g) => ({ yaw: g.player.yaw + 0.05, ...idle, moveZ: 1 }));
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
  assert.ok(numb.player.pos.z - z0 < numb.cfg.player.speed * 0.7);
  assert.equal(numb.player.health, numb.cfg.player.maxHealth);
  numb.player.heat = 10; ticks(numb, 1);
  assert.ok(numb.player.aimShake > 0);
});

// ---------- gust ----------
test('gust: a warning first, then flares burn fast and the flashlight cuts out; it has a wind direction', () => {
  const s = quiet(); s.player.pos = { x: 6, z: 6 };
  s.flares.push({ pos: { x: 3, z: 8 }, from: { x: 3, z: 8 }, state: 'burning', t: 0, burn: 20 });
  spawnHazard(s, 'gust');
  assert.equal(types(s).at(-1), 'gust_warn');
  assert.ok(Number.isFinite(s.hazards.gust.dir));
  let off = 0, n = 0;
  ticks(s, secs(s, 1.3), { ...idle, flashlight: true });
  ticks(s, secs(s, 6), (g) => { n++; if (!g.player.flashlightOn) off++; return { yaw: g.player.yaw, ...idle, flashlight: true }; });
  assert.ok(off / n > 0.15 && off / n < 0.6, `flicker ${off / n}`);
  assert.ok(s.flares[0].t > 15);
  ticks(s, secs(s, 3));
  assert.equal(s.hazards.gust, null);
});

// ---------- zombie ----------
test('zombie: keeps coming in the beam, grabs you (even on the roof); alternate A/D to shove it off', () => {
  const s = quiet(); s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
  spawnHazard(s, 'zombie'); s.hazards.zombie.pos = { x: 0, z: 12 };
  ticks(s, secs(s, 2), { ...idle, flashlight: true });
  assert.ok(s.hazards.zombie.pos.z < 10, 'the light does not stop it');
  for (let i = 0; i < secs(s, 8) && s.player.held !== 'zombie'; i++) ticks(s, 1, { ...idle, flashlight: true });
  assert.equal(s.player.held, 'zombie');
  ticks(s, 30, (g, i) => ({ yaw: g.player.yaw, ...idle, moveX: Math.floor(i / 4) % 2 ? 1 : -1 }));
  assert.ok(types(s).includes('zombie_shoved'));
  assert.equal(s.player.held, null);
  assert.equal(s.player.health, s.cfg.player.maxHealth);
  assert.ok(Math.hypot(s.hazards.zombie.pos.x - s.player.pos.x, s.hazards.zombie.pos.z - s.player.pos.z) > 3);

  const r = quiet('ZR'); r.player.pos = { x: 0, z: 0 }; r.player.y = r.cfg.car.top; r.player.onCar = true; r.player.grounded = true;
  spawnHazard(r, 'zombie'); r.hazards.zombie.pos = { x: 0, z: 2.2 };
  ticks(r, secs(r, 2));
  assert.equal(r.player.held, 'zombie');
  assert.equal(r.player.onCar, false, 'pulled off the roof');
});

test('zombie: do nothing and it bites (a hit, then it lets go); a bullet staggers it but it never dies', () => {
  const s = quiet('ZB'); s.player.pos = { x: 0, z: 5 };
  spawnHazard(s, 'zombie'); s.hazards.zombie.pos = { x: 0, z: 5.6 };
  ticks(s, secs(s, 3));
  assert.ok(types(s).includes('zombie_bite'));
  assert.equal(s.player.health, s.cfg.player.maxHealth - 1);
  assert.equal(s.player.held, null);

  const g = quiet('ZS'); g.player.pos = { x: 0, z: 5 }; g.player.reserve = 18;
  spawnHazard(g, 'zombie'); g.hazards.zombie.pos = { x: 0, z: 12 };
  for (let i = 0; i < 6; i++) { aimAt(g, g.hazards.zombie.pos); ticks(g, 1, { ...idle, fire: true }); ticks(g, secs(g, 0.4)); }
  assert.ok(g.events.filter((e) => e.type === 'zombie_hit').length >= 5);
  assert.ok(g.hazards.zombie, 'still there');
});

// ---------- general ----------
test('hazards: a normal night has random whiteouts and nothing else; no rammers in the crowd', () => {
  const s = createGame('NORM');
  ticks(s, secs(s, 40));
  assert.equal(s.hazards.gust, null, 'no whiteout in the first 45 s');
  ticks(s, secs(s, 300), (g) => ({ yaw: g.player.yaw, ...idle, flashlight: true })); // a flashlit player survives long enough
  const hz = s.hazards;
  assert.ok(!hz.fire && !hz.fireArmed && !hz.swarm && !hz.tentacles.length && !hz.cold && !hz.zombie);
  const gusts = s.events.filter((e) => e.type === 'gust_warn');
  assert.ok(gusts.length >= 1, 'at least one whiteout');
  for (let i = 1; i < gusts.length; i++) assert.ok(gusts[i].t - gusts[i - 1].t >= s.cfg.hazards.gust.gapMin - 1e-6);
  assert.equal(s.monsters.filter((m) => m.kind === 'rammer').length, 0);
});

test('hazards: swarm and cold are backlogged (not in the sandbox list)', async () => {
  const { HAZARD_KINDS } = await import('../src/sim/game.js');
  assert.deepEqual(HAZARD_KINDS, ['fire', 'tentacle', 'gust', 'zombie']);
});

test('hazards: each one runs on its own for a minute without errors', () => {
  for (const k of ['fire', 'swarm', 'tentacle', 'cold', 'gust', 'zombie']) {
    const a = quiet('ONE' + k); if (k !== 'gust') a.cfg.hazards.gust.random = false;
    startHazardTest(a, k);
    ticks(a, secs(a, 60), (g, i) => ({ yaw: g.player.yaw + 0.02, ...idle, moveZ: i % 300 < 150 ? 1 : 0, moveX: i % 16 < 8 ? 1 : -1, flashlight: i % 120 < 60, fire: i % 90 === 0 }));
    assert.ok(a.t > 1, k);
  }
});
