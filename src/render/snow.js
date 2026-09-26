// Falling snow that follows the player.
import * as THREE from 'three';

export function buildSnow() {
  const N = 3500, W = 36, H = 14;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    p[i * 3] = (Math.random() - 0.5) * W;
    p[i * 3 + 1] = Math.random() * H;
    p[i * 3 + 2] = (Math.random() - 0.5) * W;
    speed[i] = 0.6 + Math.random() * 0.9;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }));
  points.frustumCulled = false;
  let time = 0;
  return {
    points,
    update(dt, c, gust = 0) {
      time += dt;
      const wind = (Math.sin(time * 0.3) * 0.6 + 0.4) * (1 - gust) + gust * 9; // a gust drives it sideways
      for (let i = 0; i < N; i++) {
        let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        y -= speed[i] * dt;
        x += wind * dt * speed[i];
        z += Math.sin(time + i) * 0.1 * dt;
        if (y < 0) y += H;
        if (x - c.x > W / 2) x -= W; else if (x - c.x < -W / 2) x += W;
        if (z - c.z > W / 2) z -= W; else if (z - c.z < -W / 2) z += W;
        p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
