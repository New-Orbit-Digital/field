// Audio engine: the Web Audio context, master bus, a shared noise buffer, the listener (the player's ears),
// and a positional (HRTF) panner helper. Everything else in src/audio builds on this.
import { forward } from '../sim/game.js';

export function createEngine() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const noiseBuf = makeNoise(ctx, 2);
  const L = ctx.listener;

  function setListener(pos, yaw) {
    const f = forward(yaw);
    const t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02);
      L.positionY.setTargetAtTime(1.6, t, 0.02);
      L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02);
      L.forwardY.setTargetAtTime(0, t, 0.02);
      L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(pos.x, 1.6, pos.z);
      L.setOrientation(f.x, 0, f.z, 0, 1, 0);
    }
  }

  return { ctx, master, noiseBuf, setListener };
}

export function panner(ctx, x, y, z, { ref = 2, rolloff = 1.1 } = {}) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = ref;
  p.rolloffFactor = rolloff;
  p.maxDistance = 60;
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
  else p.setPosition(x, y, z);
  return p;
}

export function makeNoise(ctx, seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
