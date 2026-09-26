// Headless visual check: renders posed scenes from dist/field.html and saves PNGs to shots/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

mkdirSync('shots', { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + resolve('dist/field.html') + '?seed=SHOTS');
await page.waitForTimeout(1500);
const modelsLoaded = await page.evaluate(() => window.__field.modelsReady());
await page.screenshot({ path: 'shots/01-title.png' });

async function pose(name, fn, wait = 900) {
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/${name}.png` });
}
await page.evaluate(() => {
  window.__field.startHeadless('SHOTS');
  window.__field.frozen = true;
  // nobody hunting: everyone back in the crowd, flares cleared unless a pose adds one
  window.__calm = (g) => { g.hordeTarget = 0; g.breakOffTimer = 1e9; g.monsters.forEach((m) => { if (m.mode !== 'shamble') { m.mode = 'shamble'; const b = Math.atan2(m.pos.x, m.pos.z); m.pos = { x: Math.sin(b) * 22, z: Math.cos(b) * 22 }; } }); };
  window.__face = (g, name) => {
    const sp = window.__field.spot(name);
    g.player.pos = { ...sp.stand };
    g.player.yaw = Math.atan2(sp.face.x - sp.stand.x, sp.face.z - sp.stand.z);
    return sp;
  };
});

await pose('02-night-start', () => window.__field.set((g, v) => {
  // as the night starts: the one flare burning, the crowd out at the edge, headlights on the embankment behind
  const f = g.flares[0];
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = Math.atan2(f.pos.x - 0, f.pos.z - 5) + 0.35; v.pitch = -0.02;
  g.t = 0.05;
}), 1500);

await pose('03-lunge-in-beam', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.player.pos = { x: 2, z: 5 }; g.player.yaw = 0.15; g.player.flashlightOn = true; v.pitch = -0.02;
  const m = g.monsters[0]; m.mode = 'commit'; m.pos = { x: 3.0, z: 10.5 };
  g.t = 0.55 / g.cfg.arena.strobeHz;
}));

await pose('04-crowd-in-beam', () => window.__field.set((g, v) => {
  // near the edge of the dark, flashlight on the crowd
  window.__calm(g);
  g.flares = [];
  const b = -0.4;
  g.player.pos = { x: Math.sin(b) * 11, z: Math.cos(b) * 11 }; g.player.yaw = b; g.player.flashlightOn = true; v.pitch = 0.02;
  [[-1.5, 19], [1.2, 21], [2.8, 18.5], [-3, 23], [0, 25]].forEach(([dx, r], i) => {
    const m = g.monsters[i]; const bb = b + dx * 0.05; m.mode = 'shamble'; m.pos = { x: Math.sin(bb) * r + dx, z: Math.cos(bb) * r };
  });
  g.t = 0.3;
}));

await pose('05-headlight-shadows', () => window.__field.set((g, v) => {
  // the far headlights behind you throw your shadow (and the wreck's) out ahead
  window.__calm(g);
  g.flares = [];
  const b = g.cfg.arena.landmarkBearing;
  g.player.pos = { x: Math.sin(b) * 3.5 + 1.5, z: Math.cos(b) * 3.5 }; g.player.yaw = b + Math.PI + 0.25; g.player.flashlightOn = false; v.pitch = -0.12;
  g.t = 0.25; // strobes between flashes
}));

await pose('06-tracks', () => window.__field.set((g, v) => {
  // from the roof, looking back along the skid, the flip and the drag
  window.__calm(g);
  const back = Math.atan2(-Math.cos(g.cfg.car.yaw), Math.sin(g.cfg.car.yaw)); // world bearing of the car's -x (rear) axis
  g.flares = [{ pos: { x: Math.sin(back) * 6.5, z: Math.cos(back) * 6.5 }, from: { x: 0, z: 0 }, state: 'burning', t: 5, burn: 20 }];
  g.player.pos = { x: Math.sin(back) * 0.4, z: Math.cos(back) * 0.4 }; g.player.y = g.cfg.car.top; g.player.onCar = true; g.player.grounded = true;
  g.player.yaw = back; v.pitch = -0.35; g.player.flashlightOn = false;
  g.t = 0.9 / g.cfg.arena.strobeHz;
}), 1200);

await pose('07-radio-under-flare', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.player.y = 0; g.player.onCar = false;
  const sp = window.__face(g, 'radio'); v.pitch = -0.3;
  g.flares = [{ pos: { x: sp.stand.x + 0.5, z: sp.stand.z + 0.6 }, from: { ...sp.stand }, state: 'burning', t: 3, burn: 20 }];
  g.player.flashlightOn = false; g.player.interacting = true; g.player.activeSpot = 'radio';
  g.radio.repair = 17; g.t = 0.05;
}));

await pose('08-debug', () => window.__field.set((g, v) => {
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0.2; v.pitch = -0.05; g.player.interacting = false; g.player.activeSpot = null;
  g.flares = [];
  const set = [[-6, 12, 'stalk'], [7, 11, 'probe'], [-10, 2, 'warn'], [0, -12, 'retreat']];
  set.forEach(([x, z, mode], i) => { const m = g.monsters[i]; m.pos = { x, z }; m.mode = mode; });
  g.radio.phase = 'wait'; g.radio.rescueLeft = 40; g.radio.rescueDist = 25;
}));
await page.keyboard.press('Backquote');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/08-debug.png' });
await page.keyboard.press('Backquote');

await pose('09-rescue-close', () => window.__field.set((g, v) => {
  window.__calm(g);
  const b = g.cfg.arena.landmarkBearing;
  g.player.pos = { x: Math.sin(b) * 5, z: Math.cos(b) * 5 }; g.player.yaw = b - 0.1; v.pitch = 0;
  g.radio.rescueDist = 16;
}));

await pose('11-reload-bar', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.radio.phase = 'repair'; g.radio.rescueDist = g.cfg.arena.landmarkDistance;
  g.player.pos = { x: 0, z: 5 }; g.player.y = 0; g.player.yaw = 0.1; v.pitch = -0.05; g.player.flashlightOn = false;
  g.player.mag = 0; g.player.reserve = 12; g.player.reloading = 1.3; g.player.reloadTotal = 2.4; g.player.reloadWindow = { a: 0.48, b: 0.6 }; g.player.reloadTried = false;
  g.player.flares = 1;
}));

await pose('12-flare-prompt', () => window.__field.set((g, v) => {
  g.player.reloading = 0; g.player.reloadWindow = null; g.player.mag = 3; g.player.flares = 0;
  window.__face(g, 'flares'); v.pitch = -0.25; g.player.activeSpot = 'flares'; g.flareReadyAt = g.t + 14;
}));

// Blood: shoot a hunter once and let it run for a moment (sim running), then look at the trail.
await page.evaluate(() => window.__field.set((g, v) => {
  window.__calm(g);
  g.flareReadyAt = 0; g.flares = [{ pos: { x: -1, z: 8 }, from: { x: -1, z: 8 }, state: 'burning', t: 2, burn: 60 }];
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0; g.player.flashlightOn = false; v.pitch = -0.25;
  const m = g.monsters[0]; m.mode = 'commit'; m.pos = { x: 0.4, z: 9 }; m.commitTime = 0; m.deep = false;
}));
await page.evaluate(() => window.__field.set((g) => { const m = g.monsters[0]; m.wounds = 1; m.mode = 'retreat'; m.timer = 6; m.fleeFrom = null; }));
await page.evaluate(() => { window.__field.frozen = false; });
await page.waitForTimeout(5000);
await page.evaluate(() => { window.__field.frozen = true; });
await pose('13-blood-trail', () => window.__field.set((g, v) => { g.player.yaw = 0; v.pitch = -0.3; g.t = Math.ceil(g.t * 1.6) / 1.6 + 0.25; }), 600);

// The far vehicle up on the bank: a real shape, its lights, shafts in the snow, exhaust.
await pose('14-embankment', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.flares = [];
  const b = g.cfg.arena.landmarkBearing;
  g.radio.rescueDist = 26;
  g.player.pos = { x: Math.sin(b) * 6 + 1, z: Math.cos(b) * 6 }; g.player.yaw = b + 0.12; v.pitch = 0.05; g.player.flashlightOn = false;
  g.t = 0.25;
}), 2500);

// Footprints: walk a loop (sim frozen, positions moved by hand so the tracks get laid), then look back at them.
await page.evaluate(() => window.__field.set((g, v) => {
  window.__calm(g);
  g.radio.rescueDist = g.cfg.arena.landmarkDistance;
  g.flares = [{ pos: { x: 3, z: 7 }, from: { x: 3, z: 7 }, state: 'burning', t: 2, burn: 60 }];
  g.player.pos = { x: 0, z: 5 }; g.player.flashlightOn = false; g.player.y = 0; g.player.onCar = false; g.player.grounded = true;
  const m = g.monsters[1]; m.mode = 'stalk'; m.pos = { x: 7, z: 4 };
}));
for (let i = 0; i < 40; i++) {
  await page.evaluate((i) => window.__field.set((g) => {
    const a = i / 40 * Math.PI * 1.2;
    g.player.pos = { x: 3 + Math.sin(a) * 3.5, z: 7 - Math.cos(a) * 3.5 + 1.5 };
    g.player.yaw = a + Math.PI / 2;
    g.monsters[1].pos = { x: 8 - i * 0.12, z: 4 + i * 0.2 };
  }), i);
  await page.waitForTimeout(120);
}
await pose('15-footprints', () => window.__field.set((g, v) => { g.player.pos = { x: 3, z: 3.2 }; g.player.yaw = 0.2; v.pitch = -0.45; g.t = 0.25; }), 1200);

// New models: the wreck close up, you, and the three kinds side by side; one side's lights smashed.
await pose('16-wreck', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.flares = [{ pos: { x: 3.5, z: 4.5 }, from: { x: 3.5, z: 4.5 }, state: 'burning', t: 2, burn: 60 }];
  g.strobes = [false, true];
  g.player.pos = { x: 4.2, z: 4.6 }; g.player.yaw = Math.atan2(-4.2, -4.6) - 0.35; g.player.flashlightOn = false; v.pitch = -0.15;
  g.t = 0.25;
}), 1200);
await pose('17-player', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.strobes = [true, true];
  g.flares = [{ pos: { x: 2, z: 8 }, from: { x: 2, z: 8 }, state: 'burning', t: 2, burn: 60 }];
  g.player.pos = { x: 1, z: 7 }; g.player.yaw = 2.6; g.player.flashlightOn = true; v.pitch = 0.1;
  g.t = 0.25;
}), 1200);
await pose('18-kinds', () => window.__field.set((g, v) => {
  window.__calm(g);
  g.flares = [{ pos: { x: 0, z: 10 }, from: { x: 0, z: 10 }, state: 'burning', t: 2, burn: 60 }];
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0; g.player.flashlightOn = false; v.pitch = 0.02;
  const pick = (k) => g.monsters.find((m) => m.kind === k && m.mode === 'shamble');
  [['hunter', -2.6], ['breaker', 0], ['rammer', 2.8]].forEach(([k, x]) => { const m = pick(k); m.mode = 'stalk'; m.timer = 99; m.pos = { x, z: 11.5 }; });
  g.t = 0.25;
}), 1500);

// Live run: unfreeze and let the sim play to catch runtime errors.
await page.evaluate(() => { window.__field.startHeadless('LIVE'); window.__field.frozen = false; });
await page.waitForTimeout(5000);
const t = await page.evaluate(() => window.__field.game.t);
await page.screenshot({ path: 'shots/10-live.png' });

await browser.close();
console.log(JSON.stringify({ modelsLoaded, liveSimSeconds: +t.toFixed(2), errors }, null, 2));
if (errors.length) process.exit(1);
