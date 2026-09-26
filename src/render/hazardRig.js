// Hazards (packet 05) on screen: fire on the wreck, the swarm, tentacles, the zombie (zombie.glb once it loads,
// placeholder boxes until then), and the gust's wind strength/direction for the snow.
// Reads sim state only. Lights are preallocated (one for the fire) so the light count never changes mid-night.
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { carDistance, carToWorld, fireLightPos } from '../sim/game.js';
import { onModel, applyGrit, GRIT } from './assets.js';

export function createHazardRig(scene, cfg) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------- fire ----------
  const fireLight = new THREE.PointLight(0xff7a20, 0, 14, 1.2);
  scene.add(fireLight);
  const flameTex = glowTexture([[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,150,40,0.9)'], [0.6, 'rgba(220,60,10,0.35)'], [1, 'rgba(120,20,0,0)']]);
  const flames = [];
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.visible = false; root.add(s);
    flames.push({ s, seed: Math.random() * 10, x: -2.1 + (i % 6) * 0.85, z: ((i / 6) | 0) * 0.6 - 0.6 });
  }
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5, depthWrite: false });
  const smoke = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), smokeMat); m.visible = false; root.add(m); return { m, t: Math.random() }; });

  // ---------- swarm ----------
  const N = 90;
  const swarmGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(N * 3);
  swarmGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const swarm = new THREE.Points(swarmGeo, new THREE.PointsMaterial({ color: 0x0a0806, size: 0.09, sizeAttenuation: true }));
  swarm.frustumCulled = false; swarm.visible = false; root.add(swarm);
  const swarmSeeds = Array.from({ length: N }, () => [Math.random() * 6.28, Math.random() * 6.28, 0.4 + Math.random()]);

  // ---------- tentacles ----------
  const tentMat = new THREE.MeshStandardMaterial({ color: 0x1a0f14, roughness: 0.5, metalness: 0.1 });
  const tentMeshes = new Map();

  // ---------- zombie (placeholder boxes until the real asset lands) ----------
  const flesh = new THREE.MeshStandardMaterial({ color: 0x5f6b58, roughness: 0.95 });
  const rags = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 });
  const zombie = new THREE.Group();
  const box = (w, h, d, x, y, z, mat, rx = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; zombie.add(m); return m; };
  box(0.44, 0.7, 0.26, 0, 1.25, 0, rags, 0.2);           // torso, hunched
  const head = box(0.24, 0.28, 0.24, 0, 1.72, 0.12, flesh, 0.3, 0.25); // head, lolling
  const armL = box(0.1, 0.7, 0.1, -0.27, 1.3, 0.3, flesh, -1.3); const armR = box(0.1, 0.7, 0.1, 0.27, 1.3, 0.3, flesh, -1.2); // arms out
  const legL = box(0.14, 0.9, 0.14, -0.1, 0.45, 0, rags); const legR = box(0.14, 0.9, 0.14, 0.1, 0.45, 0, rags);
  zombie.visible = false; root.add(zombie);
  // swap in the real zombie model (packet 06's zombie.glb) once it loads; the boxes are the fallback
  let zModel = null;
  onModel((key, gltf) => {
    if (key !== 'zombie' || zModel) return;
    const m = gltf.scene.clone(true);
    applyGrit(m, GRIT.zombie);
    const box3 = new THREE.Box3().setFromObject(m);
    const size = box3.getSize(new THREE.Vector3()), c = box3.getCenter(new THREE.Vector3());
    const k = 1.8 / size.y;
    m.scale.setScalar(k);
    m.position.set(-c.x * k, -box3.min.y * k, -c.z * k);
    zModel = new THREE.Group();
    zModel.add(m);
    for (const ch of [...zombie.children]) ch.visible = false;
    zombie.add(zModel);
  });

  let gustK = 0, gustDir = 0, time = 0;

  function updateTentacles(state) {
    const alive = new Set();
    for (const T of state.hazards.tentacles) {
      alive.add(T.id);
      const pts = T.path.map((p) => new THREE.Vector3(p.x, 0.12, p.z));
      const atCar = carDistance(state.cfg, T.tip) < 0.4;
      const tipY = T.state === 'smash' ? 1.2 + Math.sin(time * 14) * 0.25 : atCar ? 0.6 : 0.15; // reaching up to the light bar
      pts.push(new THREE.Vector3(T.tip.x, tipY, T.tip.z));
      if (pts.length < 2) continue;
      // wriggle the body so it never lies still
      for (let i = 1; i < pts.length - 1; i++) { pts[i].x += Math.sin(time * 3 + i * 0.9 + T.id) * 0.08; pts[i].z += Math.cos(time * 2.6 + i * 1.1) * 0.08; }
      let m = tentMeshes.get(T.id);
      if (m) m.geometry.dispose(); else { m = new THREE.Mesh(undefined, tentMat); m.castShadow = true; root.add(m); tentMeshes.set(T.id, m); }
      const curve = new THREE.CatmullRomCurve3(pts);
      m.geometry = new THREE.TubeGeometry(curve, Math.min(120, pts.length * 3), 0.09, 5, false);
    }
    for (const [id, m] of tentMeshes) if (!alive.has(id)) { root.remove(m); m.geometry.dispose(); tentMeshes.delete(id); }
  }

  return {
    update(state, dt) {
      time += dt;
      const hz = state.hazards;
      // fire
      const F = hz.fire;
      if (F) {
        const c = fireLightPos(state);
        fireLight.position.set(c.x, 1.4, c.z);
        const grow = F.phase === 'smolder' ? 0 : Math.min(1, 0.3 + F.burnT / 25); // it gets bigger the longer it burns
        fireLight.intensity = grow * 130 * (0.85 + Math.random() * 0.3);
        const lenBurning = grow * 1.8;
        for (const f of flames) {
          const lx = 2.1 - ((f.x + 2.1) % 4.2);
          const on = F.phase !== 'smolder' && 2.1 - lx < lenBurning;
          f.s.visible = on;
          if (!on) continue;
          const w = carToWorld(cfg, { x: lx, z: f.z });
          const k = 0.5 + 0.5 * Math.sin(time * 9 + f.seed * 7);
          f.s.position.set(w.x, cfg.car.top + 0.2 + k * 0.5, w.z);
          f.s.scale.setScalar((0.8 + k * 0.7) * (0.6 + grow * 0.6));
        }
        for (const s of smoke) {
          s.t += dt * 0.35; if (s.t > 1) s.t -= 1;
          s.m.visible = true;
          s.m.position.set(c.x + Math.sin(s.t * 9) * 0.3, cfg.car.top + 0.6 + s.t * 5, c.z + s.t * 1.2);
          s.m.scale.setScalar(0.6 + s.t * 2.2);
        }
      } else {
        fireLight.intensity = 0;
        for (const f of flames) f.s.visible = false;
        for (const s of smoke) s.m.visible = false;
      }

      // swarm
      const S = hz.swarm;
      swarm.visible = !!S;
      if (S) {
        const live = N;
        for (let i = 0; i < N; i++) {
          const [a, b, r] = swarmSeeds[i];
          const on = i < live;
          const rr = r * (S.on ? 0.7 : 1.2);
          sp[i * 3] = on ? S.pos.x + Math.sin(time * 5 * r + a) * rr : 0;
          sp[i * 3 + 1] = on ? 1.3 + Math.sin(time * 7 + b) * 0.6 : -99;
          sp[i * 3 + 2] = on ? S.pos.z + Math.cos(time * 4.3 * r + b) * rr : 0;
        }
        swarmGeo.attributes.position.needsUpdate = true;
      }

      updateTentacles(state);

      // zombie: a lurching shamble; stock-still while staggered; arms locked on you in a grab
      const Z = hz.zombie;
      zombie.visible = !!Z;
      if (Z) {
        zombie.position.set(Z.pos.x, 0, Z.pos.z);
        zombie.rotation.y = Z.yaw;
        const walking = Z.state === 'walk', w = time * 4.2;
        legL.rotation.x = walking ? Math.sin(w) * 0.35 : 0; legR.rotation.x = walking ? -Math.sin(w) * 0.35 : 0;
        zombie.rotation.z = walking ? Math.sin(w) * 0.08 : Z.state === 'stagger' ? -0.15 : 0;
        if (zModel) { zModel.position.y = walking ? Math.abs(Math.sin(w)) * 0.05 : 0; zModel.rotation.x = Z.state === 'grab' ? 0.25 : Z.state === 'stagger' ? -0.3 : 0.08; }
        armL.rotation.x = Z.state === 'grab' ? -1.55 : -1.3 + Math.sin(w * 0.5) * 0.1;
        armR.rotation.x = Z.state === 'grab' ? -1.55 : -1.2 + Math.cos(w * 0.5) * 0.1;
        head.rotation.z = 0.25 + Math.sin(time * 1.3) * 0.15;
      }

      // gust: no fog change — the snow triples and blows hard one way (see snow.js)
      const target = hz.gust && hz.gust.phase === 'blow' ? 1 : 0;
      gustK += (target - gustK) * Math.min(1, dt * 2.5);
      if (hz.gust) gustDir = hz.gust.dir;
      return { k: gustK, dir: gustDir };
    },
    reset() {
      for (const [, m] of tentMeshes) { root.remove(m); m.geometry.dispose(); }
      tentMeshes.clear();
      gustK = 0;
    },
  };
}
