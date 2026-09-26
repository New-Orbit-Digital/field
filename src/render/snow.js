// Falling snow that follows the player. In a whiteout (gust k 0→1) it gets heavy and violent: the field
// snow triples, and a dense layer of big flakes fills the air right around you, all of it driven hard along
// the gust's direction in surges. That close layer is what takes the visibility away (no fog change).
import * as THREE from 'three';

function layer(n, w, h, size, opacity) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (Math.random() - 0.5) * w; p[i * 3 + 1] = Math.random() * h; p[i * 3 + 2] = (Math.random() - 0.5) * w;
    speed[i] = 0.6 + Math.random() * 0.9;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size, transparent: true, opacity, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { geo, p, speed, points, mat, n, w, h, baseSize: size, baseOpacity: opacity };
}

export function buildSnow() {
  const BASE = 3500;
  const field = layer(BASE * 3, 36, 14, 0.06, 0.85); // the snow everywhere (only BASE drawn when calm)
  const close = layer(16000, 12, 6, 0.06, 0.8);       // the whiteout wall, only while a gust blows
  field.geo.setDrawRange(0, BASE);
  close.points.visible = false;
  const points = new THREE.Group();
  points.add(field.points, close.points);
  points.material = field.mat; // world.js resizes the field flakes for the low-res pass through this
  let time = 0;

  function drift(L, count, dt, c, wx, wz, k, fall) {
    const { p, speed, w, h } = L;
    for (let i = 0; i < count; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      y -= speed[i] * dt * fall;
      x += (wx * speed[i] + k * Math.sin(time * 5 + i * 0.37) * 3) * dt;
      z += (wz * speed[i] + Math.sin(time + i) * 0.1 + k * Math.cos(time * 4.3 + i * 0.29) * 3) * dt;
      y += k * Math.sin(time * 4 + i) * 1.5 * dt; // swirling
      if (y < 0) y += h; else if (y > h) y -= h;
      if (x - c.x > w / 2) x -= w; else if (x - c.x < -w / 2) x += w;
      if (z - c.z > w / 2) z -= w; else if (z - c.z < -w / 2) z += w;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    L.geo.attributes.position.needsUpdate = true;
  }

  return {
    points,
    update(dt, c, gust = { k: 0, dir: 0 }) {
      time += dt;
      const k = gust.k || 0;
      const surge = 0.75 + 0.35 * Math.sin(time * 2.3) + 0.2 * Math.sin(time * 7.1); // it comes in surges
      const gw = 18 * surge;
      const wx = (Math.sin(time * 0.3) * 0.6 + 0.4) * (1 - k) + Math.sin(gust.dir) * gw * k;
      const wz = Math.cos(gust.dir) * gw * k;
      const count = Math.round(BASE * (1 + 2 * k));
      field.geo.setDrawRange(0, count);
      drift(field, count, dt, c, wx, wz, k, 1 + k * 0.5);
      close.points.visible = k > 0.02;
      if (close.points.visible) {
        close.geo.setDrawRange(0, Math.round(close.n * k));
        close.mat.size = field.mat.size * (close.baseSize / field.baseSize); // keep the same low-res scaling
        close.mat.opacity = close.baseOpacity * (0.6 + 0.4 * surge) * k;
        drift(close, Math.round(close.n * k), dt, { x: c.x, z: c.z }, wx * 1.2, wz * 1.2, k, 1.5);
      }
    },
  };
}
