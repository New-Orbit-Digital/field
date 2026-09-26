// Headless check of the loaded models in the real game (dist/field.html): each monster kind alone in your
// flashlight, the player, the wreck, the zombies and trees out at the edge. Saves shots/models-*.png.
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
await page.goto('file://' + resolve('dist/field.html') + '?seed=MODELS');
await page.waitForFunction(() => window.__field, null, { timeout: 30000 });
const loaded = await page.evaluate(() => window.__field.modelsReady());
await page.evaluate(() => {
  window.__field.startHeadless('MODELS');
  window.__field.frozen = true;
  window.__clear = (g) => {
    g.hordeTarget = 0; g.breakOffTimer = 1e9; g.flares = [];
    g.monsters.forEach((m) => { m.mode = 'shamble'; const b = Math.atan2(m.pos.x, m.pos.z) + Math.PI; m.pos = { x: Math.sin(b) * 40, z: Math.cos(b) * 40 }; });
  };
});

async function shot(name, fn, wait = 1200) {
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/models-${name}.png` });
}

for (const [kind, mode] of [['hunter', 'warn'], ['breaker', 'stalk'], ['rammer', 'stalk']]) {
  await shot(kind, `window.__field.set((g, v) => {
    window.__clear(g);
    g.player.pos = { x: 0, z: 6 }; g.player.y = 0; g.player.yaw = 0.1; g.player.flashlightOn = true; v.pitch = -0.04;
    const m = g.monsters.find((q) => q.kind === '${kind}');
    m.mode = '${mode}'; m.timer = 99; m.pos = { x: 1.6, z: 11.5 };
    g.t = 0.25;
  })`);
}
await shot('player', () => window.__field.set((g, v) => {
  window.__clear(g);
  g.flares = [{ pos: { x: 3, z: 7 }, from: { x: 3, z: 7 }, state: 'burning', t: 2, burn: 60 }];
  g.player.pos = { x: 2, z: 6 }; g.player.yaw = 2.2; g.player.flashlightOn = true; v.pitch = 0.05;
}));
await shot('wreck', () => window.__field.set((g, v) => {
  window.__clear(g);
  g.strobes = [false, true];
  g.player.pos = { x: 1.5, z: 5.5 }; g.player.yaw = Math.atan2(-1.5, -5.5); g.player.flashlightOn = true; v.pitch = -0.12;
  g.t = 0.05;
}));
await shot('edge', () => window.__field.set((g, v) => {
  // out at the edge of the dark with the light on: zombies among the crowd, dead trees behind
  window.__clear(g);
  const zs = window.__field.world.scenery.zombies;
  const b = zs.length ? zs[0].bearing : 0.5;
  zs.forEach((z, i) => { z.bearing = b + (i - 3) * 0.09; z.dist = 20 + (i % 3) * 1.5; z.fleeT = 0; });
  g.player.pos = { x: Math.sin(b) * 11, z: Math.cos(b) * 11 }; g.player.yaw = b; g.player.flashlightOn = false; v.pitch = 0.1;
  g.flares = [{ pos: { x: Math.sin(b) * 16, z: Math.cos(b) * 16 }, from: { x: 0, z: 0 }, state: 'burning', t: 2, burn: 60 }];
  g.t = 0.3;
}), 2000);
await browser.close();
console.log(JSON.stringify({ loaded, errors }, null, 2));
if (errors.length || loaded.length !== 9) process.exit(1);
