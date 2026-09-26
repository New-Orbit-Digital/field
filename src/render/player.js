// The player: a civilian in a winter parka, jeans and a beanie (you pulled over up on the bank when you saw
// the lights). Jointed so it can walk, aim, reload and work on the car. Feet at y = 0, about 1.75 m tall.
import * as THREE from 'three';

const M = (color, rough = 0.85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function limb(r0, r1, len, mat) {
  // a tapered segment hanging down from its joint
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), mat);
  m.position.y = -len / 2;
  return m;
}

export function buildPlayer() {
  const parka = M(0x3d4a36);       // olive parka
  const parkaDark = M(0x2c3628);
  const jeans = M(0x2b3a52);
  const boots = M(0x3a2a1e, 0.9);
  const skin = M(0xc49a7c, 0.7);
  const beanie = M(0x8c1f22, 0.95); // red knit beanie — findable in the dark
  const scarf = M(0x6b6258, 0.95);
  const gunMat = M(0x16171a, 0.4, 0.7);
  const torchMat = M(0x2a2a2a, 0.5, 0.6);

  const group = new THREE.Group();
  const body = new THREE.Group();          // everything above the hips moves with this
  body.position.y = 0.98;
  group.add(body);

  // hips + legs
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), jeans);
  hips.position.y = 0.0;
  body.add(hips);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.04, 0);
    const thigh = limb(0.075, 0.06, 0.45, jeans);
    const knee = new THREE.Group(); knee.position.y = -0.45;
    const shin = limb(0.058, 0.05, 0.43, jeans);
    const ankle = new THREE.Group(); ankle.position.y = -0.43;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.26), boots);
    boot.position.set(0, -0.04, 0.05);
    ankle.add(boot); knee.add(shin, ankle); hip.add(thigh, knee);
    body.add(hip);
    legs.push({ hip, knee, side });
  }

  // torso: puffy parka with a hood bunched at the neck
  const torso = new THREE.Group();
  torso.position.y = 0.06;
  body.add(torso);
  const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 6, 12), parka);
  coat.scale.set(1.12, 1, 0.82); coat.position.y = 0.26;
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 12), parkaDark);
  hem.scale.z = 0.82; hem.position.y = 0.02;
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16), parkaDark);
  hood.rotation.x = Math.PI / 2; hood.position.set(0, 0.56, -0.04);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.42, 0.01), M(0x777777, 0.4, 0.8));
  zip.position.set(0, 0.28, 0.18);
  torso.add(coat, hem, hood, zip);

  // head
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const scarfM = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 10), scarf);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin);
  head.scale.set(0.92, 1.1, 1); head.position.y = 0.15;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), beanie);
  hat.position.y = 0.17;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 16), beanie);
  cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.19;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 6), skin);
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.14, 0.1);
  neck.add(scarfM, head, hat, cuff, nose);

  // arms: right hand holds the pistol, left hand the flashlight (under the gun when aiming)
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.46, 0);
    const upper = limb(0.065, 0.055, 0.3, parka);
    const elbow = new THREE.Group(); elbow.position.y = -0.3;
    const fore = limb(0.055, 0.045, 0.27, parka);
    const wrist = new THREE.Group(); wrist.position.y = -0.27;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M(0x1c1c1c, 0.9));
    glove.scale.set(1, 1.2, 0.8);
    wrist.add(glove);
    if (side > 0) {
      // the hand carries on along the forearm (-y here): the barrel points where the arm points
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.19, 0.045), gunMat);
      slide.position.set(0, -0.1, 0.03);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.1), gunMat);
      grip.position.set(0, -0.03, -0.02); grip.rotation.x = -0.25;
      wrist.add(slide, grip);
    } else {
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.2, 8), torchMat);
      torch.position.set(0, -0.09, -0.02);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 10), new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff6e0, emissiveIntensity: 0 }));
      lens.rotation.x = Math.PI / 2; lens.position.set(0, -0.191, -0.02);
      wrist.add(torch, lens);
      wrist.userData.lens = lens;
    }
    elbow.add(fore, wrist); shoulder.add(upper, elbow);
    torso.add(shoulder);
    arms.push({ shoulder, elbow, wrist, side });
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group, body, torso, neck, legs, arms, lens: arms[0].wrist.userData.lens };
}

// Pose the figure. phase = walk cycle (radians), speed 0..1, aim 0..1 (arms up and forward), plus states.
export function posePlayer(p, { phase, speed, aim, reloading, interacting, mantling, t }) {
  const sw = Math.sin(phase) * 0.7 * speed;
  for (const L of p.legs) {
    const s = L.side > 0 ? sw : -sw;
    L.hip.rotation.x = -s;
    L.knee.rotation.x = Math.max(0, Math.sin(phase + (L.side > 0 ? 0 : Math.PI) - 0.6)) * 0.9 * speed + (mantling ? 0.9 : 0);
  }
  p.body.position.y = 0.98 - Math.abs(Math.sin(phase)) * 0.03 * speed - (mantling ? 0.15 : 0);
  p.torso.rotation.x = 0.06 * speed + (interacting ? 0.25 : 0) + (mantling ? 0.5 : 0);
  p.neck.rotation.x = interacting ? 0.3 : -aim * 0.1;
  for (const A of p.arms) {
    const swing = (A.side > 0 ? -sw : sw) * 0.6;
    let sx, sz, ex;
    if (mantling) { sx = -2.6; sz = A.side * 0.2; ex = -0.3; }
    else if (reloading) { sx = -1.0; sz = -A.side * 0.35; ex = -1.4 + Math.sin(t * 14) * 0.15 * (A.side > 0 ? 1 : 0); }
    else if (interacting) { sx = -1.1; sz = -A.side * 0.15; ex = -0.6 + Math.sin(t * 9 + A.side) * 0.12; }
    else {
      // relaxed swing → two-handed aim (gun hand straight, torch hand tucked under it)
      sx = swing * (1 - aim) + (-1.45) * aim;
      sz = A.side * 0.08 * (1 - aim) - A.side * 0.32 * aim;
      ex = -0.15 * (1 - aim) + (A.side > 0 ? -0.1 : -0.45) * aim;
    }
    A.shoulder.rotation.set(sx, 0, sz);
    A.elbow.rotation.set(ex, 0, 0);
    A.wrist.rotation.set(0, 0, 0);
  }
}
