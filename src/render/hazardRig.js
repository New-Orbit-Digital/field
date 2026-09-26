// Hazards (packet 05) on screen: fire on the wreck, the swarm, tentacles, the statue, the crawler's tell,
// and the gust's whiteout. Reads sim state only. Lights are preallocated (one for the fire) so the light
// count never changes mid-night.
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { carToWorld, fireLightPos, tipHeight } from '../sim/game.js';

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

  // ---------- statue ----------
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.95 });
  const statue = new THREE.Group();
  const box = (w, h, d, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; statue.add(m); return m; };
  box(0.34, 1.0, 0.22, 0, 1.55, 0);            // torso, too long
  box(0.26, 0.34, 0.26, 0, 2.28, 0.05, 0.35);  // head, bowed
  box(0.1, 1.15, 0.1, -0.26, 1.35, 0.1, -0.25, 0.08); box(0.1, 1.15, 0.1, 0.26, 1.35, 0.1, -0.25, -0.08); // arms reaching
  box(0.13, 1.1, 0.13, -0.1, 0.55, 0); box(0.13, 1.1, 0.13, 0.1, 0.55, 0); // legs
  statue.visible = false; root.add(statue);

  // ---------- crawler ----------
  const pale = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.8 });
  const crawler = new THREE.Group();
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), pale); f.position.set(-0.09 + i * 0.06, 0.03, 0.2); crawler.add(f); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.6), pale); arm.position.z = -0.1; crawler.add(arm);
  crawler.visible = false; root.add(crawler);
  const snowPuff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.6, depthWrite: false }));
  snowPuff.visible = false; root.add(snowPuff);

  let fogBase = null, gustK = 0, time = 0;

  function updateTentacles(state) {
    const alive = new Set();
    for (const T of state.hazards.tentacles) {
      alive.add(T.id);
      const pts = T.path.map((p) => new THREE.Vector3(p.x, 0.12, p.z));
      pts.push(new THREE.Vector3(T.tip.x, tipHeight(state, T.tip) + (T.state === 'grab' ? 0.9 : 0.15), T.tip.z));
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
    update(state, dt, fog) {
      time += dt;
      const hz = state.hazards;
      // fire
      const F = hz.fire;
      if (F) {
        const c = fireLightPos(state);
        fireLight.position.set(c.x, 1.4, c.z);
        fireLight.intensity = (40 + F.stage * 30) * (0.85 + Math.random() * 0.3);
        const lenBurning = F.stage * 1.6;
        for (const f of flames) {
          const lx = 2.1 - ((f.x + 2.1) % 4.2);
          const on = 2.1 - lx < lenBurning + 0.4;
          f.s.visible = on;
          if (!on) continue;
          const w = carToWorld(cfg, { x: lx, z: f.z });
          const k = 0.5 + 0.5 * Math.sin(time * 9 + f.seed * 7);
          f.s.position.set(w.x, cfg.car.top + 0.2 + k * 0.5, w.z);
          f.s.scale.setScalar(0.8 + k * 0.7);
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
        const live = Math.ceil(N * S.count / cfg.hazards.swarm.size);
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

      // statue
      const St = hz.statue;
      statue.visible = !!St;
      if (St) { statue.position.set(St.pos.x, 0, St.pos.z); statue.rotation.y = St.yaw; }

      // crawler: fingers and a snow puff at the hull during the tell, the arm out in the lunge
      const C = hz.crawler;
      const telling = C && C.state === 'tell';
      const grabbing = C && C.holdT > 0;
      crawler.visible = !!(telling || grabbing);
      snowPuff.visible = !!telling;
      if (crawler.visible) {
        crawler.position.set(C.pos.x, 0, C.pos.z);
        crawler.lookAt(state.player.pos.x, 0, state.player.pos.z);
        const out = grabbing ? 0.8 : 0.1 + 0.15 * Math.sin(time * 18);
        crawler.children.forEach((m) => { m.position.z = (m === arm ? -0.1 : 0.2) + out; });
        snowPuff.position.set(C.pos.x, 0.05 + Math.random() * 0.05, C.pos.z);
        snowPuff.scale.setScalar(0.8 + Math.random() * 0.5);
      }

      // gust: the whiteout thickens the fog and paints it pale while it blows
      if (fog) {
        if (fogBase === null) fogBase = { d: fog.density, c: fog.color.clone() };
        const target = hz.gust && hz.gust.phase === 'blow' ? 1 : 0;
        gustK += (target - gustK) * Math.min(1, dt * 2.5);
        fog.density = fogBase.d * (1 + gustK * 3.5);
        fog.color.copy(fogBase.c).lerp(new THREE.Color(0x2a2e34), gustK);
      }
      return gustK;
    },
    reset() {
      for (const [, m] of tentMeshes) { root.remove(m); m.geometry.dispose(); }
      tentMeshes.clear();
      gustK = 0;
    },
  };
}
