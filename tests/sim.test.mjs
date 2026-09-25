import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, createGame, step, bearingTo, spotWorld, attackerCap, MODES, carDistance, reloadProgress, aimYaw } from '../src/sim/game.js';
import { idleBot, reactiveBot, objectiveBot } from '../src/sim/bots.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => `T${i}`);
const ticks = (s, n, input) => { for (let i = 0; i < n; i++) step(s, typeof input === 'function' ? input(s, i) : input); };

// ---------- core feel ----------
test('determinism: same seed + same policy -> identical event log', () => {
  const a = runHeadless('DETERMINE', objectiveBot(), { maxTime: 200 });
  const b = runHeadless('DETERMINE', objectiveBot(), { maxTime: 200 });
  assert.deepEqual(a.events, b.events);
  const c = runHeadless('OTHER', objectiveBot(), { maxTime: 200 });
  assert.notDeepEqual(a.events, c.events);
});

test('honest tells: every hit is preceded by a warn for the same attack, at least as long as the tell', () => {
  let hits = 0;
  for (const seed of SEEDS) {
    for (const bot of [idleBot(), objectiveBot({ missChance: 0.3 })]) {
      const s = runHeadless(seed, bot, { maxTime: 300 });
      const warnAt = new Map();
      for (const e of s.events) {
        if (e.type === 'warn') warnAt.set(e.attack, e);
        if (e.type === 'hit') {
          hits++;
          const w = warnAt.get(e.attack);
          assert.ok(w, `hit without warn (seed ${seed})`);
          const min = w.deep ? s.cfg.monster.deepDarkWarnTime : s.cfg.monster.warnTime;
          assert.ok(e.t - w.t >= min - 1e-6, `warn too short (seed ${seed})`);
        }
      }
    }
  }
  assert.ok(hits > 100, `expected plenty of hits, got ${hits}`);
});

test('unpredictable direction: attacks come from all around, favouring unseen angles but not exclusively', () => {
  const bins = new Array(8).fill(0);
  let inView = 0, total = 0;
  for (const seed of SEEDS) {
    const s = runHeadless(seed, reactiveBot({ reaction: 0.3 }), { maxTime: 300 });
    for (const e of s.events) if (e.type === 'warn' && !e.deep) {
      total++;
      if (e.inView) inView++;
      bins[Math.floor(((e.rel + Math.PI) / (2 * Math.PI)) * 8) % 8]++;
    }
  }
  const share = bins.map((n) => n / total);
  assert.ok(total > 300, `too few attacks: ${total}`);
  for (const sh of share) {
    assert.ok(sh > 0.03 && sh < 0.3, `sector share out of range: ${share.map((x) => x.toFixed(3))}`);
  }
  const iv = inView / total;
  assert.ok(iv > 0.05 && iv < 0.4, `in-view share out of range: ${iv.toFixed(3)}`);
});

test('unpredictable timing: gaps between one monster\'s attacks are irregular (CV > 0.4)', () => {
  const gaps = [];
  for (const seed of SEEDS) {
    const s = runHeadless(seed, reactiveBot({ reaction: 0.3 }), { maxTime: 80 }); // single monster window
    let last = null;
    for (const e of s.events) if (e.type === 'warn' && e.id === 1) { if (last !== null) gaps.push(e.t - last); last = e.t; }
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  assert.ok(sd / mean > 0.4, `timing too regular: CV ${(sd / mean).toFixed(3)}`);
});

test('skill matters: an attentive player outlives an idle one by a wide margin', () => {
  const avg = (mk) => SEEDS.reduce((a, seed) => a + runHeadless(seed, mk(), { maxTime: 600 }).t, 0) / SEEDS.length;
  const idle = avg(() => idleBot());
  const sharp = avg(() => reactiveBot({ reaction: 0.3, gun: true }));
  assert.ok(sharp > idle * 2.5, `idle ${idle.toFixed(1)}s vs sharp ${sharp.toFixed(1)}s`);
});

// ---------- scramble out of the beam ----------
test('dodge: a lit monster scrambles out of the beam; the light alone is no longer a sure repel', () => {
  let dodges = 0, lunges = 0, repels = 0;
  for (const seed of SEEDS) {
    const s = runHeadless(seed, reactiveBot({ reaction: 0.3 }), { maxTime: 200 });
    for (const e of s.events) {
      if (e.type === 'dodge') dodges++;
      if (e.type === 'lunge') lunges++;
      if (e.type === 'repel') repels++;
    }
  }
  assert.ok(dodges > lunges * 0.5, `too few dodges: ${dodges} for ${lunges} lunges`);
  assert.ok(repels / lunges < 0.9, `flashlight still repels too reliably: ${(100 * repels / lunges).toFixed(0)}%`);
});

// ---------- car interactions ----------
function standAt(s, name, faceHull) {
  const sp = spotWorld(s.cfg, name);
  s.player.pos = { ...sp.stand };
  s.player.yaw = faceHull ? bearingTo(sp.stand, sp.face) : bearingTo(sp.face, sp.stand);
  s.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 999; });
}

test('pickups need you at the spot AND facing the car', () => {
  const s = createGame('PICK');
  standAt(s, 'radio', false);
  ticks(s, 120, { yaw: s.player.yaw, interact: true });
  assert.equal(s.radio.repair, 0, 'repaired while facing away');
  standAt(s, 'radio', true);
  ticks(s, 120, { yaw: s.player.yaw, interact: true });
  assert.ok(s.radio.repair > 1.9, `no repair progress facing the radio: ${s.radio.repair}`);
  assert.equal(s.player.flashlightOn, false, 'flashlight should be off while working on the car');

  s.player.reserve = 0;
  standAt(s, 'ammo', true);
  ticks(s, Math.ceil(s.cfg.pistol.pickupTime * 60) + 2, { yaw: s.player.yaw, interact: true });
  assert.equal(s.player.reserve, s.cfg.pistol.pickupAmount);

  standAt(s, 'flares', true);
  ticks(s, 200, { yaw: s.player.yaw, interact: true });
  assert.equal(s.player.flares, 1, 'can only carry one flare');
});

test('radio: repair → call → rescue arrives and the run is won', () => {
  const s = createGame('RADIO', { radio: { repairTime: 2, callTime: 1, rescueTime: 3 } });
  standAt(s, 'radio', true);
  ticks(s, 60 * 4, { yaw: s.player.yaw, interact: true });
  assert.equal(s.radio.phase, 'wait');
  const types = s.events.map((e) => e.type);
  assert.ok(types.includes('radio_fixed') && types.includes('radio_called'));
  ticks(s, 60 * 4, (g) => { g.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 999; m.mode = MODES.STALK; }); return { yaw: g.player.yaw }; });
  assert.equal(s.won, true);
  assert.ok(s.events.some((e) => e.type === 'rescued'));
});

// ---------- pistol ----------
test('reload leaves you exposed: no flashlight and no firing until it finishes', () => {
  const s = createGame('RELOAD');
  s.player.mag = 0;
  ticks(s, 1, { yaw: 0, fire: true });
  assert.ok(s.player.reloading > 0, 'firing empty should start a reload');
  const reloadTicks = Math.round(s.cfg.pistol.reloadTime * 60);
  for (let i = 0; i < reloadTicks - 5; i++) {
    step(s, { yaw: 0, flashlight: true, fire: true });
    assert.equal(s.player.flashlightOn, false, 'flashlight on during reload');
  }
  assert.equal(s.events.filter((e) => e.type === 'shot').length, 0, 'fired during reload');
  ticks(s, 10, { yaw: 0 });
  assert.equal(s.player.mag, s.cfg.pistol.magSize);
});

test('a pistol hit drives the monster off; ammo is spent', () => {
  const s = createGame('SHOOT');
  const m = s.monsters[0];
  m.mode = MODES.COMMIT; m.pos = { x: 0, z: 15 };
  s.player.pos = { x: 0, z: 5 };
  ticks(s, 1, { yaw: 0, fire: true });
  assert.ok(s.events.some((e) => e.type === 'shot_hit'));
  assert.equal(s.player.mag, s.cfg.pistol.magSize - 1);
  assert.ok(m.mode === MODES.RETREAT || m.mode === MODES.STALK, `still attacking: ${m.mode}`);
});

test('active reload: R inside the flagged window = instant; outside = jam (longer); no press = normal', () => {
  const run = (pressAt) => {
    const s = createGame('ACTIVE');
    s.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 9999; });
    s.player.mag = 0;
    step(s, { yaw: 0, reload: true });
    const w = s.player.reloadWindow;
    let pressed = false, ticksToDone = 0;
    while (s.player.reloading > 0 && ticksToDone < 1000) {
      const prog = reloadProgress(s.player);
      const press = !pressed && pressAt !== null && prog >= pressAt(w);
      if (press) pressed = true;
      step(s, { yaw: 0, reload: press });
      ticksToDone++;
    }
    return { s, secs: ticksToDone / 60 };
  };
  const normal = run(null);
  const perfect = run((w) => (w.a + w.b) / 2);
  const jam = run((w) => Math.max(0.02, w.a - 0.2));
  assert.equal(normal.s.player.mag, 6);
  assert.ok(Math.abs(normal.secs - normal.s.cfg.pistol.reloadTime) < 0.05, `normal ${normal.secs}`);
  assert.ok(perfect.s.events.some((e) => e.type === 'reload_perfect'), 'no perfect reload');
  assert.ok(perfect.secs < normal.secs * 0.75, `perfect not faster: ${perfect.secs}`);
  assert.equal(perfect.s.player.mag, 6);
  assert.ok(jam.s.events.some((e) => e.type === 'reload_jam'), 'no jam');
  assert.ok(jam.secs > normal.secs + jam.s.cfg.pistol.jamPenalty - 0.05, `jam not slower: ${jam.secs}`);
  assert.equal(jam.s.player.mag, 6);
});

test('recoil: firing kicks the aim (and beam) off your facing, then settles', () => {
  const s = createGame('RECOIL');
  s.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 9999; });
  step(s, { yaw: 0, fire: true });
  let maxOff = 0;
  for (let i = 0; i < 12; i++) { step(s, { yaw: 0 }); maxOff = Math.max(maxOff, Math.abs(aimYaw(s))); }
  assert.ok(maxOff > 0.01, `no waver: ${maxOff}`);
  for (let i = 0; i < 60; i++) step(s, { yaw: 0 });
  assert.ok(Math.abs(aimYaw(s)) < 1e-6, 'recoil should settle');
});

// ---------- flares ----------
test('a thrown flare burns for a while and the monster will not stay inside its light', () => {
  const s = createGame('FLARE');
  s.player.flares = 1;
  s.player.pos = { x: 0, z: 5 };
  ticks(s, 1, { yaw: 0, throw: true });
  ticks(s, 60, { yaw: 0 });
  const f = s.flares[0];
  assert.equal(f.state, 'burning');
  const m = s.monsters[0];
  m.mode = MODES.STALK; m.pos = { ...f.pos }; m.timer = 999;
  ticks(s, 2, { yaw: Math.PI });
  assert.ok(s.events.some((e) => e.type === 'spotted' && e.id === m.id));
  ticks(s, Math.ceil(s.cfg.flares.burnTime * 60), { yaw: Math.PI });
  assert.equal(s.flares.length, 0, 'flare should burn out');
});

// ---------- climbing ----------
function besideCar(s) {
  // stand just off the long side, facing the hull
  const sp = spotWorld(s.cfg, 'radio');
  s.player.pos = { ...sp.stand };
  s.player.yaw = bearingTo(sp.stand, sp.face);
  s.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 999; });
}

test('jump is low: standing jumps and walking into the car never get you on top', () => {
  const s = createGame('CLIMB1');
  besideCar(s);
  let maxY = 0;
  ticks(s, 60, (g, i) => { maxY = Math.max(maxY, g.player.y); return { yaw: g.player.yaw, jump: i === 0 }; });
  assert.ok(maxY < 0.5, `jump too high: ${maxY.toFixed(2)} m`);
  assert.equal(s.player.onCar, false, 'standing jump got onto the car');
  ticks(s, 120, (g) => ({ yaw: g.player.yaw, moveZ: 1 }));
  assert.equal(s.player.onCar, false, 'walked onto the car without jumping');
});

test('jump + push into the car while facing it → a slow, vulnerable scramble onto the top', () => {
  const s = createGame('CLIMB2');
  besideCar(s);
  ticks(s, 30, (g, i) => ({ yaw: g.player.yaw, moveZ: 1, jump: i === 2 }));
  assert.ok(s.events.some((e) => e.type === 'mantle_start'), 'no mantle');
  const t0 = s.events.find((e) => e.type === 'mantle_start').t;
  ticks(s, 60, (g) => ({ yaw: g.player.yaw, flashlight: true }));
  const t1 = s.events.find((e) => e.type === 'mantle_done').t;
  assert.ok(t1 - t0 >= s.cfg.player.mantleTime - 0.02, 'mantle too quick');
  assert.equal(s.player.onCar, true);
  assert.ok(Math.abs(s.player.y - s.cfg.car.top) < 1e-6);
  // can't use pickups from up there
  ticks(s, 30, (g) => ({ yaw: g.player.yaw, interact: true }));
  assert.equal(s.player.activeSpot, null);
});

test('on the roof it has to climb (telegraphed), and a hit knocks you off', () => {
  const s = createGame('ROOF');
  besideCar(s);
  ticks(s, 30, (g, i) => ({ yaw: g.player.yaw, moveZ: 1, jump: i === 2 }));
  ticks(s, 60, (g) => ({ yaw: g.player.yaw }));
  assert.equal(s.player.onCar, true);
  const m = s.monsters[0];
  m.mode = MODES.COMMIT; m.commitTime = 0; m.pos = { x: s.player.pos.x + 6, z: s.player.pos.z + 6 };
  ticks(s, 180, (g) => ({ yaw: g.player.yaw + Math.PI }));
  const climb = s.events.find((e) => e.type === 'climb');
  const hit = s.events.find((e) => e.type === 'hit');
  assert.ok(climb && hit, 'expected a climb then a hit');
  assert.ok(hit.t - climb.t >= s.cfg.monster.climbTime - 0.02);
  assert.equal(s.player.onCar, false, 'hit should knock you off the car');
});

// ---------- the horde ----------
test('horde: grows over the night, never past the cap, and only a few attack at once', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const s = createGame(seed, { radio: { repairTime: 5, callTime: 2 } });
    const bot = objectiveBot({ reaction: 0.3, seed: 3 });
    let seen = 0, maxN = 0;
    while (s.alive && s.t < 400) {
      const ev = s.events.slice(seen); seen = s.events.length;
      step(s, bot(s, ev, s.cfg.sim.dt));
      maxN = Math.max(maxN, s.monsters.length);
      const attacking = s.monsters.filter((m) => (m.mode === MODES.WARN || m.mode === MODES.COMMIT || m.mode === MODES.CLIMB) && !m.deep).length;
      assert.ok(attacking <= attackerCap(s), `too many simultaneous attackers: ${attacking} > ${attackerCap(s)}`);
    }
    assert.ok(maxN <= s.cfg.horde.max, `horde exceeded cap: ${maxN}`);
    assert.ok(maxN >= 4, `horde never grew (seed ${seed}): ${maxN}`);
  }
});

// ---------- battery ----------
test('flashlight battery drains, locks at zero, recharges', () => {
  const s = createGame('BAT');
  s.monsters.forEach((m) => { m.pos = { x: 0, z: -29 }; m.timer = 9999; });
  ticks(s, 60 * 21, (g) => { g.monsters.forEach((m) => { m.timer = 9999; }); return { yaw: 0, flashlight: true }; });
  assert.equal(s.player.flashlightOn, false);
  assert.ok(s.events.some((e) => e.type === 'battery_dead'));
  ticks(s, 60 * 3, { yaw: 0, flashlight: true });
  assert.equal(s.player.flashlightOn, false, 'should stay locked until restart threshold');
});

// ---------- deep dark ----------
function wandererBot({ fight = false } = {}) {
  const react = reactiveBot({ reaction: 0.3, gun: true });
  return (s, events, dt) => {
    const base = fight ? react(s, events, dt) : { flashlight: false };
    const out = { x: 0, z: 40 };
    const yaw = base.flashlight ? base.yaw : bearingTo(s.player.pos, out);
    const b = bearingTo(s.player.pos, out);
    const d = { x: Math.sin(b), z: Math.cos(b) };
    const f = { x: Math.sin(s.player.yaw), z: Math.cos(s.player.yaw) };
    const l = { x: f.z, z: -f.x };
    return { moveX: -(d.x * l.x + d.z * l.z), moveZ: d.x * f.x + d.z * f.z, yaw, flashlight: base.flashlight, fire: fight && base.fire };
  };
}

test('deep dark kills fast: walking out into the dark ends the run within seconds', () => {
  const lines = [];
  for (const seed of SEEDS) {
    for (const fight of [false, true]) {
      const s = runHeadless(seed, wandererBot({ fight }), { maxTime: 120 });
      assert.equal(s.alive, false, `survived the deep dark (seed ${seed}, fight ${fight})`);
      const deepAt = s.events.find((e) => e.type === 'warn' && e.deep);
      assert.ok(deepAt, 'no deep-dark attack happened');
      lines.push(s.events.find((e) => e.type === 'death').t - deepAt.t);
    }
  }
  const sorted = lines.slice().sort((a, b) => a - b);
  console.log(`deep-dark time-to-death after first strike: median ${sorted[sorted.length >> 1].toFixed(1)}s, worst ${sorted[sorted.length - 1].toFixed(1)}s`);
  assert.ok(sorted[sorted.length - 1] < 15, 'deep dark too survivable');
});
