// Checks the no-build GitHub Pages version (index.html + src/ + three from the CDN import map)
// exactly as justbost.com/field/ serves it: under a /field/ subpath. CDN requests are answered
// from node_modules so this runs offline. Saves shots/pages-*.png.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const root = resolve('.');
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith('/field/')) { res.writeHead(404); return res.end(); }
  let p = url.slice('/field/'.length) || 'index.html';
  try {
    const body = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

mkdirSync('shots', { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cdn = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('https://cdn.jsdelivr.net/npm/three@*/build/**', async (route) => {
  const file = route.request().url().split('/build/')[1];
  cdn.push(file);
  route.fulfill({ path: resolve('node_modules/three/build', file), contentType: 'text/javascript' });
});
await page.goto(`http://localhost:${port}/field/?seed=PAGES`);
await page.waitForFunction(() => window.__field, null, { timeout: 30000 });
await page.screenshot({ path: 'shots/pages-title.png' });
await page.evaluate(() => { window.__field.startHeadless('PAGES'); });
await page.waitForTimeout(4000);
const t = await page.evaluate(() => window.__field.game.t);
await page.screenshot({ path: 'shots/pages-live.png' });
await browser.close();
server.close();
console.log(JSON.stringify({ servedUnder: '/field/', cdnFiles: cdn, liveSimSeconds: +t.toFixed(2), errors }, null, 2));
if (errors.length || t <= 0) process.exit(1);
