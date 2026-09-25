// Soft vapour puffs: tailpipe exhaust and your breath in the cold. Camera-facing quads, pale grey and
// see-through (a lit material read as dark smudges whenever the light was behind the vapour, which is backwards).
import * as THREE from 'three';

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One pool shared by every emitter.
export function createPuffs(scene, max = 160) {
  const tex = puffTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const pool = [];
  for (let i = 0; i < max; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0xa7afba, fog: true }));
    m.visible = false;
    m.renderOrder = 2;
    m.userData = { t: 0, life: 1, v: new THREE.Vector3(), size0: 0.1, size1: 0.5, alpha: 0.3 };
    scene.add(m);
    pool.push(m);
  }
  let next = 0;

  function spawn(pos, vel, { life = 3, size0 = 0.12, size1 = 0.7, alpha = 0.28 } = {}) {
    const m = pool[next++ % pool.length];
    const u = m.userData;
    m.position.copy(pos);
    u.v.copy(vel);
    u.t = 0; u.life = life; u.size0 = size0; u.size1 = size1; u.alpha = alpha;
    m.visible = true;
  }

  return {
    spawn,
    update(dt, camera, wind = 0.25) {
      for (const m of pool) {
        if (!m.visible) continue;
        const u = m.userData;
        u.t += dt;
        if (u.t >= u.life) { m.visible = false; continue; }
        const k = u.t / u.life;
        u.v.multiplyScalar(Math.exp(-dt * 0.9)); // drag
        m.position.addScaledVector(u.v, dt);
        m.position.x += wind * dt * k;           // drifts downwind as it ages
        m.position.y += 0.12 * dt;               // warm air rises a little
        m.scale.setScalar(u.size0 + (u.size1 - u.size0) * Math.sqrt(k));
        m.material.opacity = u.alpha * Math.min(1, k * 6) * (1 - k); // quick puff out, slow fade
        m.quaternion.copy(camera.quaternion);
      }
    },
  };
}

// A steady source (a tailpipe): a slow trickle of puffs pushed out along `dir`.
export function createExhaust(puffs, { rate = 3.5, speed = 0.5, life = 3.6, size1 = 0.9, alpha = 0.22 } = {}) {
  let acc = Math.random();
  const p = new THREE.Vector3(), v = new THREE.Vector3();
  return {
    update(dt, pos, dir) {
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        p.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05));
        v.copy(dir).multiplyScalar(speed * (0.7 + Math.random() * 0.6));
        v.y += 0.08 + Math.random() * 0.1;
        puffs.spawn(p, v, { life: life * (0.8 + Math.random() * 0.4), size0: 0.08, size1, alpha });
      }
    },
  };
}
