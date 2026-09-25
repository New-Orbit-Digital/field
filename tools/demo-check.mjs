// Mobile demo check: emulated phone, tap to start, let the scripted player run.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + resolve('dist/field.html') + '?seed=DEMO1');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/10-mobile-title.png' });
await page.tap('#overlay');
await page.waitForTimeout(Number(process.env.WAIT || 9000));
const s = await page.evaluate(() => {
  const g = window.__field.game;
  return { t: +g.t.toFixed(1), events: g.events.length, warns: g.events.filter(e => e.type === 'warn').length, flashOn: g.events.filter(e => e.type === 'flash_on').length, repels: g.events.filter(e => e.type === 'repel').length, hits: g.events.filter(e => e.type === 'hit').length, shots: g.events.filter(e => e.type === 'shot').length, scatters: g.events.filter(e => e.type === 'scatter').length, radio: +g.radio.repair.toFixed(1), overlayHidden: document.getElementById('overlay').hidden };
});
await page.screenshot({ path: 'shots/11-mobile-demo.png' });
await browser.close();
console.log(JSON.stringify({ ...s, errors }, null, 2));
if (errors.length) process.exit(1);
