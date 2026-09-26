// The player as the loaded Soldier model (soldier.glb, converted from assets/source/Soldier.fbx), with the
// pistol model in her right hand and a flashlight in her left. Animation clips are picked from what the sim
// says she's doing; the procedural figure in player.js stays as the fallback until this has loaded.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const HEIGHT = 1.75;
const FADE = 0.16;

// Where the gun and the torch sit in each hand, in the hand bone's frame (metres / radians, found by eye).
// The wrist bones point their fingers along +y.
export const GRIP = {
  pistol: { pos: [0.0, 0.09, 0.0], rot: [Math.PI / 2, -Math.PI / 2, 0], order: 'YXZ' }, // barrel along the fingers, grip down
  torch: { pos: [0.0, 0.07, 0.0], rot: [-Math.PI / 2, 0, 0] },
};

function worldScale(o) { return o.getWorldScale(new THREE.Vector3()).x; }

function mount(bone, obj, grip) {
  const holder = new THREE.Group();
  const s = 1 / Math.max(1e-6, worldScale(bone));
  holder.scale.setScalar(s);                 // metres, whatever the skeleton's units are
  const inner = new THREE.Group();
  inner.position.set(...grip.pos);
  inner.rotation.set(...grip.rot, grip.order || 'XYZ');
  inner.add(obj);
  holder.add(inner);
  bone.add(holder);
  return inner;
}

export function buildSoldier(gltf, pistolGltf) {
  const group = new THREE.Group();
  const model = SkeletonUtils.clone(gltf.scene);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true); // precise: measured as skinned
  const k = HEIGHT / (box.max.y - box.min.y);
  model.scale.setScalar(k);
  model.position.y = -box.min.y * k;
  group.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const conv = (m) => new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.85, metalness: 0, name: m.name });
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  group.updateMatrixWorld(true);

  const handR = model.getObjectByName('WristR');
  const handL = model.getObjectByName('WristL');

  // pistol: the real model if it loaded, fitted to ~19 cm long, muzzle forward
  let gun = null;
  if (pistolGltf && handR) {
    const p = SkeletonUtils.clone(pistolGltf.scene); // the pistol is rigged (slide, trigger)
    p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.roughness = 0.5; o.material.metalness = 0.3; } });
    gun = mount(handR, p, GRIP.pistol);
  }
  // flashlight: a short black torch with a lens the rig lights up
  let lens = null;
  if (handL) {
    const torch = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5, metalness: 0.6 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.017, 0.17, 8), bodyM);
    tube.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.021, 0.04, 10), bodyM);
    head.rotation.x = Math.PI / 2; head.position.z = 0.1;
    lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff6e0, emissiveIntensity: 0 }));
    lens.position.z = 0.121;
    torch.add(tube, head, lens);
    torch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    mount(handL, torch, GRIP.torch);
  }

  const mixer = new THREE.AnimationMixer(model);
  const acts = {};
  for (const c of gltf.animations) acts[c.name] = mixer.clipAction(c);
  for (const n of ['Death', 'HitRecieve', 'Idle_Gun_Shoot']) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce); acts[n].clampWhenFinished = true; }
  let cur = null, oneShot = null, oneShotT = 0;

  function play(name, ts = 1) {
    const a = acts[name];
    if (!a) return;
    a.timeScale = ts;
    if (cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    if (cur) cur.fadeOut(FADE);
    cur = a;
  }

  return {
    group, lens, gun, model,
    clips: Object.keys(acts),
    shot() { if (acts.Idle_Gun_Shoot) { oneShot = 'Idle_Gun_Shoot'; oneShotT = 0.35; } },
    hit() { if (acts.HitRecieve) { oneShot = 'HitRecieve'; oneShotT = 0.55; } },
    // fwd / side: how you're moving relative to where you face (-1..1 each), speed 0..1 of full speed
    update({ fwd, side, speed, aim, reloading, interacting, mantling, dead }, dt) {
      oneShotT = Math.max(0, oneShotT - dt);
      if (oneShotT <= 0) oneShot = null;
      const moving = speed > 0.08;
      if (dead) play('Death');
      else if (mantling) play('Interact', 1.6);
      else if (oneShot && !(oneShot === 'Idle_Gun_Shoot' && moving)) play(oneShot);
      else if (interacting) play('Interact');
      else if (reloading) play('Interact', 1.3);
      else if (moving) {
        const ts = 0.55 + speed * 0.45;
        if (fwd < -0.5) play('Run_Back', ts);
        else if (Math.abs(side) > 0.6 && Math.abs(fwd) < 0.5) play(side > 0 ? 'Run_Left' : 'Run_Right', ts);
        else if (aim > 0.5) play('Run_Shoot', ts);
        else play(speed > 0.6 ? 'Run' : 'Walk', speed > 0.6 ? ts : 0.8 + speed);
      } else play(aim > 0.5 ? 'Idle_Gun_Pointing' : 'Idle_Gun');
      mixer.update(dt);
    },
  };
}
