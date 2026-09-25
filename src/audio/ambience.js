// Background sound: wind, the car's electrical hum and radio chatter, the static while you work the
// radio, and the rescue siren that closes in after the call.
import { panner } from './engine.js';

export function createAmbience({ ctx, master, noiseBuf }) {
  // wind
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuf; wind.loop = true;
  const windLp = ctx.createBiquadFilter(); windLp.type = 'lowpass'; windLp.frequency.value = 380;
  const windGain = ctx.createGain(); windGain.gain.value = 0.13;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.07;
  lfo.connect(lfoGain).connect(windGain.gain);
  wind.connect(windLp).connect(windGain).connect(master);
  wind.start(); lfo.start();

  // electrical hum + radio from the car (positional, fixed at origin)
  const carPan = panner(ctx, 0, 0.6, 0, { ref: 2, rolloff: 1.4 });
  carPan.connect(master);
  const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
  const humLp = ctx.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 180;
  const humGain = ctx.createGain(); humGain.gain.value = 0.05;
  hum.connect(humLp).connect(humGain).connect(carPan);
  hum.start();
  let radioTimer = 4;

  function radioBurst() {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3;
    const g = ctx.createGain();
    const dur = 0.4 + Math.random() * 0.9;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.setValueAtTime(0.12, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    src.connect(bp).connect(g).connect(carPan);
    src.start(t, Math.random(), dur + 0.1);
  }

  // radio static while you work on it (non-positional, it's in your hands)
  const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
  const rsBp = ctx.createBiquadFilter(); rsBp.type = 'bandpass'; rsBp.frequency.value = 2200; rsBp.Q.value = 1.5;
  const rsGain = ctx.createGain(); rsGain.gain.value = 0;
  rs.connect(rsBp).connect(rsGain).connect(master); rs.start();

  // distant siren once help is coming — positional at the rescue vehicle
  let siren = null;
  function startSiren() {
    if (siren) return;
    const pn = panner(ctx, 0, 1, 50, { ref: 8, rolloff: 0.6 }); pn.connect(master);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 700;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.35;
    const lg = ctx.createGain(); lg.gain.value = 220;
    lfo2.connect(lg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.value = 0.05;
    o.connect(g).connect(pn); o.start(); lfo2.start();
    siren = { pn, g, o, lfo2 };
  }

  function tick(dt, state, atRadio) {
    radioTimer -= dt;
    if (radioTimer <= 0) { radioTimer = 6 + Math.random() * 14; radioBurst(); }
    rsGain.gain.setTargetAtTime(atRadio ? 0.09 : 0, ctx.currentTime, 0.05);
    if (siren && state.radio.rescueDist != null) {
      const b = state.cfg.arena.landmarkBearing, d = state.radio.rescueDist;
      const x = Math.sin(b) * d, z = Math.cos(b) * d;
      if (siren.pn.positionX) { siren.pn.positionX.value = x; siren.pn.positionZ.value = z; } else siren.pn.setPosition(x, 1, z);
      siren.g.gain.value = 0.05 + 0.15 * (1 - d / state.cfg.arena.landmarkDistance);
    }
  }

  function stopAll() {
    if (siren) { siren.o.stop(); siren.lfo2.stop(); siren = null; }
    rsGain.gain.value = 0;
  }

  return { radioBurst, startSiren, tick, stopAll };
}
