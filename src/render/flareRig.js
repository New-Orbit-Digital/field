// Flares: the short drop from your hand, the burning glow, and a small fixed pool of lights
// (preallocated so the light count never changes — no shader recompiles mid-game). Each lights a circle the
// size of cfg.flares.radius; the first one casts shadows.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

const MAX_FLARE_LIGHTS = 3;

export function createFlareRig(scene, cfg) {
  const lights = [];
  for (let i = 0; i < MAX_FLARE_LIGHTS; i++) {
    const l = new THREE.PointLight(0xff5a2a, 0, cfg.flares.radius * 1.9, 1.1);
    if (i === 0) {
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      l.shadow.camera.near = 0.1;
      l.shadow.bias = -0.002;
    }
    scene.add(l);
    lights.push(l);
  }
  const tex = glowTexture([[0, 'rgba(255,230,200,1)'], [0.2, 'rgba(255,120,60,0.8)'], [0.6, 'rgba(255,60,20,0.15)'], [1, 'rgba(255,40,0,0)']]);
  const meshes = [];
  function mesh(i) {
    if (!meshes[i]) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0x551000 }));
      stick.rotation.z = 1.2; stick.position.y = 0.06;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.6, 1.6, 1); glow.position.y = 0.15;
      g.add(stick, glow);
      g.userData.glow = glow;
      scene.add(g);
      meshes[i] = g;
    }
    return meshes[i];
  }

  return {
    update(state, dt) {
      const t = state.t;
      const burning = state.flares.filter((fl) => fl.state === 'burning');
      for (let i = 0; i < MAX_FLARE_LIGHTS; i++) {
        const fl = burning[i];
        const l = lights[i];
        if (fl) {
          const g = cfg.flares.gutterTime;
          const k = fl.t > fl.burn - g ? Math.max(0, (fl.burn - fl.t) / g) : 1; // gutters out (the sim shrinks its circle to match)
          l.position.set(fl.pos.x, 0.45, fl.pos.z);
          l.intensity = (105 + Math.sin(t * 31 + i) * 14 + Math.random() * 22) * k;
        } else l.intensity = 0;
      }
      let fi = 0;
      for (const fl of state.flares) {
        const g = mesh(fi++);
        g.visible = true;
        if (fl.state === 'flying') {
          const k = Math.min(1, fl.t / cfg.flares.flightTime);
          g.position.set(fl.from.x + (fl.pos.x - fl.from.x) * k, 1.0 * (1 - k * k), fl.from.z + (fl.pos.z - fl.from.z) * k);
          g.rotation.y += dt * 6;
        } else {
          g.position.set(fl.pos.x, 0, fl.pos.z);
        }
        g.userData.glow.scale.setScalar(1.4 + Math.random() * 0.6);
      }
      for (; fi < meshes.length; fi++) meshes[fi].visible = false;
    },
  };
}
