// Rebuilds src/render/models/soldier.glb from assets/source/Soldier.fbx (run: node tools/convert-soldier.mjs).
// Done in headless Chromium with three's own FBXLoader + GLTFExporter, so no Blender is needed:
//   - merges each mesh's material groups (the FBX has ~340 tiny groups → 11 meshes, far fewer draw calls)
//   - keeps only the animation clips the game uses (soldier.js), which roughly halves the file
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const KEEP = ['Idle_Gun', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot', 'Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Run_Shoot', 'HitRecieve', 'Death', 'Interact'];
const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
const KEEP = ${JSON.stringify(KEEP)};
const fbx = await new FBXLoader().loadAsync('/assets/source/Soldier.fbx');
fbx.traverse((o) => { if (o.isMesh && o.geometry.groups.length > 1) o.geometry = BGU.mergeGroups(o.geometry); });
const clips = fbx.animations.filter((a) => KEEP.includes(a.name.split('|').pop())).map((a) => { const c = a.clone(); c.name = a.name.split('|').pop(); return c; });
const glb = new Uint8Array(await new GLTFExporter().parseAsync(fbx, { binary: true, animations: clips, onlyVisible: true }));
let s = ''; for (let i = 0; i < glb.length; i += 0x8000) s += String.fromCharCode.apply(null, glb.subarray(i, i + 0x8000));
window.result = { b64: btoa(s), clips: clips.map((c) => c.name) };
</script>`;

const root = resolve('.');
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  try {
    const body = await readFile(join(root, url));
    res.writeHead(200, { 'content-type': extname(url) === '.js' ? 'text/javascript' : 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.result, null, { timeout: 120000 });
const { b64, clips } = await page.evaluate(() => window.result);
const out = Buffer.from(b64, 'base64');
await writeFile('src/render/models/soldier.glb', out);
await browser.close();
server.close();
console.log(`src/render/models/soldier.glb ${(out.length / 1024).toFixed(0)} KB · clips: ${clips.join(', ')}`);
if (clips.length !== KEEP.length) process.exit(1);
