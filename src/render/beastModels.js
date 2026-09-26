// The monsters as real models, one per kind (Justin's mapping, 2026-09-26):
//   hunter  → spider     (animated: walk, idle, attack)
//   breaker → mantis     (rears up and hammers the light bar)
//   rammer  → centipede  (its body ripples as it goes; it charges low)
// Each view has the same fields beast.js animates (body, eyes, yaw, gait…), plus `after()` for the model's own
// motion. Sizes, facing and eye positions are set here; colours come from GRIT in assets.js.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { model, applyGrit, GRIT } from './assets.js';
import { MODES } from '../sim/game.js';

// size: the model is scaled so this dimension (m) matches · front: which way the model faces as loaded (+z / -z)
// yStretch: extra vertical scale · eyes: [x, y, z] as fractions of the scaled bounding box (z = 1 is the front)
const SPECS = {
  hunter:  { key: 'spider', size: { x: 2.5 }, front: 1, eyes: [0.035, 0.36, 0.94], eyeSize: 0.035 },
  breaker: { key: 'mantis', size: { y: 2.05 }, front: -1, eyes: [0.05, 0.93, 0.98], eyeSize: 0.03 },
  rammer:  { key: 'centipede', size: { z: 4.4 }, yStretch: 5, front: 1, eyes: [0.06, 0.55, 0.985], eyeSize: 0.03 },
};

const gritted = new Set();
function prepared(key) {
  const g = model(key);
  if (!g) return null;
  if (!gritted.has(key)) { applyGrit(g.scene, GRIT[key]); gritted.add(key); }
  return g;
}

export function modelBeastReady(kind) {
  const s = SPECS[kind];
  return !!(s && model(s.key));
}

// Scale + face + stand on y = 0, wrapped so +z is forward. Returns { wrap, size } (size of the scaled box).
function fit(obj, spec) {
  const wrap = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(obj);
  wrap.add(inner);
  if (spec.front < 0) inner.rotation.y = Math.PI;
  // precise: skinned meshes are measured as posed by their bones (their raw geometry is in other units)
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const sz = box.getSize(new THREE.Vector3());
  const [axis, target] = Object.entries(spec.size)[0];
  const s = target / sz[axis];
  inner.scale.set(s, s * (spec.yStretch || 1), s);
  wrap.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(inner, true);
  const c = b2.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b2.min.y, -c.z);
  wrap.updateMatrixWorld(true);
  return { wrap, size: new THREE.Box3().setFromObject(wrap, true).getSize(new THREE.Vector3()) };
}

// Centipede ripple: a travelling sideways wave along the body, in the model's own (unscaled) space.
function addRipple(root) {
  const uniforms = { uPhase: { value: 0 }, uAmp: { value: 0 } };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      const c = m.clone();
      c.onBeforeCompile = (sh) => {
        sh.uniforms.uPhase = uniforms.uPhase;
        sh.uniforms.uAmp = uniforms.uAmp;
        sh.vertexShader = 'uniform float uPhase;\nuniform float uAmp;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.x += sin( transformed.z * 0.2 - uPhase ) * uAmp;\ntransformed.y += max( 0.0, sin( transformed.z * 0.4 - uPhase * 2.0 ) ) * uAmp * 0.12;',
        );
      };
      c.customProgramCacheKey = () => 'field-ripple';
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return uniforms;
}

export function buildModelBeast(kind) {
  const spec = SPECS[kind];
  const gltf = spec && prepared(spec.key);
  if (!gltf) return null;
  const obj = kind === 'hunter' ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
  const { wrap, size } = fit(obj, spec);

  const group = new THREE.Group();
  const body = new THREE.Group();   // posed by beast.js (crouch, pitch, flinch)
  const sway = new THREE.Group();   // the model's own motion, set fresh every frame by after()
  group.add(body);
  body.add(sway);
  sway.add(wrap);

  // eyes that catch your light (and glow when it's coming for you)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8f0d0, transparent: true, opacity: 0, fog: false });
  const [ex, ey, ez] = spec.eyes;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(spec.eyeSize, 8, 6), eyeMat);
    e.position.set(s * ex * size.x, ey * size.y, (ez - 0.5) * size.z);
    body.add(e);
  }

  const v = {
    kind, group, body, sway, eyeMat, model: spec.key, size,
    // parts beast.js poses on the procedural build; harmless stand-ins here
    torso: new THREE.Object3D(), neck: new THREE.Object3D(), head: new THREE.Object3D(), jaw: new THREE.Object3D(),
    legs: [], spine: [],
    B: { hip: kind === 'hunter' ? 0.9 : kind === 'breaker' ? 1.3 : 0.6 },
    crouchScale: 0.25,
    vis: new THREE.Vector3(), gait: 0, yaw: 0, flinch: 0, bleed: 0,
    tiltT: 2 + Math.random() * 4, tilt: 0, tiltTarget: 0,
  };

  if (kind === 'hunter' && gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(obj);
    const clip = (n) => gltf.animations.find((a) => a.name.endsWith(n));
    const acts = {};
    for (const n of ['Walk', 'Idle', 'Attack']) { const c = clip(n); if (c) { acts[n] = mixer.clipAction(c); acts[n].play(); acts[n].setEffectiveWeight(0); } }
    mixer.setTime(Math.random() * 2);
    let cur = null;
    v.after = (v, m, state, dt, { speed, fast }) => {
      const attacking = m.mode === MODES.WARN || m.mode === MODES.COMMIT || m.mode === MODES.CLIMB;
      const want = attacking && acts.Attack ? 'Attack' : speed > 0.15 ? 'Walk' : 'Idle';
      if (want !== cur) {
        for (const [n, a] of Object.entries(acts)) a.setEffectiveWeight(n === want ? 1 : 0);
        cur = want;
      }
      if (acts.Walk) acts.Walk.timeScale = Math.max(0.4, Math.min(2.2, speed * (fast ? 0.9 : 0.8)));
      mixer.update(dt);
    };
  } else if (kind === 'rammer') {
    const u = addRipple(obj);
    v.after = (v, m, state, dt, { speed, fast }) => {
      u.uPhase.value = v.gait * Math.PI * 2 * 0.9;
      const want = (m.mode === MODES.WINDUP ? 1.2 : Math.min(1, speed / 2)) * (fast ? 2.4 : 1.6);
      u.uAmp.value += (want - u.uAmp.value) * Math.min(1, dt * 6);
      v.sway.rotation.x = m.mode === MODES.WINDUP ? -0.15 - Math.sin(state.t * 9) * 0.08 : 0; // rears its head, twitching
    };
  } else {
    // mantis: a stiff, lurching gait (it's one rigid piece), swaying forelimbs held high; hammers when smashing
    v.after = (v, m, state, dt, { speed }) => {
      const g = v.gait * Math.PI * 2;
      const k = Math.min(1, speed);
      v.sway.position.y = Math.abs(Math.sin(g)) * 0.05 * k;
      v.sway.rotation.z = Math.sin(g) * 0.07 * k + v.tilt * 0.3;
      v.sway.rotation.x = m.mode === MODES.SMASH ? Math.sin(state.t * 11) * 0.22
        : m.mode === MODES.SHAMBLE || m.mode === MODES.STALK ? Math.sin(state.t * 0.9 + v.tiltT) * 0.04 : 0;
    };
  }
  return v;
}
