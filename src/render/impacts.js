// Bullet impacts: a small burst of snow where a miss lands (and a scuff in the snow), a spray where it hits.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

export function createImpacts(scene, marks) {
  const snowTex = glowTexture([[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(235,240,250,0.4)'], [1, 'rgba(230,235,245,0)']]);
  const bloodTex = glowTexture([[0, 'rgba(120,6,10,0.95)'], [0.5, 'rgba(90,4,8,0.5)'], [1, 'rgba(80,0,0,0)']]);
  const pool = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: snowTex, transparent: true, depthWrite: false }));
    sp.visible = false;
    sp.userData = { t: 0, life: 0.35 };
    scene.add(sp);
    pool.push(sp);
  }
  let next = 0;
  function puff(x, y, z, blood) {
    for (let k = 0; k < 3; k++) {
      const sp = pool[next++ % pool.length];
      sp.material.map = blood ? bloodTex : snowTex;
      sp.position.set(x + (Math.random() - 0.5) * 0.3, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.3);
      sp.userData.t = 0;
      sp.userData.life = 0.3 + Math.random() * 0.2;
      sp.userData.vy = 1 + Math.random() * 1.5;
      sp.visible = true;
    }
  }
  return {
    onEvent(e) {
      if (e.type === 'bullet_impact') {
        if (e.hit == null) { puff(e.pos.x, 0.1, e.pos.z, false); marks.scuff(e.pos.x, e.pos.z); }
        else { puff(e.pos.x, 1.2, e.pos.z, true); marks.blood(e.pos.x, e.pos.z, 0.08, 7); }
      }
    },
    update(dt) {
      for (const sp of pool) {
        if (!sp.visible) continue;
        const u = sp.userData;
        u.t += dt;
        if (u.t >= u.life) { sp.visible = false; continue; }
        const k = u.t / u.life;
        sp.position.y += u.vy * dt;
        sp.scale.setScalar(0.3 + k * 0.9);
        sp.material.opacity = 1 - k;
      }
    },
  };
}
