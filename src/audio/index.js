// Procedural positional audio (Web Audio, HRTF). Sound is the main warning channel for anything outside
// the view cone, so every monster cue is positional and each cue type is distinct.
// This file maps sim events to sounds. To change how something sounds, edit sounds.js / ambience.js.
import { createEngine } from './engine.js';
import { createSounds } from './sounds.js';
import { createAmbience } from './ambience.js';

export function createAudio() {
  const engine = createEngine();
  const { ctx } = engine;
  const { crunch, breath, growl, shriek, thud, heartbeat, click, gunshot, metalClick, hiss, blip, scrape, moan } = createSounds(engine);
  const ambience = createAmbience(engine);
  const { radioBurst, startSiren } = ambience;

  // ---------- event → sound ----------
  function onEvent(e, state) {
    const m = e.id != null ? state.monsters.find((x) => x.id === e.id) : null;
    const pos = e.pos || (m ? m.pos : state.player.pos);
    const cfg = state.cfg;
    switch (e.type) {
      case 'step':
        // four feet: an uneven double patter
        crunch(pos.x, pos.z, { gain: 0.3 });
        crunch(pos.x, pos.z, { gain: 0.2, when: 0.07 + Math.random() * 0.05 });
        break;
      case 'probe':
        for (let i = 0; i < 5; i++) crunch(pos.x, pos.z, { gain: 0.45, when: i * 0.09 + Math.random() * 0.05 });
        breath(pos.x, pos.z, { gain: 0.18, dur: 0.5, when: 0.5, inhale: false });
        break;
      case 'warn': growl(pos.x, pos.z, e.deep ? cfg.monster.deepDarkWarnTime : cfg.monster.warnTime); break;
      case 'lunge':
        for (let i = 0; i < 14; i++) crunch(pos.x, pos.z, { gain: 0.6, when: i * 0.06 + Math.random() * 0.03, pitch: 0.8 });
        break;
      case 'scatter':
        for (let i = 0; i < 5; i++) crunch(pos.x, pos.z, { gain: 0.5, when: i * 0.035, pitch: 1.2 });
        break;
      case 'climb': scrape(pos.x, pos.z, cfg.monster.climbTime); break;
      case 'repel': case 'spotted': case 'shot_hit': shriek(pos.x, pos.z); break;
      case 'break_off': moan(pos.x, pos.z); break;
      case 'fled_for_good': moan(pos.x, pos.z); break;
      case 'hit': thud(); heartbeat(); break;
      case 'knocked_off': thud(); break;
      case 'flash_on': case 'flash_off': click(); break;
      case 'shot': gunshot(); break;
      case 'dry_fire': metalClick(0, 1800, 0.2); break;
      case 'reload_start':
        metalClick(0.05, 2400, 0.18);                                  // mag out
        for (let i = 0; i < 3; i++) metalClick(0.35 + i * 0.28, 4200, 0.05); // fumbling
        break;
      case 'reload_done': metalClick(0, 2000, 0.2); metalClick(0.18, 1500, 0.25); break;       // mag in, slide
      case 'reload_perfect': metalClick(0, 2600, 0.28); metalClick(0.07, 1700, 0.3); blip(1400, 0.02, 0.06, 0.06); break;
      case 'reload_jam': metalClick(0, 350, 0.4); metalClick(0.09, 500, 0.3); break;           // clunk
      case 'ammo_pickup': metalClick(0, 2600, 0.2); metalClick(0.08, 3000, 0.15); break;
      case 'flare_pickup': blip(520, 0, 0.1); break;
      case 'flare_throw': crunch(null, null, { gain: 0.15, pitch: 1.4 }); break;
      case 'flare_land': hiss(e.pos.x, e.pos.z, e.burn || cfg.flares.burnTime, 0.22, 3500); break;
      case 'jump': crunch(null, null, { gain: 0.2, pitch: 0.7 }); break;
      case 'land': crunch(null, null, { gain: e.onCar ? 0.05 : 0.25, pitch: e.onCar ? 0.4 : 0.7 }); if (e.onCar) metalClick(0, 300, 0.25); break;
      case 'mantle_start': metalClick(0, 400, 0.2); break;
      case 'radio_fixed': blip(660, 0, 0.18, 0.15); blip(990, 0.18, 0.18, 0.25); radioBurst(); break;
      case 'radio_called':
        for (let i = 0; i < 6; i++) radioBurst();
        blip(880, 0.6, 0.15, 0.3); blip(1320, 0.95, 0.15, 0.4);
        startSiren();
        break;
      case 'rescued': case 'death': heartbeat(10, 0.9); break;
    }
  }

  // ---------- per-frame ----------
  let playerStepT = 0;
  let workBlipT = 0;
  function tick(dt, state, moving) {
    const P = state.player;
    engine.setListener(P.pos, P.yaw);
    if (moving && P.grounded) {
      playerStepT -= dt;
      if (playerStepT <= 0) { playerStepT = 0.42; crunch(null, null, { gain: 0.12, pitch: 0.85 }); }
    }
    const atRadio = P.interacting && P.activeSpot === 'radio';
    if (atRadio) {
      workBlipT -= dt;
      if (workBlipT <= 0) { workBlipT = 0.5 + Math.random() * 0.7; metalClick(0, 2000 + Math.random() * 3000, 0.05); }
    }
    if (P.interacting && P.activeSpot !== 'radio') {
      workBlipT -= dt;
      if (workBlipT <= 0) { workBlipT = 0.25; metalClick(0, 1200 + Math.random() * 800, 0.05); }
    }
    ambience.tick(dt, state, atRadio);
  }

  return {
    ctx,
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    onEvent,
    tick,
    stopAll: ambience.stopAll,
  };
}
