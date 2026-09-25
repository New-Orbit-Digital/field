// The monster model + animation: a spindly four-legged thing. Smooth, deliberate movement;
// the wrongness is in the proportions, the long gait, and one slow head tilt.
import * as THREE from 'three';
import { MODES, inBeam } from '../sim/game.js';

export function buildBeast() {
  const skin = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 });
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 6, 10), skin);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1, 1, 0.8);
  torso.position.set(0, 1.25, 0);
  body.add(torso);
  const spine = [];
  for (let i = 0; i < 5; i++) {
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), skin);
    n.position.set(0, 1.5, -0.55 + i * 0.28);
    body.add(n);
    spine.push(n);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 1.35, 0.8);
  body.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.7, 4, 8), skin);
  neckMesh.rotation.x = 1.1; neckMesh.position.set(0, -0.12, 0.3);
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, -0.32, 0.62);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  skull.scale.set(0.8, 0.9, 1.6);
  head.add(skull);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8f0d0, transparent: true, opacity: 0, fog: false });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeMat);
    e.position.set(s * 0.07, 0.05, 0.2);
    head.add(e);
  }

  // four long two-segment legs: [hipX, hipZ, phase offset]
  const legs = [];
  for (const [x, z, off] of [[0.2, 0.6, 0], [-0.2, 0.6, 0.5], [0.2, -0.6, 0.5], [-0.2, -0.6, 0]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.2, z);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.75, 4, 6), skin);
    upper.position.y = -0.42;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.85;
    hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.75, 4, 6), skin);
    lower.position.y = -0.4;
    knee.add(lower);
    body.add(hip);
    legs.push({ hip, knee, x, off, front: z > 0 });
  }
  group.traverse((m) => { if (m.isMesh && m.material === skin) m.castShadow = true; });

  return {
    group, body, neck, head, legs, spine, eyeMat,
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
  const fast = mode === MODES.COMMIT || mode === MODES.RETREAT || mode === MODES.GONE || scattering;
  // smooth follow of the sim position (no stop-motion snapping)
  const k = 1 - Math.exp(-dt * 18);
  const px = v.vis.x, pz = v.vis.z;
  v.vis.x += (m.pos.x - v.vis.x) * k;
  v.vis.z += (m.pos.z - v.vis.z) * k;
  const dx = v.vis.x - px, dz = v.vis.z - pz;
  const moved = Math.hypot(dx, dz);
  v.gait += moved * 0.9;
  // face travel direction; face the player when warning / climbing
  let want = v.yaw;
  if (mode === MODES.WARN || mode === MODES.CLIMB || mode === MODES.PROBE) want = Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
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
  let crouch = 0, pitch = 0;
  if (mode === MODES.WARN) { crouch = -0.35; pitch = 0.25; }
  else if (mode === MODES.COMMIT) { crouch = -0.15; pitch = 0.18; }
  else if (mode === MODES.CLIMB) { crouch = 0.3; pitch = -0.7; }
  else if (mode === MODES.PROBE) { crouch = -0.1; pitch = 0.1; }
  else if (mode === MODES.SHAMBLE && !scattering) { crouch = -0.08; pitch = 0.16 + Math.sin(t * 0.7 + v.tiltT) * 0.05; } // head hung, swaying
  v.body.position.y += (crouch - v.body.position.y) * Math.min(1, dt * 8);
  v.body.rotation.x += (pitch - v.body.rotation.x) * Math.min(1, dt * 8);
  v.flinch = Math.max(0, v.flinch - dt);
  v.body.rotation.z = v.flinch > 0 ? Math.sin(t * 40) * 0.25 * (v.flinch / 0.45) : 0;

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
  v.spine.forEach((n, i) => { n.rotation.x = Math.sin(g * 4 + i) * (fast ? 0.15 : 0.06); });
  // eyes: lit when it's coming for you, and they shine back when your beam catches them
  const eyes = inBeam(state, m.pos) ? 1 : mode === MODES.WARN || mode === MODES.COMMIT || mode === MODES.CLIMB ? 1 : mode === MODES.PROBE ? 0.35 : 0;
  v.eyeMat.opacity += (eyes - v.eyeMat.opacity) * Math.min(1, dt * 10);
}
