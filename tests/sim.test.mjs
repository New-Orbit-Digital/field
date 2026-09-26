import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, createGame, step, bearingTo, spotWorld, attackerCap, hunterCount, MODES, carDistance, reloadProgress, aimYaw, inBeam, inFlare, flareRadius, HUNTING, carToWorld, worldToCar } from '../src/sim/game.js';
import { beginApproach, approachGoal } from '../src/sim/monster.js';
import { idleBot, reactiveBot, objectiveBot } from '../src/sim/bots.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => `T${i}`);
const ticks = (s, n, input) => { for (let i = 0; i < n; i++) step(s, typeof input === 'function' ? input(s, i) : input); };
// A quiet stage for set-piece tests: no flares burning, nobody hunting, the crowd parked far away.
function quiet(s, keep = 0) {
  s.flares = [];
  s.hordeTarget = 0;
  s.breakOffTimer = 1e9;
  s.cfg.horde.repairRampCap = 0;
  s.monsters.forEach((m, i) => { if (i >= keep) { m.mode = MODES.SHAMBLE; m.pos = { x: Math.sin(i) * 26, z: Math.cos(i) * 26 }; m.wander = { ...m.pos }; m.wanderT = 1e9; } });
}

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

test('unpredictable timing: gaps between attacks are irregular (CV > 0.4)', () => {
  const gaps = [];
  for (const seed of SEEDS) {
    const s = runHeadless(seed, reactiveBot({ reaction: 0.3 }), { maxTime: 89 }); // one hunter out at a time
    let last = null;
    for (const e of s.events) if (e.type === 'warn' && !e.deep) { if (last !== null) gaps.push(e.t - last); last = e.t; }
  }
  assert.ok(gaps.length > 40, `too few attacks: ${gaps.length}`);
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

// ---------- light sends them running ----------
function hunterAhead(s, d, mode = MODES.COMMIT) {
  quiet(s, 1);
  const m = s.monsters[0];
  s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
  m.mode = mode; m.commitTime = 0; m.timer = 5; m.deep = false; m.pos = { x: 0, z: 5 + d };
  return m;
}

test('flee: a lunging monster caught in the beam turns and runs for the dark', () => {
  const s = createGame('FLEE1');
  const m = hunterAhead(s, 8);
  ticks(s, 20, { yaw: 0, flashlight: true });
  assert.ok(s.events.some((e) => e.type === 'repel' && e.id === m.id), 'not repelled');
  assert.equal(m.mode, MODES.RETREAT);
  let far = 0;
  ticks(s, 60, (g) => { far = Math.max(far, Math.hypot(m.pos.x, m.pos.z - 5)); return { yaw: 0, flashlight: true }; });
  assert.ok(!inBeam(s, m.pos), 'still in the beam a second later: it should veer out of it');
  assert.ok(far > 11, `not heading away (${far.toFixed(1)} m)`);
});

test('flee: …unless it is already within 2 m mid-lunge — then it keeps coming', () => {
  const s = createGame('FLEE2');
  const m = hunterAhead(s, 1.9);
  ticks(s, 30, { yaw: 0, flashlight: true });
  assert.ok(!s.events.some((e) => e.type === 'repel' && e.id === m.id), 'close lunge was repelled');
  assert.ok(s.events.some((e) => e.type === 'hit'), 'no hit from the close lunge');
});

test('the crowd at the edge scatters from the beam, and nothing ever freezes in it', () => {
  const s = createGame('SCATTER');
  quiet(s);
  const m = s.monsters[0];
  s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
  m.pos = { x: 0, z: 18 };
  const start = { ...m.pos };
  ticks(s, 60, { yaw: 0, flashlight: true });
  assert.ok(s.events.some((e) => e.type === 'scatter' && e.id === m.id), 'no scatter');
  assert.ok(Math.hypot(m.pos.x - start.x, m.pos.z - start.z) > 2.5, 'barely moved');

  // across whole nights, no monster sits in the beam for long (except the telegraphed roof climb)
  let worst = 0;
  for (const seed of SEEDS.slice(0, 15)) {
    const g = createGame(seed);
    const bot = reactiveBot({ reaction: 0.3, gun: true });
    let seen = 0;
    const lit = new Map();
    while (g.alive && g.t < 200) {
      const ev = g.events.slice(seen); seen = g.events.length;
      step(g, bot(g, ev, g.cfg.sim.dt));
      for (const x of g.monsters) {
        const t = inBeam(g, x.pos) && x.mode !== MODES.CLIMB ? (lit.get(x.id) || 0) + g.cfg.sim.dt : 0;
        lit.set(x.id, t);
        worst = Math.max(worst, t);
      }
    }
  }
  assert.ok(worst < 0.8, `a monster stayed in the beam for ${worst.toFixed(2)} s`);
});

// ---------- guns ----------
test('shot once: it bleeds and runs; shot twice: it leaves the field for good', () => {
  const s = createGame('WOUND');
  const m = hunterAhead(s, 10);
  ticks(s, 1, { yaw: 0, fire: true });
  assert.equal(m.wounds, 1);
  assert.ok(s.events.some((e) => e.type === 'wounded' && e.id === m.id));
  assert.equal(m.mode, MODES.RETREAT);
  // bring it back and shoot it again
  m.mode = MODES.COMMIT; m.pos = { x: 0, z: 15 };
  ticks(s, 30, { yaw: 0 });
  m.pos = { x: 0, z: 15 }; m.mode = MODES.COMMIT;
  ticks(s, 1, { yaw: 0, fire: true });
  assert.ok(s.events.some((e) => e.type === 'fled_for_good' && e.id === m.id));
  assert.equal(m.mode, MODES.GONE);
  const before = s.monsters.length;
  ticks(s, 60 * 12, { yaw: 0 });
  assert.ok(s.events.some((e) => e.type === 'monster_gone' && e.id === m.id), 'never left');
  assert.equal(s.monsters.length, before - 1);
  assert.ok(!s.monsters.includes(m));
});

test('bullets scare: everything near where a shot lands runs from that spot', () => {
  const s = createGame('IMPACT');
  quiet(s, 2);
  s.player.pos = { x: 0, z: 5 }; s.player.yaw = 0;
  const [a, b] = s.monsters;
  const landing = { x: 0, z: 5 + s.cfg.monster.impactDist };
  a.mode = MODES.SHAMBLE; a.pos = { x: 2, z: landing.z + 1 }; a.wanderT = 1e9; a.wander = { ...a.pos };
  b.mode = MODES.STALK; b.pos = { x: -2.5, z: landing.z - 1 }; b.timer = 99;
  ticks(s, 1, { yaw: 0, fire: true }); // a miss: lands in the snow
  assert.ok(s.events.some((e) => e.type === 'bullet_impact'));
  assert.ok(s.events.some((e) => e.type === 'scatter' && e.id === a.id), 'shambler did not scatter');
  assert.equal(b.mode, MODES.RETREAT, 'hunter did not run');
  ticks(s, 30, { yaw: 0 });
  assert.ok(Math.hypot(b.pos.x - landing.x, b.pos.z - landing.z) > 5, 'hunter still near the impact');
});

// ---------- car interactions ----------
function standAt(s, name, faceHull) {
  const sp = spotWorld(s.cfg, name);
  if (s.t === 0) quiet(s);
  s.player.pos = { ...sp.stand };
  s.player.yaw = faceHull ? bearingTo(sp.stand, sp.face) : bearingTo(sp.face, sp.stand);
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
  // the box never runs out, but the next one takes a while to be ready
  s.player.flares = 0;
  ticks(s, 200, { yaw: s.player.yaw, interact: true });
  assert.equal(s.player.flares, 0, 'restocked too fast');
  s.t = s.flareReadyAt;
  ticks(s, Math.ceil(s.cfg.flares.pickupTime * 60) + 2, { yaw: s.player.yaw, interact: true });
  assert.equal(s.player.flares, 1, 'no flare after the restock');
});

test('radio: repair → call → rescue arrives and the run is won', () => {
  const s = createGame('RADIO', { radio: { repairTime: 2, callTime: 1, rescueTime: 3 } });
  standAt(s, 'radio', true);
  ticks(s, 60 * 4, { yaw: s.player.yaw, interact: true });
  assert.equal(s.radio.phase, 'wait');
  const types = s.events.map((e) => e.type);
  assert.ok(types.includes('radio_fixed') && types.includes('radio_called'));
  ticks(s, 60 * 4, (g) => { quiet(g); return { yaw: g.player.yaw }; });
  assert.equal(s.won, true);
  assert.ok(s.events.some((e) => e.type === 'rescued'));
});

// ---------- pistol ----------
test('reload leaves you exposed: no flashlight and no firing until it finishes', () => {
  const s = createGame('RELOAD');
  quiet(s);
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
  quiet(s, 1);
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
    quiet(s);
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
  quiet(s);
  step(s, { yaw: 0, fire: true });
  let maxOff = 0;
  for (let i = 0; i < 12; i++) { step(s, { yaw: 0 }); maxOff = Math.max(maxOff, Math.abs(aimYaw(s))); }
  assert.ok(maxOff > 0.01, `no waver: ${maxOff}`);
  for (let i = 0; i < 60; i++) step(s, { yaw: 0 });
  assert.ok(Math.abs(aimYaw(s)) < 1e-6, 'recoil should settle');
});

// ---------- flares ----------
test('the night starts with a flare burning 5 m from the wreck, on the side away from the headlights', () => {
  const s = createGame('START');
  assert.equal(s.flares.length, 1);
  const f = s.flares[0];
  assert.equal(f.state, 'burning');
  assert.ok(Math.abs(Math.hypot(f.pos.x, f.pos.z) - s.cfg.flares.startDistance) < 1e-6);
  const away = s.cfg.arena.landmarkBearing + Math.PI;
  assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(f.pos.x, f.pos.z) - away), Math.cos(Math.atan2(f.pos.x, f.pos.z) - away))) < 1e-6);
  ticks(s, Math.ceil(s.cfg.flares.startBurnTime * 60) + 2, { yaw: 0 });
  assert.ok(!s.flares.some((x) => x === f), 'start flare should burn out');
});

test('Q drops the flare at your feet; its circle keeps them out, and they will not attack you inside it', () => {
  const s = createGame('FLARE');
  quiet(s, 1);
  s.player.flares = 1;
  s.player.pos = { x: 6, z: 6 };
  ticks(s, 1, { yaw: 0, throw: true });
  ticks(s, 30, { yaw: 0 });
  const f = s.flares[0];
  assert.equal(f.state, 'burning');
  assert.ok(Math.hypot(f.pos.x - 6, f.pos.z - 6) < 1.2, 'not at the feet');
  const m = s.monsters[0];
  m.mode = MODES.STALK; m.pos = { x: f.pos.x + 6, z: f.pos.z }; m.timer = 999;
  ticks(s, 2, { yaw: Math.PI });
  assert.ok(s.events.some((e) => e.type === 'spotted' && e.id === m.id), 'stayed inside the flare');
  // hunters wait at the edge while you stand in the light
  s.hordeTarget = 3; s.breakOffTimer = 0; s.cfg.horde.repairRampCap = 3;
  const n0 = s.events.length;
  ticks(s, 60 * 12, { yaw: 0 });
  assert.ok(!s.events.slice(n0).some((e) => e.type === 'warn'), 'attacked inside the flare');
  assert.ok(hunterCount(s) > 0, 'nobody came to wait at the edge');
  ticks(s, Math.ceil(s.cfg.flares.burnTime * 60), { yaw: 0 });
  assert.equal(s.flares.length, 0, 'flare should burn out');
});

test('a guttering flare protects a shrinking circle, matching its dying light', () => {
  const s = createGame('GUTTER');
  quiet(s);
  const f = { pos: { x: 0, z: 8 }, from: { x: 0, z: 8 }, state: 'burning', t: 0, burn: 20 };
  s.flares = [f];
  const R = s.cfg.flares.radius;
  f.t = 10; assert.equal(flareRadius(s, f), R);
  const probe = { x: 0, z: 8 + R - 1 };
  assert.ok(inFlare(s, probe), 'full flare should cover 8 m out');
  f.t = f.burn - s.cfg.flares.gutterTime / 4; // light at a quarter
  assert.ok(flareRadius(s, f) < R * 0.6, `circle did not shrink: ${flareRadius(s, f).toFixed(2)}`);
  assert.ok(!inFlare(s, probe), 'a nearly-out flare still guards its full circle');
});

// ---------- climbing ----------
function besideCar(s) {
  // stand just off the long side, facing the hull
  quiet(s, 1);
  const sp = spotWorld(s.cfg, 'radio');
  s.player.pos = { ...sp.stand };
  s.player.yaw = bearingTo(sp.stand, sp.face);
  s.monsters[0].pos = { x: 0, z: -26 };
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

// ---------- the crowd ----------
test('crowd: many shamble at the edge of the dark; hunters break off, grow in number, one attacks at a time', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const s = createGame(seed, { radio: { repairTime: 5, callTime: 2 } });
    assert.equal(s.monsters.length, s.cfg.horde.crowd);
    for (const m of s.monsters) {
      const r = Math.hypot(m.pos.x, m.pos.z);
      assert.ok(r >= s.cfg.horde.crowdInner - 1e-6 && r <= s.cfg.horde.crowdOuter + 1e-6, `crowd member at ${r.toFixed(1)} m`);
      assert.equal(m.mode, MODES.SHAMBLE);
    }
    const bot = objectiveBot({ reaction: 0.3, seed: 3, flares: false });
    let seen = 0, maxH = 0;
    while (s.alive && s.t < 400) {
      const ev = s.events.slice(seen); seen = s.events.length;
      step(s, bot(s, ev, s.cfg.sim.dt));
      maxH = Math.max(maxH, hunterCount(s));
      const attacking = s.monsters.filter((m) => (m.mode === MODES.WARN || m.mode === MODES.COMMIT || m.mode === MODES.CLIMB) && !m.deep).length;
      assert.ok(attacking <= attackerCap(s), `too many simultaneous attackers: ${attacking} > ${attackerCap(s)}`);
      assert.ok(hunterCount(s) <= s.cfg.horde.max, 'too many hunters');
      assert.ok(s.monsters.length <= s.cfg.horde.crowd, 'crowd grew');
    }
    assert.ok(maxH >= 4, `hunters never ramped up (seed ${seed}): ${maxH}`);
    assert.ok(s.events.some((e) => e.type === 'break_off'));
  }
});

// ---------- breakers and rammers ----------
test('the crowd is a mix: hunters, breakers and rammers', () => {
  const s = createGame('KINDS');
  const n = (k) => s.monsters.filter((m) => m.kind === k).length;
  assert.equal(n('hunter'), s.cfg.horde.kinds.hunter);
  assert.equal(n('breaker'), s.cfg.horde.kinds.breaker);
  assert.equal(n('rammer'), s.cfg.horde.kinds.rammer);
});

function sendIn(s, kind) {
  quiet(s, 0);
  // rammers are retired from the crowd (config kinds.rammer = 0) but their code is kept: convert one to test it
  const m = s.monsters.find((x) => x.kind === kind) || Object.assign(s.monsters.find((x) => x.kind === 'hunter'), { kind });
  m.pos = { x: 0, z: -12 };
  beginApproach(s, m);
  return m;
}

test('breaker: left alone it walks in and smashes one side of the lights for good', () => {
  const s = createGame('BREAK');
  const m = sendIn(s, 'breaker');
  s.player.pos = { x: 8, z: 8 }; s.player.yaw = 0.8; // out of the way (not in the deep dark), looking elsewhere
  ticks(s, 60 * 15, { yaw: 0 });
  const smashed = s.events.find((e) => e.type === 'lights_smashed' && e.id === m.id);
  assert.ok(smashed, 'never smashed the lights');
  const start = s.events.find((e) => e.type === 'smash_start' && e.id === m.id);
  assert.ok(smashed.t - start.t >= s.cfg.monster.smashTime - 1e-6, 'no fair warning before the smash');
  assert.equal(s.strobes.filter(Boolean).length, 1, 'exactly one side should be dark');
});

test('breaker: light it up while it is smashing and it runs, lights intact', () => {
  const s = createGame('BREAK2');
  const m = sendIn(s, 'breaker');
  s.player.pos = { x: 8, z: 8 }; s.player.yaw = 0.8;
  ticks(s, 60 * 15, (g) => {
    if (m.mode === MODES.SMASH) { g.player.pos = { x: m.pos.x, z: m.pos.z + 6 }; return { yaw: Math.PI, flashlight: true }; }
    return { yaw: 0 };
  });
  assert.ok(s.events.some((e) => e.type === 'smash_start' && e.id === m.id), 'never started smashing');
  assert.ok(s.events.some((e) => e.type === 'repel' && e.id === m.id), 'the beam did not drive it off');
  assert.deepEqual(s.strobes, [true, true]);
});

test('rammer: a hit shoves the car (within limits), interrupts the repair until you let go of E, and carries you on the roof', () => {
  const s = createGame('RAM');
  const m = sendIn(s, 'rammer');
  const sp = spotWorld(s.cfg, 'radio');
  s.player.pos = { ...sp.stand }; s.player.yaw = bearingTo(sp.stand, sp.face);
  const before = { x: s.cfg.car.x, z: s.cfg.car.z, yaw: s.cfg.car.yaw };
  let sawInterrupt = false;
  ticks(s, 60 * 20, (g) => {
    const sp2 = spotWorld(g.cfg, 'radio');
    if (!g.events.some((e) => e.type === 'car_rammed')) { g.player.pos = { ...sp2.stand }; g.player.yaw = bearingTo(sp2.stand, sp2.face); }
    if (g.events.some((e) => e.type === 'interrupted')) sawInterrupt = true;
    return { yaw: g.player.yaw, interact: true };
  });
  const ram = s.events.find((e) => e.type === 'car_rammed');
  assert.ok(ram, 'never rammed');
  const wind = s.events.find((e) => e.type === 'ram_windup' && e.id === m.id);
  assert.ok(ram.t - wind.t >= s.cfg.monster.windupTime - 1e-6, 'no fair warning before the ram');
  assert.ok(ram.dx !== 0 || ram.dz !== 0 || ram.dyaw !== 0, 'car did not move');
  assert.ok(sawInterrupt, 'repair was not interrupted');
  const progress = s.radio.repair;
  ticks(s, 60, { yaw: s.player.yaw, interact: true });
  assert.equal(s.radio.repair, progress, 'kept repairing without letting go of E');
  assert.ok(Math.hypot(s.cfg.car.x, s.cfg.car.z) <= s.cfg.car.maxDrift + 1e-9);
  assert.ok(Math.abs(s.cfg.car.yaw - before.yaw) <= s.cfg.car.maxTurn + 1e-9);

  // on the roof: you move with the car (or go over the side)
  const r = createGame('RAM2');
  const m2 = sendIn(r, 'rammer');
  r.player.pos = { x: 0.3, z: 0 }; r.player.y = r.cfg.car.top; r.player.onCar = true; r.player.grounded = true;
  const localBefore = worldToCar(r.cfg, r.player.pos);
  ticks(r, 60 * 20, (g) => (g.events.some((e) => e.type === 'car_rammed') ? { yaw: 0 } : { yaw: 0 }));
  const hit = r.events.find((e) => e.type === 'car_rammed');
  assert.ok(hit, 'never rammed');
  const fell = r.events.some((e) => e.type === 'knocked_off' && e.by === 'ram');
  if (!fell) {
    const l = worldToCar(r.cfg, r.player.pos);
    assert.ok(Math.hypot(l.x - localBefore.x, l.z - localBefore.z) < 0.05, 'the roof did not carry you');
  }
  assert.ok(r.events.some((e) => e.type === 'stagger' || (e.type === 'knocked_off' && e.by === 'ram')));
});

test('the car can move: car-local and world coordinates stay consistent, and the pickup spots move with it', () => {
  const s = createGame('POSE');
  const a = spotWorld(s.cfg, 'radio').stand;
  s.cfg.car.x = 0.8; s.cfg.car.z = -0.5; s.cfg.car.yaw += 0.2;
  const p = { x: 3.1, z: -1.7 };
  const back = carToWorld(s.cfg, worldToCar(s.cfg, p));
  assert.ok(Math.hypot(back.x - p.x, back.z - p.z) < 1e-9);
  const b = spotWorld(s.cfg, 'radio').stand;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, 'spot did not follow the car');
  assert.ok(carDistance(s.cfg, { x: 0.8, z: -0.5 }) < 0, 'car centre should be inside the hull');
});

// ---------- battery ----------
test('flashlight battery drains, locks at zero, recharges', () => {
  const s = createGame('BAT');
  quiet(s);
  ticks(s, 60 * 21, { yaw: 0, flashlight: true });
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
