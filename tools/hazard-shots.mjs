// Headless visual check for the packet 05 hazards: one posed shot each, from dist/field.html in sandbox
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

async function pose(name, fn, wait = 1000) {
  await page.evaluate(() => { window.__field.startHeadless('HZSHOTS'); });
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/hz-${name}.png` });
}
const calm = `const calm = (g) => { g.hordeTarget = 0; g.breakOffTimer = 1e9; g.monsters.forEach((m, i) => { m.mode = 'shamble'; m.pos = { x: Math.sin(i) * 24, z: Math.cos(i) * 24 }; }); };`;

await pose('1-fire', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('fire'); g.hazards.fire.stage = 3; g.hazards.fire.fuse = 17; g.player.pos = { x: 5.5, z: 4.5 }; g.player.yaw = Math.atan2(-5.5, -4.5); v.pitch = -0.12; }); F.frozen = true;`));
await pose('2-swarm', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); g.flares = []; F.spawnHazard('swarm'); g.player.pos = { x: 1, z: 6 }; g.player.yaw = 0.1; g.player.flashlightOn = true; g.hazards.swarm.pos = { x: 1.6, z: 10 }; v.pitch = 0.02; }); F.frozen = true;`));
await pose('3-tentacle', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('tentacle'); const T = g.hazards.tentacles[0]; T.origin = { x: 2, z: 19 }; T.path = []; for (let i = 0; i <= 20; i++) T.path.push({ x: 2 + Math.sin(i * 0.5) * 1.5, z: 19 - i * 0.62 }); T.tip = { x: 2.3, z: 6.4 }; T.state = 'grab'; g.player.held = T.id; g.player.pos = { x: 2.3, z: 6.3 }; g.player.yaw = Math.PI - 0.2; v.pitch = -0.1; }); F.frozen = true;`));
await pose('4-cold', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('cold'); g.player.heat = 6; g.player.pos = { x: 3, z: 6 }; g.player.yaw = Math.PI + 0.4; v.pitch = -0.08; }); F.frozen = true;`));
await pose('5-gust', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('gust'); g.hazards.gust.phase = 'blow'; g.hazards.gust.t = 1; g.player.pos = { x: 3, z: 6 }; g.player.yaw = Math.PI + 0.4; v.pitch = -0.05; }); F.frozen = true;`), 2200);
await pose('6-statue', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('statue'); g.hazards.statue.pos = { x: 0.5, z: 11 }; g.hazards.statue.yaw = Math.PI; g.player.pos = { x: 0, z: 5 }; g.player.yaw = 0.08; g.player.flashlightOn = true; v.pitch = 0.05; }); F.frozen = true;`));
await pose('7-crawler', new Function(`${calm} const F = window.__field; F.set((g, v) => { calm(g); F.spawnHazard('crawler'); const sp = F.spot('radio'); g.player.pos = { x: sp.stand.x + 0.6, z: sp.stand.z + 0.8 }; g.player.yaw = Math.atan2(sp.face.x - g.player.pos.x, sp.face.z - g.player.pos.z); const C = g.hazards.crawler; C.state = 'tell'; C.pos = { ...sp.face }; v.pitch = -0.35; }); F.frozen = true;`));
await browser.close();
console.log(JSON.stringify({ shots: 7, errors }, null, 2));
if (errors.length) process.exit(1);
