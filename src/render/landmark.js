// The vehicle up on the embankment: a real (dark) car shape with its headlights on, aimed at the wreck.
// Its spotlight dimly lights the play area and casts long shadows; faint shafts of light hang in the snowy air;
// the engine's idling (exhaust). After the radio call it drives in (setDistance).
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { groundHeight } from './ground.js';

function buildTruck() {
  // local frame: +z points at the wreck, headlights at z = 0
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.55, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.15, metalness: 0.7 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.85, 4.8), paint);
  body.position.set(0, 0.78, -2.4);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 2.2), glass);
  cab.position.set(0, 1.55, -2.6);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 2.0), paint);
  roof.position.set(0, 1.95, -2.65);
  g.add(body, cab, roof);
  for (const [x, z] of [[0.92, -0.9], [-0.92, -0.9], [0.92, -3.9], [-0.92, -3.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
  }
  const lens = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 4 });
  for (const x of [-0.72, 0.72]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.04), lens);
    l.position.set(x, 0.8, 0.01);
    g.add(l);
  }
  const tail = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a10, emissiveIntensity: 1.6 });
  for (const x of [-0.8, 0.8]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.04), tail);
    l.position.set(x, 0.85, -4.81);
    g.add(l);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
  // light spilling back onto the bumper and the snow right in front, and the red glow behind (it lights the exhaust)
  const spill = new THREE.PointLight(0xfff0d8, 14, 9, 1.6);
  spill.position.set(0, 0.6, 2.2);
  const tailGlow = new THREE.PointLight(0xff2010, 3, 4, 1.8);
  tailGlow.position.set(0, 0.8, -5.3);
  g.add(spill, tailGlow);
  return g;
}

function shaftTexture() {
  // alpha along the shaft: strong at the lamp (top of the canvas = the cone's apex), gone by the far end
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.25, '#777');
  grad.addColorStop(0.7, '#1a1a1a');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

export function buildDistantHeadlights(cfg) {
  const bearing = cfg.arena.landmarkBearing;
  const root = new THREE.Group();
  root.rotation.y = bearing + Math.PI;
  const truck = buildTruck();
  root.add(truck);

  // glare on the lenses: depth-tested (the truck, the bank and the crowd can hide it), drawn after the snow marks
  const glare = new THREE.Group();
  root.add(glare);
  const core = glowTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,250,235,0.95)'], [0.4, 'rgba(255,240,210,0.25)'], [1, 'rgba(255,230,200,0)']]);
  const halo = glowTexture([[0, 'rgba(255,240,215,0.3)'], [0.5, 'rgba(255,230,200,0.06)'], [1, 'rgba(255,230,200,0)']]);
  const mat = (map, opacity) => new THREE.SpriteMaterial({ map, transparent: true, opacity, depthWrite: false, depthTest: true, fog: false, blending: THREE.AdditiveBlending });
  for (const side of [-0.72, 0.72]) {
    const c = new THREE.Sprite(mat(core, 1));
    c.scale.set(1.6, 1.6, 1);
    c.position.set(side, 0.8, 0.25);
    const h = new THREE.Sprite(mat(halo, 0.8));
    h.scale.set(7, 7, 1);
    h.position.set(side, 0.8, 0.3);
    c.renderOrder = h.renderOrder = 3;
    glare.add(c, h);
  }

  // shafts of light through the falling snow: one faint additive cone per headlight
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xcfd8ff, alphaMap: shaftTexture(), transparent: true, opacity: 0.14, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
  });
  const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
  coneGeo.rotateX(-Math.PI / 2);   // apex (+y) → -z …
  coneGeo.translate(0, 0, 0.5);    // … then apex at z = 0, opening toward +z (the wreck)
  const shafts = [-0.72, 0.72].map((x) => {
    const m = new THREE.Mesh(coneGeo, shaftMat);
    m.position.set(x, 0.8, 0.05);
    m.renderOrder = 2;
    root.add(m);
    return m;
  });

  // the light itself: one wide, dim beam over the whole play area, with shadows
  const beam = new THREE.SpotLight(0xdfe6ff, 2.6, 0, THREE.MathUtils.degToRad(19), 0.55, 0);
  beam.castShadow = true;
  beam.shadow.mapSize.set(2048, 2048);
  beam.shadow.camera.near = 2;
  beam.shadow.camera.far = 90;
  beam.shadow.bias = -0.0004;
  beam.shadow.normalBias = 0.03;
  beam.target.position.set(0, 0, 0);

  const tailpipe = new THREE.Vector3(0.55, 0.3, -4.9);
  const back = new THREE.Vector3(0, 0, -1);

  return {
    group: root,
    lights: [beam, beam.target],
    // world position + outward direction of the tailpipe (for exhaust)
    tailpipe(outPos, outDir) {
      root.updateMatrixWorld();
      outPos.copy(tailpipe).applyMatrix4(root.matrixWorld);
      outDir.copy(back).transformDirection(root.matrixWorld);
    },
    setDistance(d) {
      const x = Math.sin(bearing) * d, z = Math.cos(bearing) * d;
      const y = groundHeight(x, z);
      root.position.set(x, y, z);
      glare.scale.setScalar(Math.max(0.6, Math.min(1, d / 50)));
      beam.position.set(x, y + 0.8, z);
      const angle = Math.min(1.2, Math.atan2(cfg.arena.darkRadius + 4, d));
      beam.angle = angle;
      beam.intensity = 2.6 * Math.min(2.2, (50 / d) ** 0.8);
      // shafts reach the wreck and tilt down toward it
      const len = Math.hypot(d, y + 0.8);
      const r = len * Math.tan(angle) * 0.5;
      for (const s of shafts) {
        s.scale.set(r, r, len);
        s.rotation.x = Math.atan2(y + 0.8, d);
      }
    },
  };
}
