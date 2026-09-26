// The overturned police car, modelled upright and then flipped onto its roof.
// Upright frame: front at -x, y up (wheels at the bottom). The flip (rotation.z = π) puts the front at +x and the
// roof on the snow, which is the car-local frame the sim uses (x along the length, front +x, z across, y up).
// Heights: the flipped chassis you stand on is at cfg.car.top (1.62); the crushed roof rests on the snow.
import * as THREE from 'three';

const H = 1.94; // upright height from tyre bottom to roof skin = the flipped car's height to the chassis + clearance

function mat(color, rough = 0.5, metal = 0.3, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#e9ecef'; g.fillRect(0, 0, 512, 160);
  g.fillStyle = '#10131a';
  g.font = 'bold 74px Arial, Helvetica, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('POLICE', 256, 70);
  g.fillRect(0, 136, 512, 10);            // pinstripe
  g.fillStyle = 'rgba(40,40,40,0.25)';    // grime and scuffs
  for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 512, 100 + Math.random() * 60, 4 + Math.random() * 30, 1 + Math.random() * 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,26,34,0.9)'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(200,215,230,0.55)'; g.lineWidth = 1.2;
  for (const [cx, cy] of [[90, 120], [180, 70]]) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy);
      let x = cx, y = cy;
      for (let k = 0; k < 5; k++) { x += Math.cos(a + (Math.random() - 0.5) * 0.6) * 18; y += Math.sin(a + (Math.random() - 0.5) * 0.6) * 18; g.lineTo(x, y); }
      g.stroke();
    }
    for (let r = 10; r < 60; r += 14) { g.beginPath(); g.arc(cx, cy, r + Math.random() * 6, 0, Math.PI * 2); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// side profile of the lower body with wheel arches, extruded across the width
function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(2.35, 0.42);
  s.lineTo(2.35, 0.98);
  s.quadraticCurveTo(2.33, 1.08, 2.18, 1.1);   // rear deck edge
  s.lineTo(1.3, 1.12);
  s.lineTo(-1.25, 1.12);
  s.lineTo(-2.12, 1.02);                         // hood slopes down to the nose
  s.quadraticCurveTo(-2.35, 1.0, -2.36, 0.86);
  s.lineTo(-2.36, 0.44);
  s.lineTo(-1.98, 0.38);
  s.absarc(-1.45, 0.38, 0.5, 0, Math.PI, false); // front arch (traced over the top)
  s.lineTo(0.95, 0.38);
  s.absarc(1.45, 0.38, 0.5, Math.PI, 0, true);
  s.lineTo(2.35, 0.42);
  return s;
}

function greenhouseShape() {
  const s = new THREE.Shape();
  s.moveTo(1.28, 1.1);
  s.lineTo(0.95, 1.8);    // rear window
  s.lineTo(-0.45, 1.84);  // roof
  s.lineTo(-1.2, 1.1);    // windshield
  s.lineTo(1.28, 1.1);
  return s;
}

export function buildCopCar(cfg) {
  const outer = new THREE.Group();      // sim car-local frame (flipped world)
  const car = new THREE.Group();        // upright model
  car.rotation.z = Math.PI;
  car.position.y = H;
  outer.add(car);

  const black = mat(0x0c0e12, 0.35, 0.6);
  const white = mat(0xe6e9ed, 0.4, 0.3);
  const trim = mat(0x1a1c20, 0.7, 0.2);
  const chrome = mat(0x9aa3ad, 0.25, 0.9);
  const rubber = mat(0x111111, 0.95, 0);
  const under = mat(0x2a2522, 0.9, 0.4);   // rusty, salted underside
  const glass = mat(0x0b1016, 0.08, 0.9);
  const W = cfg.car.halfWidth * 2;

  // body + greenhouse
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape(), { depth: W - 0.08, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 10 }), black);
  body.position.z = -(W - 0.08) / 2;
  const gh = new THREE.Mesh(new THREE.ExtrudeGeometry(greenhouseShape(), { depth: W - 0.34, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }), glass);
  gh.position.z = -(W - 0.34) / 2;
  // the roof took the fall: pushed down and over to one side
  gh.scale.y = 0.93; gh.position.y = 0.08; gh.rotation.x = 0.03;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, W - 0.3), black);
  roof.position.set(0.25, 1.81, 0.02); roof.rotation.z = -0.02; roof.rotation.x = 0.03;
  car.add(body, gh, roof);
  // pillars (A, B, C) so the glass reads as windows
  for (const [x, lean] of [[-0.83, 0.82], [0.2, 0], [1.12, -0.45]]) {
    for (const zs of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.78, 0.06), black);
      p.position.set(x, 1.45, zs * (W / 2 - 0.16)); p.rotation.z = lean;
      car.add(p);
    }
  }
  // shattered windshield
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.05, W - 0.4), new THREE.MeshStandardMaterial({ map: crackTexture(), transparent: true, opacity: 0.95, roughness: 0.2, metalness: 0.6 }));
  ws.position.set(-0.83, 1.46, 0); ws.rotation.set(-Math.PI / 2, 0, 0); ws.rotateY(-0.83);
  car.add(ws);

  // doors: white with POLICE, both sides (reads upside down now — it's on its roof)
  const dt = doorTexture();
  for (const zs of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.5), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.4, metalness: 0.2 }));
    door.position.set(0.05, 0.8, zs * (W / 2 + 0.005));
    if (zs < 0) door.rotation.y = Math.PI;
    car.add(door);
    // door seams and handles
    for (const x of [-0.95, 0.1, 1.05]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.66, 0.01), trim);
      seam.position.set(x, 0.78, zs * (W / 2 + 0.008)); car.add(seam);
    }
    for (const x of [-0.25, 0.8]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), chrome);
      h.position.set(x, 0.98, zs * (W / 2 + 0.02)); car.add(h);
    }
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.2), black);
    mirror.position.set(-1.1, 1.14, zs * (W / 2 + 0.1)); mirror.rotation.y = zs * 0.2; car.add(mirror);
  }

  // nose: grille, push bar, bumper, headlights; tail: bumper, taillights, trunk seam
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.9), trim);
  grille.position.set(-2.37, 0.78, 0); car.add(grille);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, W - 0.02), trim);
  bumperF.position.set(-2.38, 0.5, 0); car.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.x = 2.37; car.add(bumperR);
  for (const zs of [-0.42, 0.42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), black);
    post.position.set(-2.58, 0.72, zs); car.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), black);
  bar.rotation.x = Math.PI / 2; bar.position.set(-2.58, 1.0, 0); car.add(bar);
  const bar2 = bar.clone(); bar2.position.y = 0.55; car.add(bar2);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xfff2d8, emissiveIntensity: 0.15, roughness: 0.2 });
  for (const zs of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.34), headMat);
    hl.position.set(-2.37, 0.9, zs * 0.62); car.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0505, emissive: 0xff1508, emissiveIntensity: 0.35, roughness: 0.3 });
  for (const zs of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.3), tailMat);
    tl.position.set(2.36, 0.92, zs * 0.66); car.add(tl);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.32), white);
  plate.position.set(2.37, 0.66, 0); car.add(plate);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 4), black);
  antenna.position.set(1.9, 1.35, -0.5); antenna.rotation.z = 1.1; car.add(antenna);

  // hazard lamps: amber, at the front corners (these blink) and small repeaters at the rear
  const hazards = [];
  for (const [x, zs] of [[-2.36, -1], [-2.36, 1], [2.36, -1], [2.36, 1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, x < 0 ? 0.1 : 0.08, x < 0 ? 0.16 : 0.12), new THREE.MeshStandardMaterial({ color: 0x302000, emissive: 0xff9010, emissiveIntensity: 0.1 }));
    m.position.set(x, x < 0 ? 0.9 : 0.78, zs * (x < 0 ? 0.86 : 0.84));
    car.add(m);
    hazards.push(m);
  }

  // wheels (on top now), one knocked crooked
  for (const [x, zs, bent] of [[1.45, 1, 0], [-1.45, 1, 0.18], [1.45, -1, 0], [-1.45, -1, 0]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20), rubber);
    tyre.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 12), chrome);
    rim.rotation.x = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.29, 8), trim);
    hub.rotation.x = Math.PI / 2;
    w.add(tyre, rim, hub);
    w.position.set(x, 0.38, zs * 0.84);
    w.rotation.y = bent; w.rotation.x = bent * 0.6;
    car.add(w);
  }
  // underside (the part you stand on): frame rails, crossmembers, axles, tank, driveshaft, exhaust
  for (const zs of [-0.52, 0.52]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.12), under);
    rail.position.set(0, 0.34, zs); car.add(rail);
  }
  for (const x of [-1.9, -0.6, 0.6, 1.9]) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.1), under);
    cm.position.set(x, 0.35, 0); car.add(cm);
  }
  for (const x of [-1.45, 1.45]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), under);
    axle.rotation.x = Math.PI / 2; axle.position.set(x, 0.38, 0); car.add(axle);
  }
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.9), under);
  tank.position.set(0.95, 0.4, -0.05); car.add(tank);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.5, 8), under);
  shaft.rotation.z = Math.PI / 2; shaft.position.set(0.05, 0.36, 0); car.add(shaft);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.9, 8), under);
  pipe.rotation.z = Math.PI / 2; pipe.position.set(0.45, 0.36, 0.45); car.add(pipe);
  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), under);
  muffler.rotation.z = Math.PI / 2; muffler.position.set(1.8, 0.37, 0.45); car.add(muffler);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10, 1, true), chrome);
  tip.rotation.z = Math.PI / 2; tip.position.set(2.42, 0.36, 0.45); car.add(tip);

  // light bar, crushed between the roof and the snow; red and blue lenses face out of both sides
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 1.36), trim);
  lb.position.set(0.1, 1.9, 0); lb.rotation.x = 0.04; car.add(lb);
  const bars = [];
  for (const zs of [1, -1]) {
    for (const red of [true, false]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.14), new THREE.MeshStandardMaterial({
        color: red ? 0x400000 : 0x000840, emissive: red ? 0xff1010 : 0x2050ff, emissiveIntensity: 1, transparent: true, opacity: 0.95,
      }));
      // after the flip, car-local z keeps its sign and x flips, so put red toward the front on each side
      m.position.set((red ? -0.25 : 0.25) * zs + 0.1, 1.92, zs * 0.64);
      m.userData = { red, side: zs };
      car.add(m);
      bars.push(m);
    }
  }
  outer.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  ws.castShadow = false;
  return { group: outer, bars, hazards };
}

// Glass from a smashed light bar, scattered on the snow on that side (car-local, flipped frame).
export function buildShards(side) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xb8c6d8, roughness: 0.1, metalness: 0.8, emissive: 0x111822 });
  const red = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, roughness: 0.2, metalness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0a1a6a, roughness: 0.2, metalness: 0.5 });
  for (let i = 0; i < 26; i++) {
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.02 + Math.random() * 0.05, 3), [m, red, blue][i % 3]);
    tri.rotation.x = -Math.PI / 2; tri.rotation.z = Math.random() * 6;
    tri.position.set((Math.random() - 0.5) * 1.2, 0.02, side * (1.0 + Math.random() * 0.9));
    g.add(tri);
  }
  g.visible = false;
  return g;
}
