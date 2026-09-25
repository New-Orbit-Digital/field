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
await page.screenshot({ path: 'shots/01-title.png' });

async function pose(name, fn, wait = 900) {
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/${name}.png` });
}
await page.evaluate(() => {
  window.__field.startHeadless('SHOTS');
  window.__field.frozen = true;
  window.__park = (g) => g.monsters.forEach((m) => { m.pos = { x: 0, z: -40 }; m.mode = 'stalk'; });
  window.__face = (g, name, pitch = -0.2) => {
    const sp = window.__field.spot(name);
    g.player.pos = { ...sp.stand };
    g.player.yaw = Math.atan2(sp.face.x - sp.stand.x, sp.face.z - sp.stand.z);
    return sp;
  };
});

await pose('02-beast-at-edge', () => window.__field.set((g, v) => {
  window.__park(g);
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0; v.pitch = -0.02;
  g.monsters[0].mode = 'probe'; g.monsters[0].pos = { x: 1.2, z: 11.5 };
  g.t = 0.05;
}));

await pose('03-beast-lunge-flashlight', () => window.__field.set((g, v) => {
  window.__park(g);
  g.player.pos = { x: 2, z: 5 }; g.player.yaw = 0.15; g.player.flashlightOn = true; v.pitch = -0.02;
  g.monsters[0].mode = 'commit'; g.monsters[0].pos = { x: 3.0, z: 10 };
  g.t = 0.55 / g.cfg.arena.strobeHz;
}));

await pose('04-radio', () => window.__field.set((g, v) => {
  window.__park(g);
  window.__face(g, 'radio'); v.pitch = -0.3;
  g.player.flashlightOn = false; g.player.interacting = true; g.player.activeSpot = 'radio';
  g.radio.repair = 17; g.t = 0.05;
}));

await pose('05-trunk', () => window.__field.set((g, v) => {
  window.__face(g, 'ammo'); v.pitch = -0.3;
  g.player.interacting = false; g.player.activeSpot = 'ammo'; g.player.reserve = 0;
}));

await pose('06-flare-burning', () => window.__field.set((g, v) => {
  window.__park(g);
  g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0.3; v.pitch = -0.05; g.player.activeSpot = null;
  g.flares = [{ pos: { x: 4.5, z: 15 }, from: { x: 0, z: 5 }, state: 'burning', t: 5 }];
  g.monsters[0].mode = 'stalk'; g.monsters[0].pos = { x: 8.5, z: 19 };
  g.t = 0.05;
}));

await pose('07-on-roof', () => window.__field.set((g, v) => {
  window.__park(g);
  g.flares = [];
  g.player.pos = { x: 0.2, z: 0 }; g.player.y = g.cfg.car.top; g.player.onCar = true; g.player.grounded = true;
  g.player.yaw = 2.0; v.pitch = -0.12; g.player.flashlightOn = true;
  g.monsters[0].mode = 'climb'; g.monsters[0].pos = { x: 1.9, z: -0.9 };
}));

await pose('08-horde-debug', () => window.__field.set((g, v) => {
  g.player.pos = { x: 0, z: 5 }; g.player.y = 0; g.player.onCar = false; g.player.yaw = 0.2; v.pitch = -0.05; g.player.flashlightOn = false;
  while (g.monsters.length < 6) g.monsters.push({ ...g.monsters[0], id: g.monsters.length + 1, pos: { x: 0, z: 0 }, dodgeVel: { x: 0, z: 0 } });
  const ring = [[-6, 14, 'stalk'], [7, 13, 'probe'], [-12, 2, 'warn'], [11, -4, 'stalk'], [0, -12, 'retreat'], [3.5, 12, 'commit']];
  g.monsters.forEach((m, i) => { m.pos = { x: ring[i][0], z: ring[i][1] }; m.mode = ring[i][2]; });
  g.radio.phase = 'wait'; g.radio.rescueLeft = 40; g.radio.rescueDist = 25;
}));
await page.keyboard.press('Backquote');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/08-horde-debug.png' });
await page.keyboard.press('Backquote');

await pose('09-rescue-close', () => window.__field.set((g, v) => {
  window.__park(g);
  const b = g.cfg.arena.landmarkBearing;
  g.player.pos = { x: Math.sin(b) * 5, z: Math.cos(b) * 5 }; g.player.yaw = b - 0.1; v.pitch = 0;
  g.radio.rescueDist = 16;
}));

await pose('11-reload-bar', () => window.__field.set((g, v) => {
  window.__park(g);
  g.player.pos = { x: 0, z: 5 }; g.player.y = 0; g.player.yaw = 0.1; v.pitch = -0.05; g.player.flashlightOn = false;
  g.player.mag = 0; g.player.reserve = 12; g.player.reloading = 1.3; g.player.reloadTotal = 2.4; g.player.reloadWindow = { a: 0.48, b: 0.6 }; g.player.reloadTried = false;
  g.player.flares = 1;
}));

await pose('12-flare-prompt', () => window.__field.set((g, v) => {
  g.player.reloading = 0; g.player.reloadWindow = null; g.player.mag = 3; g.player.flares = 0;
  window.__face(g, 'flares'); v.pitch = -0.25; g.player.activeSpot = 'flares';
}));

// Live run: unfreeze and let the sim play to catch runtime errors.
await page.evaluate(() => { window.__field.startHeadless('LIVE'); window.__field.frozen = false; });
await page.waitForTimeout(5000);
const t = await page.evaluate(() => window.__field.game.t);
await page.screenshot({ path: 'shots/10-live.png' });

await browser.close();
console.log(JSON.stringify({ liveSimSeconds: +t.toFixed(2), errors }, null, 2));
if (errors.length) process.exit(1);
