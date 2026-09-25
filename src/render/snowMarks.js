// Marks in the snow around the wreck, painted onto one canvas laid over the terrain:
//   - the tracks: tyre lines coming in, the sideways skid, the gouges where it flipped, the roof-drag trough
//   - blood trails from wounded monsters, and footprints (yours and theirs), added live
import * as THREE from 'three';
import { groundHeight } from './ground.js';

const SIZE = 64;      // metres covered, centred on the wreck
const RES = 2048;     // canvas pixels (32 px per metre)
const S = RES / SIZE;

export function createSnowMarks(cfg) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RES;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // overlay mesh that follows the terrain, a hair above it
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)) + 0.015);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;

  paintTracks(g, cfg);
  tex.needsUpdate = true;

  let dirty = false, since = 0;
  return {
    mesh,
    // a drop (or a splash) of blood at a world point
    blood(x, z, size = 0.09, count = 1) {
      if (Math.abs(x) > SIZE / 2 - 1 || Math.abs(z) > SIZE / 2 - 1) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < count; i++) {
        const ox = count > 1 ? (Math.random() - 0.5) * size * 8 : (Math.random() - 0.5) * 0.12;
        const oz = count > 1 ? (Math.random() - 0.5) * size * 8 : (Math.random() - 0.5) * 0.12;
        const r = size * (0.5 + Math.random()) * S;
        g.fillStyle = `rgba(${70 + Math.random() * 40 | 0},4,8,${0.75 + Math.random() * 0.2})`;
        g.beginPath();
        g.ellipse((x + ox + SIZE / 2) * S, (z + oz + SIZE / 2) * S, r, r * (0.6 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
      dirty = true;
    },
    // one print pressed into the snow: kind 'boot' (you) or 'paw' (them), facing `yaw`
    print(x, z, yaw, kind) {
      if (Math.abs(x) > SIZE / 2 - 1 || Math.abs(z) > SIZE / 2 - 1) return;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      // local frame: +y along the direction of travel (world: forward = (sin yaw, cos yaw))
      g.setTransform(S * c, -S * s, S * s, S * c, (x + SIZE / 2) * S, (z + SIZE / 2) * S);
      if (kind === 'boot') {
        g.fillStyle = 'rgba(78,90,110,0.42)';
        g.beginPath(); g.ellipse(0, 0.05, 0.055, 0.1, 0, 0, Math.PI * 2); g.fill();          // sole
        g.beginPath(); g.ellipse(0, -0.11, 0.045, 0.05, 0, 0, Math.PI * 2); g.fill();        // heel
      } else {
        g.fillStyle = 'rgba(70,80,100,0.38)';
        g.beginPath(); g.ellipse(0, 0, 0.045, 0.065, 0, 0, Math.PI * 2); g.fill();           // pad
        g.fillStyle = 'rgba(55,64,84,0.45)';
        for (const dx of [-0.035, 0, 0.035]) { g.beginPath(); g.ellipse(dx, 0.085, 0.012, 0.03, 0, 0, Math.PI * 2); g.fill(); } // long claws
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      dirty = true;
    },
    // a scuff where a bullet hit the snow
    scuff(x, z) {
      if (Math.abs(x) > SIZE / 2 - 1 || Math.abs(z) > SIZE / 2 - 1) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(120,130,145,0.5)';
      g.beginPath(); g.arc((x + SIZE / 2) * S, (z + SIZE / 2) * S, 0.12 * S, 0, Math.PI * 2); g.fill();
      dirty = true;
    },
    reset() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, RES, RES);
      paintTracks(g, cfg);
      tex.needsUpdate = true;
    },
    update(dt) {
      since += dt;
      if (dirty && since > 0.35) { tex.needsUpdate = true; dirty = false; since = 0; } // big texture: re-upload a few times a second at most
    },
  };
}

// Deterministic little RNG so the tracks look the same every night.
function rand(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function paintTracks(g, cfg) {
  const c = Math.cos(cfg.car.yaw), s = Math.sin(cfg.car.yaw);
  // canvas transform in the wreck's local frame (x along its length, front = +x)
  g.setTransform(S * c, -S * s, S * s, S * c, (SIZE / 2) * S, (SIZE / 2) * S);
  const R = rand(4242);
  const groove = (w, a) => { g.lineWidth = w; g.strokeStyle = `rgba(62,72,90,${a})`; };
  const hw = cfg.car.halfWidth - 0.1;

  // 1) driving in: two tyre lines on a gentle curve, from far out
  const path = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    path.push({ x: -34 + t * 16, z: 7 - t * 4 - Math.sin(t * 2.2) * 1.2 });
  }
  for (const side of [-1, 1]) {
    groove(0.24, 0.7);
    g.beginPath();
    path.forEach((p, i) => (i ? g.lineTo(p.x, p.z + side * hw) : g.moveTo(p.x, p.z + side * hw)));
    g.stroke();
  }

  // 2) the skid: the car yaws sideways, four tyres smear wide arcs
  const sk0 = path[path.length - 1];
  for (const [ox, oz] of [[1.45, hw], [1.45, -hw], [-1.45, hw], [-1.45, -hw]]) {
    groove(0.3, 0.55);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, yaw = t * 1.1;
      const cx = sk0.x + t * 8.5, cz = sk0.z - t * 2.4;
      const x = cx + ox * Math.cos(yaw) - oz * Math.sin(yaw), z = cz + ox * Math.sin(yaw) + oz * Math.cos(yaw);
      i ? g.lineTo(x, z) : g.moveTo(x, z);
    }
    g.stroke();
  }

  // 3) the flip: gouged, churned snow and thrown clumps
  for (let i = 0; i < 26; i++) {
    const x = -10 + R() * 5.5, z = -0.8 + (R() - 0.5) * 3.2;
    g.fillStyle = `rgba(80,92,110,${0.25 + R() * 0.3})`;
    g.beginPath(); g.ellipse(x, z, 0.3 + R() * 0.9, 0.15 + R() * 0.4, R() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = -11 + R() * 9, z = (R() - 0.5) * 6;
    g.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.4})`;
    g.beginPath(); g.ellipse(x, z, 0.08 + R() * 0.2, 0.06 + R() * 0.14, R() * 3, 0, Math.PI * 2); g.fill();
  }
  // a deep dent where the roof first hit
  g.fillStyle = 'rgba(70,82,100,0.5)';
  g.beginPath(); g.ellipse(-6.8, -0.3, 1.2, 0.8, 0.2, 0, Math.PI * 2); g.fill();

  // 4) dragged on its roof: a smooth trough the width of the car, with pushed-up berms, into where it lies
  const x0 = -6.5, x1 = -cfg.car.halfLength + 0.3;
  const grad = g.createLinearGradient(0, -hw - 0.4, 0, hw + 0.4);
  grad.addColorStop(0, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.12, 'rgba(110,122,140,0.38)');
  grad.addColorStop(0.5, 'rgba(125,136,152,0.3)');
  grad.addColorStop(0.88, 'rgba(110,122,140,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0.45)');
  g.fillStyle = grad;
  g.fillRect(x0, -hw - 0.4, x1 - x0, 2 * hw + 0.8);
  // scrape lines from the light bar and roof rails
  for (const z of [-0.55, -0.2, 0.25, 0.6]) {
    groove(0.05, 0.45);
    g.beginPath(); g.moveTo(x0 + R() * 0.8, z + (R() - 0.5) * 0.1); g.lineTo(x1, z); g.stroke();
  }
  // snow piled up at the front edge where it stopped
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.ellipse(cfg.car.halfLength + 0.35, 0, 0.45, hw + 0.5, 0, 0, Math.PI * 2); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
}
