// One-shot sound effects, all synthesized (no asset files). Each is a small function you can tweak
// on its own. Positional ones take (x, z) in world space; pass null for sounds "in your hands".
import { panner } from './engine.js';

export function createSounds({ ctx, master, noiseBuf }) {
  function crunch(x, z, { gain = 0.5, when = 0, pitch = 1 } = {}) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = pitch * (0.85 + Math.random() * 0.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 * pitch; bp.Q.value = 0.9;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09 + Math.random() * 0.04);
    const out = x === null ? master : panner(ctx, x, 0.1, z);
    if (out !== master) out.connect(master);
    src.connect(bp).connect(hp).connect(g).connect(out);
    src.start(t, Math.random() * 1.5, 0.2);
  }

  function breath(x, z, { gain = 0.25, dur = 0.7, when = 0, inhale = true } = {}) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(inhale ? 500 : 900, t);
    bp.frequency.linearRampToValueAtTime(inhale ? 1100 : 400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const p = panner(ctx, x, 2.4, z); p.connect(master);
    src.connect(bp).connect(g).connect(p);
    src.start(t, Math.random(), dur + 0.1);
  }

  // The real-attack tell: a low, rising growl. Distinct from footsteps and probes.
  function growl(x, z, dur) {
    const t = ctx.currentTime;
    const p = panner(ctx, x, 2.2, z, { ref: 3, rolloff: 0.9 }); p.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(1300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.75, t + 0.12);
    g.gain.setValueAtTime(0.75, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
    for (const [f0, det] of [[68, 0], [71, 9], [102, -7]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.35, t + dur);
      o.detune.value = det;
      const trem = ctx.createOscillator(); trem.frequency.value = 23;
      const tg = ctx.createGain(); tg.gain.value = 12;
      trem.connect(tg).connect(o.frequency);
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.3);
      trem.start(t); trem.stop(t + dur + 0.3);
    }
    lp.connect(g).connect(p);
    breath(x, z, { gain: 0.35, dur: dur * 0.8, inhale: true });
  }

  function shriek(x, z) {
    const t = ctx.currentTime;
    const p = panner(ctx, x, 2.4, z, { ref: 3, rolloff: 0.8 }); p.connect(master);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.8);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
    o.connect(bp).connect(g).connect(p);
    o.start(t); o.stop(t + 1);
  }

  function thud() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.7);
    for (let i = 0; i < 3; i++) crunch(null, null, { gain: 0.7, when: i * 0.03, pitch: 0.6 });
  }

  function heartbeat(times = 6, rate = 1.3) {
    for (let i = 0; i < times; i++) {
      for (const [off, gain] of [[0, 0.5], [0.16, 0.35]]) {
        const t = ctx.currentTime + i / rate + off;
        const o = ctx.createOscillator(); o.frequency.value = 52;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain * (1 - i / times), t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
      }
    }
  }

  function click() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.04);
  }

  function gunshot() {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(lp).connect(g).connect(master);
    src.start(t, Math.random(), 0.6);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const og = ctx.createGain(); og.gain.setValueAtTime(1, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.35);
    // echo off the empty field
    const d = ctx.createDelay(1); d.delayTime.value = 0.38;
    const dg = ctx.createGain(); dg.gain.value = 0.18;
    g.connect(d).connect(dg).connect(master);
  }

  function metalClick(when = 0, freq = 3200, gain = 0.12) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(bp).connect(g).connect(master); o.start(t); o.stop(t + 0.05);
  }

  function hiss(x, z, dur, gain = 0.25, freq = 3000) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.1);
    g.gain.setValueAtTime(gain, t + dur - 1.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const out = x === null ? master : panner(ctx, x, 0.3, z, { ref: 2, rolloff: 1.3 });
    if (out !== master) out.connect(master);
    src.connect(bp).connect(g).connect(out);
    src.start(t); src.stop(t + dur + 0.1);
  }

  function blip(freq = 880, when = 0, gain = 0.12, dur = 0.08) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  function scrape(x, z, dur) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 12;
    bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1900, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.05); g.gain.setValueAtTime(0.7, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
    const pn = panner(ctx, x, 1.2, z, { ref: 2, rolloff: 1 }); pn.connect(master);
    src.connect(bp).connect(g).connect(pn);
    src.start(t); src.stop(t + dur + 0.1);
  }

  function moan(x, z) {
    const t = ctx.currentTime;
    const pn = panner(ctx, x, 2, z, { ref: 6, rolloff: 0.5 }); pn.connect(master);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(60, t + 2.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.6); g.gain.linearRampToValueAtTime(0, t + 2.4);
    o.connect(lp).connect(g).connect(pn); o.start(t); o.stop(t + 2.5);
  }

  return { crunch, breath, growl, shriek, thud, heartbeat, click, gunshot, metalClick, hiss, blip, scrape, moan };
}
