// The monsters: spindly, wrong, four-legged things in three builds that tell you what each one is after.
//   hunter  — lean and low, long neck and jaw: comes for you
//   breaker — tall, with long forelimbs and hooked claws, hunched high at the shoulder: goes for the lights
//   rammer  — bulky, heavy-shouldered, a blunt bony head, short thick legs: charges the car
// Smooth, deliberate movement; the wrongness is in the proportions, the long gait, and one slow head tilt.
import * as THREE from 'three';
import { MODES, inBeam } from '../sim/game.js';

const BUILDS = {
  hunter:  { skin: 0x0b0b0e, hip: 1.2, fore: 1.0, hind: 1.0, legR: 1.0, torsoL: 1.3, torsoR: 0.22, width: 0.8, neck: 0.75, head: 1.0, shoulder: 0.0, claws: 0.08 },
  breaker: { skin: 0x0d0c0a, hip: 1.35, fore: 1.3, hind: 0.95, legR: 0.95, torsoL: 1.1, torsoR: 0.22, width: 0.85, neck: 0.55, head: 0.85, shoulder: 0.25, claws: 0.2 },
  rammer:  { skin: 0x100c0c, hip: 1.0, fore: 0.85, hind: 0.8, legR: 1.7, torsoL: 1.2, torsoR: 0.36, width: 1.25, neck: 0.35, head: 1.45, shoulder: 0.3, claws: 0.06 },
};

function seg(r0, r1, len, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 8), mat);
  m.position.y = -len / 2;
  return m;
}

export function buildBeast(kind = 'hunter') {
  const B = BUILDS[kind] || BUILDS.hunter;
  const skin = new THREE.MeshStandardMaterial({ color: B.skin, roughness: 0.85, metalness: 0.05 });
  const bone = new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.6 });
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // torso: a ribbed capsule, tipped up at the shoulders for the taller builds
  const torso = new THREE.Group();
  torso.position.set(0, B.hip + 0.05, 0);
  torso.rotation.x = -B.shoulder * 0.6;
  body.add(torso);
  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(B.torsoR, B.torsoL, 6, 12), skin);
  trunk.rotation.x = Math.PI / 2;
  trunk.scale.set(B.width, 1, 0.82);
  torso.add(trunk);
  // ribs showing through
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(B.torsoR * 1.02, 0.018, 4, 12, Math.PI * 1.1), skin);
    rib.rotation.set(0, Math.PI / 2, Math.PI * 0.95);
    rib.scale.set(1, 0.82, B.width);
    rib.position.set(0, -0.02, 0.15 + i * 0.1 - B.torsoL * 0.15);
    torso.add(rib);
  }
  // shoulder hump (breakers and rammers)
  if (B.shoulder > 0) {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(B.torsoR * 1.1, 12, 8), skin);
    hump.scale.set(B.width * 1.1, 0.9, 1.2);
    hump.position.set(0, B.torsoR * 0.7, B.torsoL * 0.35);
    torso.add(hump);
  }
  const spine = [];
  for (let i = 0; i < 7; i++) {
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), bone);
    n.position.set(0, B.torsoR * 1.05, -0.6 * B.torsoL / 1.3 + i * 0.19 * B.torsoL / 1.3);
    n.rotation.x = -0.4;
    torso.add(n);
    spine.push(n);
  }

  // neck and head, with a jaw that opens when it means it
  const neck = new THREE.Group();
  neck.position.set(0, 0.08, B.torsoL * 0.62);
  torso.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * B.head, 0.1 * B.head, B.neck, 8), skin);
  neckMesh.rotation.x = 1.15; neckMesh.position.set(0, -0.08, B.neck * 0.45);
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, -0.26 * B.neck / 0.75, B.neck * 0.85);
  head.scale.setScalar(B.head);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
  skull.scale.set(0.85, 0.8, 1.5);
  head.add(skull);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), kind === 'rammer' ? bone : skin);
  brow.position.set(0, 0.08, 0.1);
  head.add(brow);
  if (kind === 'rammer') {
    // bony battering plate
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), bone);
    plate.scale.set(1.3, 0.6, 1.2); plate.rotation.x = -1.3; plate.position.set(0, 0.03, 0.16);
    head.add(plate);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.05, 0.02);
  head.add(jaw);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.26), skin);
  jawMesh.position.set(0, -0.02, 0.1);
  jaw.add(jawMesh);
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.04, 4), bone);
    tooth.position.set(-0.05 + i * 0.025, 0.01, 0.2);
    jaw.add(tooth);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8f0d0, transparent: true, opacity: 0, fog: false });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), eyeMat);
    e.position.set(s * 0.065, 0.04, 0.17);
    head.add(e);
  }

  // four long two-segment legs with claws: [hipX, hipZ, phase offset, fore?]
  const legs = [];
  const hz = B.torsoL * 0.46;
  for (const [x, z, off] of [[0.2, hz, 0], [-0.2, hz, 0.5], [0.2, -hz, 0.5], [-0.2, -hz, 0]]) {
    const front = z > 0;
    const len = (front ? B.fore : B.hind) * B.hip * 0.72;
    const r = 0.05 * B.legR;
    const hip = new THREE.Group();
    hip.position.set(x * B.width, B.hip + (front ? B.shoulder * 0.4 : 0), z);
    hip.add(seg(r * 1.2, r * 0.8, len, skin));
    const knee = new THREE.Group();
    knee.position.y = -len;
    hip.add(knee);
    knee.add(seg(r * 0.8, r * 0.55, len, skin));
    const foot = new THREE.Group();
    foot.position.y = -len;
    knee.add(foot);
    for (const cx of [-0.03, 0, 0.03]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012 * B.legR, B.claws, 4), bone);
      claw.rotation.x = Math.PI / 2 + 0.3; claw.position.set(cx * B.legR, -0.01, B.claws * 0.45);
      foot.add(claw);
    }
    body.add(hip);
    legs.push({ hip, knee, x, off, front, len });
  }
  group.traverse((m) => { if (m.isMesh && m.material !== eyeMat) m.castShadow = true; });

  return {
    kind, group, body, torso, neck, head, jaw, legs, spine, eyeMat, B,
    vis: new THREE.Vector3(),
    gait: 0, yaw: 0,
    flinch: 0,
    bleed: 0,
    tiltT: 2 + Math.random() * 4, tilt: 0, tiltTarget: 0, // occasional slow head tilt — the one 'wrong' movement
  };
}

export function animateBeast(v, m, state, dt) {
  const P = state.player, t = state.t;
  const mode = m.mode;
  const scattering = m.scatterT > 0;
  const fast = mode === MODES.COMMIT || mode === MODES.RETREAT || mode === MODES.GONE || mode === MODES.RAM || scattering;
  // smooth follow of the sim position (no stop-motion snapping)
  const k = 1 - Math.exp(-dt * 18);
  const px = v.vis.x, pz = v.vis.z;
  v.vis.x += (m.pos.x - v.vis.x) * k;
  v.vis.z += (m.pos.z - v.vis.z) * k;
  const dx = v.vis.x - px, dz = v.vis.z - pz;
  const moved = Math.hypot(dx, dz);
  v.gait += moved * 0.9 / (v.B.hip / 1.2);
  // face travel direction; face you when warning / climbing; face the car when smashing / winding up
  let want = v.yaw;
  const car = state.cfg.car;
  if (mode === MODES.WARN || mode === MODES.CLIMB || mode === MODES.PROBE) want = Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
  else if (mode === MODES.SMASH || mode === MODES.WINDUP) want = Math.atan2((car.x || 0) - m.pos.x, (car.z || 0) - m.pos.z);
  else if (moved > 0.002) want = Math.atan2(dx, dz);
  let dy = want - v.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  v.yaw += dy * (1 - Math.exp(-dt * 8));
  v.group.position.copy(v.vis);
  v.group.rotation.y = v.yaw;

  // legs: smooth diagonal-pair gait
  const g = v.gait;
  const amp = Math.min(1, moved / Math.max(dt, 1e-3) / 4) * (fast ? 0.65 : 0.45);
  for (const L of v.legs) {
    const s = Math.sin((g + L.off) * Math.PI * 2);
    L.hip.rotation.x = s * amp + (L.front ? -0.25 : 0.25);
    L.knee.rotation.x = (L.front ? 1 : -1) * (0.6 + Math.max(0, -s) * amp * 1.4);
    L.hip.rotation.z = L.x > 0 ? -0.15 : 0.15;
  }
  // posture per mode
  let crouch = 0, pitch = 0, jawOpen = 0;
  if (mode === MODES.WARN) { crouch = -0.35; pitch = 0.25; jawOpen = 0.5; }
  else if (mode === MODES.COMMIT) { crouch = -0.15; pitch = 0.18; jawOpen = 0.7; }
  else if (mode === MODES.CLIMB) { crouch = 0.3; pitch = -0.7; jawOpen = 0.4; }
  else if (mode === MODES.PROBE) { crouch = -0.1; pitch = 0.1; }
  else if (mode === MODES.SMASH) {
    // rears up and hammers the light bar with its forelimbs
    crouch = 0.15; pitch = -0.75; jawOpen = 0.35;
    for (const L of v.legs) if (L.front) { L.hip.rotation.x = -1.3 + Math.sin(t * 11 + L.x * 9) * 0.6; L.knee.rotation.x = 0.9; }
  } else if (mode === MODES.WINDUP) {
    // head down, pawing the snow
    crouch = -0.3; pitch = 0.35; jawOpen = 0.2;
    const paw = v.legs.find((L) => L.front && L.x > 0);
    if (paw) { paw.hip.rotation.x = -0.6 + Math.sin(t * 9) * 0.5; paw.knee.rotation.x = 1.1; }
  } else if (mode === MODES.RAM) { crouch = -0.2; pitch = 0.4; }
  else if (mode === MODES.SHAMBLE && !scattering) { crouch = -0.08; pitch = 0.16 + Math.sin(t * 0.7 + v.tiltT) * 0.05; } // head hung, swaying
  v.body.position.y += (crouch - v.body.position.y) * Math.min(1, dt * 8);
  v.body.rotation.x += (pitch - v.body.rotation.x) * Math.min(1, dt * 8);
  v.flinch = Math.max(0, v.flinch - dt);
  v.body.rotation.z = v.flinch > 0 ? Math.sin(t * 40) * 0.25 * (v.flinch / 0.45) : 0;
  v.jaw.rotation.x += (jawOpen - v.jaw.rotation.x) * Math.min(1, dt * 10);

  // the one unsettling tic: now and then, while it's still, the head slowly tilts too far, then snaps back
  v.tiltT -= dt;
  if (v.tiltT <= 0) {
    if (v.tiltTarget === 0 && (mode === MODES.STALK || mode === MODES.PROBE || mode === MODES.SHAMBLE)) { v.tiltTarget = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4); v.tiltT = 1.2 + Math.random(); }
    else { v.tiltTarget = 0; v.tiltT = 3 + Math.random() * 5; v.tilt = 0; } // snap back
  }
  v.tilt += (v.tiltTarget - v.tilt) * Math.min(1, dt * 1.5);
  const look = mode === MODES.WARN ? -0.3 : mode === MODES.SHAMBLE ? 0.35 : 0;
  v.neck.rotation.set(look, 0, 0);
  v.head.rotation.set(0, 0, v.tilt);
  v.spine.forEach((n, i) => { n.rotation.x = -0.4 + Math.sin(g * 4 + i) * (fast ? 0.15 : 0.06); });
  // eyes: lit when it's coming for you (or the car), and they shine back when your beam catches them
  const eyes = inBeam(state, m.pos) ? 1
    : mode === MODES.WARN || mode === MODES.COMMIT || mode === MODES.CLIMB || mode === MODES.SMASH || mode === MODES.WINDUP || mode === MODES.RAM ? 1
    : mode === MODES.PROBE ? 0.35 : 0;
  v.eyeMat.opacity += (eyes - v.eyeMat.opacity) * Math.min(1, dt * 10);
}
