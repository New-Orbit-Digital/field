// Headless visual check for the active packet 05 hazards (swarm and cold are backlogged): one posed shot each, from dist/field.html in sandbox
// mode. Saves shots/hz-*.png and prints any page errors.
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
await page.goto('file://' + resolve('dist/field.html') + '?seed=HZSHOTS&hazard');
await page.waitForTimeout(1200);
await page.evaluate(() => window.__field.modelsReady());
await page.screenshot({ path: 'shots/hz-0-picker.png' });

async function pose(name, fn, wait = 1000) {
  await page.evaluate(() => { window.__field.startHeadless('HZSHOTS'); });
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/hz-${name}.png` });
}
const calm = `const calm = (g) => { g.hordeTarget = 0; g.breakOffTimer = 1e9; g.monsters.forEach((m, i) => { m.mode = 'shamble'; m.pos = { x: Math.sin(i) * 24, z: Math.cos(i) * 24 }; }); };`;

await pose('1-fire', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('fire'); g.hazards.fire.phase = 'burn'; g.hazards.fire.burnT = 20; g.player.pos = { x: 5.5, z: 4.5 }; g.player.yaw = Math.atan2(-5.5, -4.5); v.pitch = -0.12; }); F.frozen = true;`));
await pose('3-tentacle', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('tentacle'); const T = g.hazards.tentacles[0]; T.origin = { x: -14, z: 10 }; T.path = []; for (let i = 0; i <= 20; i++) T.path.push({ x: -14 + i * 0.62, z: 10 - i * 0.45 + Math.sin(i * 0.6) * 0.8 }); T.tip = { x: -1.2, z: 1.2 }; T.state = 'smash'; T.side = 0; g.player.pos = { x: 3, z: 6 }; g.player.yaw = Math.atan2(-4, -5); v.pitch = -0.1; }); F.frozen = true;`));
await pose('5-gust', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('gust'); g.hazards.gust.phase = 'blow'; g.hazards.gust.t = 1; g.hazards.gust.dir = 1.2; g.player.pos = { x: 3, z: 6 }; g.player.yaw = Math.PI + 0.4; v.pitch = -0.05; }); F.frozen = false; setTimeout(() => { F.frozen = true; }, 1800);`), 2400);
await pose('6-zombie', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('zombie'); g.hazards.zombie.pos = { x: 0.5, z: 9 }; g.hazards.zombie.yaw = Math.PI; g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0.08; g.player.flashlightOn = true; v.pitch = 0.05; }); F.frozen = true;`));
await browser.close();
console.log(JSON.stringify({ shots: 5, errors }, null, 2)); // picker + fire, tentacle, whiteout, zombie
if (errors.length) process.exit(1);
