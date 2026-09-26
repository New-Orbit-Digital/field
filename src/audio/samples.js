// Recorded sound effects (src/audio/sfx/). Loaded in the background; until a file has loaded (or if it's
// missing), callers get null back and fall back to the procedural sound in sounds.js.
// URLs: on the site the files sit next to this module; the single-file builds inline them as data URLs
// (window.__FIELD_SFX, injected by tools/build.mjs).
import { panner } from './engine.js';

export const SFX_FILES = [
  'engine-loop.wav', 'failed-reload.mp3', 'far-away-growl.mp3', 'far-away-growl2.mp3', 'far-away-growl3.mp3',
  'flashlight-on-off.mp3', 'growl1.mp3', 'growl2.mp3', 'growl3.mp3', 'growl4.mp3', 'gunshot.mp3',
  'hazard-lights.mp3', 'monster-flee.mp3', 'monster-footsteps.mp3', 'passing-car-ambience.mp3',
  'reload-success.mp3', 'reloading.mp3',
];

function sfxUrl(file) {
  const inline = typeof window !== 'undefined' && window.__FIELD_SFX && window.__FIELD_SFX[file];
  return inline || new URL(`./sfx/${file}`, import.meta.url).href;
}

export function createSamples({ ctx, master }) {
  const buffers = new Map(); // name (no extension) -> AudioBuffer
  const waiting = new Map(); // name -> [callbacks]
  for (const file of SFX_FILES) {
    const name = file.replace(/\.\w+$/, '');
    fetch(sfxUrl(file))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((a) => ctx.decodeAudioData(a))
      .then((buf) => {
        buffers.set(name, buf);
        for (const cb of waiting.get(name) || []) cb(buf);
        waiting.delete(name);
      })
      .catch(() => {}); // missing file: the procedural sound stays in use
  }

  const has = (name) => buffers.has(name);

  // One-shot. pos = {x, z, y?} for a positional sound, or null for "in your hands". Returns a handle or null.
  function play(name, { pos = null, gain = 1, rate = 1, offset = 0, ref = 2, rolloff = 1.1 } = {}) {
    const buf = buffers.get(name);
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    if (pos) g.connect(panner(ctx, pos.x, pos.y ?? 0.8, pos.z, { ref, rolloff })).connect(master);
    else g.connect(master);
    src.start(ctx.currentTime, offset % buf.duration);
    return {
      stop(fade = 0.08) {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0, t, fade / 3);
        try { src.stop(t + fade); } catch { /* already stopped */ }
      },
    };
  }

  // A looping positional source you can move and fade. Starts as soon as the file has loaded.
  function loop(name, { pos, gain = 1, rate = 1, ref = 2, rolloff = 1.1, randomStart = true } = {}) {
    const g = ctx.createGain();
    g.gain.value = 0;
    const pn = panner(ctx, pos.x, pos.y ?? 0.8, pos.z, { ref, rolloff });
    g.connect(pn).connect(master);
    let src = null, target = gain, startedAt = 0;
    const start = (buf) => {
      src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
      src.connect(g);
      const off = randomStart ? Math.random() * buf.duration : 0;
      startedAt = ctx.currentTime - off / rate;
      src.start(ctx.currentTime, off);
      g.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
    };
    if (buffers.has(name)) start(buffers.get(name));
    else waiting.set(name, [...(waiting.get(name) || []), start]);
    return {
      get playing() { return !!src; },
      // seconds into the loop right now (for syncing visuals), or null before it starts
      phase() { return src ? ((ctx.currentTime - startedAt) * rate) % src.buffer.duration : null; },
      setPos(x, z, y = pos.y ?? 0.8) {
        if (pn.positionX) { pn.positionX.value = x; pn.positionY.value = y; pn.positionZ.value = z; } else pn.setPosition(x, y, z);
      },
      setGain(v, tc = 0.15) { target = v; g.gain.setTargetAtTime(v, ctx.currentTime, tc); },
      stop() {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        if (src) { try { src.stop(ctx.currentTime + 0.5); } catch { /* ok */ } }
        src = null;
      },
    };
  }

  return { has, play, loop };
}
