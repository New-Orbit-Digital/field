// Loaded 3D models (src/render/models/). Everything starts with the procedural stand-ins, then swaps to the
// real model as soon as its file has loaded. A missing or broken file just leaves the stand-in in place.
// URLs: on the site the files sit next to this module; the single-file builds inline them as data URLs
// (window.__FIELD_MODELS, injected by tools/build.mjs). Off switch: ?models=0.
//
// Also the "grit" helpers: every loaded model is re-coloured here, so the originals stay untouched in the repo
// and the look is tuned in one place (GRIT below).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_FILES = {
  soldier: 'soldier.glb',      // the player (converted from assets/source/Soldier.fbx, trimmed to the clips we use)
  pistol: 'pistol.glb',
  copCar: 'cop-car.glb',
  trees: 'dead-trees.glb',
  glass: 'smashed-glass.glb',
  spider: 'spider.glb',        // hunters
  mantis: 'mantis.glb',        // breakers
  centipede: 'centipede.glb',  // rammers
  zombie: 'zombie.glb',        // shamblers out at the edge (scenery)
};

const cache = new Map();
const listeners = new Set();
let pending = null;

function modelUrl(file) {
  const inline = typeof window !== 'undefined' && window.__FIELD_MODELS && window.__FIELD_MODELS[file];
  return inline || new URL(`./models/${file}`, import.meta.url).href;
}

export function modelsEnabled() {
  return new URLSearchParams(location.search).get('models') !== '0';
}

// Start loading everything (once). Resolves when every file has loaded or failed.
export function loadModels() {
  if (pending) return pending;
  if (!modelsEnabled()) return (pending = Promise.resolve([]));
  const loader = new GLTFLoader();
  pending = Promise.all(Object.entries(MODEL_FILES).map(([key, file]) => loader.loadAsync(modelUrl(file))
    .then((gltf) => {
      cache.set(key, gltf);
      for (const cb of listeners) { try { cb(key, gltf); } catch (e) { console.error(e); } }
      return key;
    })
    .catch(() => null)));
  return pending;
}

export const model = (key) => cache.get(key) || null;
export const loadedModels = () => [...cache.keys()];

// cb(key, gltf) for every model, now for those already loaded and later for the rest.
export function onModel(cb) {
  listeners.add(cb);
  for (const [k, g] of cache) cb(k, g);
  return () => listeners.delete(cb);
}

// ---------- grit ----------
// tint: colour everything is pulled toward · mix: how far (0..1) · desat: 0..1 · dark: brightness multiplier
// mottle: random per-vertex darkening (0..1) so flat colours read as dirt, blotches and old stains.
export const GRIT = {
  // Tints are sRGB hex (three works in linear, so they land darker than they read here). The flashlight is
  // very strong up close, so the monsters are matte (Lambert: no sheen to catch it) and nearly as dark as the
  // old procedural ones (0x0b0b0e). Lighter than this and they read tan/bone-white in the beam.
  spider:    { tint: 0x4a3f33, mix: 0.4, desat: 0.75, dark: 0.12, mottle: 0.6, matte: true },
  mantis:    { tint: 0x5b503c, mix: 0.8, desat: 0.9, dark: 0.05, mottle: 0.6, matte: true },
  centipede: { tint: 0x5a3a24, mix: 0.35, desat: 0.7, dark: 0.22, mottle: 0.5, matte: true },
  zombie:    { tint: 0x6b6e5e, mix: 0.55, desat: 0.85, dark: 0.12, mottle: 0.6, matte: true },
  trees:     { tint: 0x3a3027, mix: 0.4, desat: 0.6, dark: 0.6, mottle: 0.3, matte: true },
  copCar:    { tint: 0x3a3833, mix: 0.25, desat: 0.35, dark: 0.62, mottle: 0, rough: 0.7 },
  glass:     { tint: 0x9aa8b8, mix: 0.6, desat: 0.3, dark: 1, mottle: 0, rough: 0.15 },
};

const _c = new THREE.Color(), _t = new THREE.Color();
function gritColor(color, g) {
  _c.copy(color);
  const hsl = {};
  _c.getHSL(hsl);
  _c.setHSL(hsl.h, hsl.s * (1 - g.desat), hsl.l);
  _t.setHex(g.tint);
  _c.lerp(_t, g.mix).multiplyScalar(g.dark);
  return _c.clone();
}

// A texture run through the same grit, plus grime speckle. Nearest filtering to suit the PS1 pass.
export function gritTexture(tex, g, { grime = 0.35, seed = 1 } = {}) {
  const img = tex && tex.image;
  if (!img || !img.width) return tex;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const t = new THREE.Color(g.tint);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < p.length; i += 4) {
    const R = p[i] / 255, G = p[i + 1] / 255, B = p[i + 2] / 255;
    const L = 0.3 * R + 0.59 * G + 0.11 * B;
    let rr = R + (L - R) * g.desat, gg = G + (L - G) * g.desat, bb = B + (L - B) * g.desat;
    rr += (t.r - rr) * g.mix; gg += (t.g - gg) * g.mix; bb += (t.b - bb) * g.mix;
    const n = 1 - grime * rnd() * rnd();
    p[i] = Math.min(255, rr * g.dark * n * 255); p[i + 1] = Math.min(255, gg * g.dark * n * 255); p[i + 2] = Math.min(255, bb * g.dark * n * 255);
  }
  x.putImageData(d, 0, 0);
  // blotches of dirt and old stains
  for (let i = 0; i < c.width * c.height / 900; i++) {
    const cx = rnd() * c.width, cy = rnd() * c.height, rad = 2 + rnd() * c.width / 24;
    const grad = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(${20 + rnd() * 20},${14 + rnd() * 12},${8},${0.25 + rnd() * 0.35})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grad;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  const out = new THREE.CanvasTexture(c);
  out.colorSpace = THREE.SRGBColorSpace;
  out.flipY = tex.flipY;
  out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  out.magFilter = THREE.NearestFilter;
  out.minFilter = THREE.NearestFilter;
  out.generateMipmaps = false;
  return out;
}

// Per-vertex darkening from a position hash (same on every copy of a model).
function mottle(geometry, amount) {
  if (!amount || !geometry.attributes.position) return;
  const pos = geometry.attributes.position;
  const n = pos.count;
  const old = geometry.attributes.color;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const h = Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453;
    const f = 1 - amount * (h - Math.floor(h)) ** 2;
    col[i * 3] = (old ? old.getX(i) : 1) * f;
    col[i * 3 + 1] = (old ? old.getY(i) : 1) * f * 0.97;
    col[i * 3 + 2] = (old ? old.getZ(i) : 1) * f * 0.93;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// Re-colour every mesh under root with a GRIT entry (in place; call on a fresh clone or the cached scene once).
export function applyGrit(root, g, { mottleGeometry = true, shadows = true } = {}) {
  const seen = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (mottleGeometry && g.mottle && !o.geometry.userData.mottled) { mottle(o.geometry, g.mottle); o.geometry.userData.mottled = true; }
    const conv = (m) => {
      if (seen.has(m)) return seen.get(m);
      const common = {
        color: m.map ? 0xffffff : gritColor(m.color || new THREE.Color(1, 1, 1), g),
        map: m.map ? gritTexture(m.map, g) : null,
        vertexColors: !!o.geometry.attributes.color,
        transparent: m.transparent, opacity: m.opacity, side: m.side,
      };
      const out = g.matte ? new THREE.MeshLambertMaterial(common)
        : new THREE.MeshStandardMaterial({ ...common, roughness: g.rough ?? 0.9, metalness: 0 });
      out.name = m.name;
      seen.set(m, out);
      return out;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    if (shadows) { o.castShadow = true; o.receiveShadow = true; }
  });
  return root;
}
