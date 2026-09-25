// The player model (placeholder primitives).
import * as THREE from 'three';

export function buildPlayer() {
  const group = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a6e5a, roughness: 0.7 });
  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 6, 12), coat);
  torso.position.y = 0.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
  head.position.y = 0.82;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.12, 16), coat);
  hat.position.y = 0.95;
  const arm = new THREE.Group();
  arm.position.set(-0.3, 0.42, 0.05);
  const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), coat);
  armMesh.position.y = -0.25;
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 }));
  torch.position.set(0, -0.52, 0);
  arm.add(armMesh, torch);
  arm.rotation.x = -1.2;
  body.add(torso, head, hat, arm);
  body.position.y = 0.85;
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  group.add(body);
  return { group, body, arm };
}
