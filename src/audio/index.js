// Procedural positional audio (Web Audio, HRTF). Sound is the main warning channel for anything outside
// the view cone, so every monster cue is positional and each cue type is distinct.
// This file maps sim events to sounds. To change how something sounds, edit sounds.js / ambience.js.
import { createEngine } from './engine.js';
import { createSounds } from './sounds.js';
import { createAmbience } from './ambience.js';
import { createSamples } from './samples.js';
import { carToWorld } from '../sim/game.js';
import { MODES } from '../sim/modes.js';

export function createAudio() {
  const engine = createEngine();
  const { ctx } = engine;
  const { crunch, breath, growl, shriek, thud, heartbeat, click, gunshot, metalClick, hiss, blip, scrape, moan, clang, glass } = createSounds(engine);
  const ambience = createAmbience(engine);
  const { radioBurst, startSiren } = ambience;
  const sfx = createSamples(engine);
  const pick = (names) => names[Math.floor(Math.random() * names.length)];
  let reloadSnd = null;

  // Recorded loops that run all night: the wreck's engine idling at its tailpipe, and the hazard relay ticking.
  // Both follow the car (rammers shove it): the engine at the tailpipe, the hazard relay up front by the lamps.
  let engineLoop = null, hazardLoop = null;
  function startLoops(cfg) {
    if (!engineLoop) {
      engineLoop = sfx.loop('engine-loop', { pos: { x: 0, y: 1.58, z: 0 }, gain: 0.22, ref: 1.5, rolloff: 1.3, randomStart: false });
      hazardLoop = sfx.loop('hazard-lights', { pos: { x: 0, y: 1.0, z: 0 }, gain: 1.4, ref: 1.5, rolloff: 1.2, randomStart: false });
    }
    const pipe = carToWorld(cfg, { x: -cfg.car.halfLength - 0.1, z: 0.45 });
    engineLoop.setPos(pipe.x, pipe.z, 1.58);
    const front = carToWorld(cfg, { x: cfg.car.halfLength + 0.1, z: 0 });
    hazardLoop.setPos(front.x, front.z, 1.0);
  }
  // The hazard file ticks every 0.3814 s, first tick at 0.0376 s; the lamps are on from each tick to the next tock.
  const HAZ_TICK = 0.3814, HAZ_FIRST = 0.0376;
  function hazardOn() {
    const ph = hazardLoop?.phase();
    if (ph == null) return null; // not loaded: the renderer keeps its own blink
    return Math.floor((ph - HAZ_FIRST + HAZ_TICK * 2) / HAZ_TICK) % 2 === 0;
  }

  // Monster footsteps: a looping source per monster on the move — full volume for the ones out hunting,
  // and a faint shuffle from the few crowd members nearest you (within CROWD_EAR m), so the dark around you
  // is never quite silent without it turning into a wall of noise.
  const stepLoops = new Map(); // id -> { loop, lastX, lastZ }
  const LOUD_MODES = new Set([MODES.STALK, MODES.PROBE, MODES.COMMIT, MODES.RETREAT, MODES.GONE, MODES.APPROACH, MODES.RAM]);
  const CROWD_EAR = 15, CROWD_VOICES = 3;
  function tickFootsteps(dt, state) {
    if (!sfx.has('monster-footsteps')) return;
    const P = state.player;
    const near = state.monsters
      .filter((m) => m.mode === MODES.SHAMBLE && Math.hypot(m.pos.x - P.pos.x, m.pos.z - P.pos.z) < CROWD_EAR)
      .sort((a, b) => Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z))
      .slice(0, CROWD_VOICES);
    const quiet = new Set(near.map((m) => m.id));
    const alive = new Set();
    for (const m of state.monsters) {
      const loud = LOUD_MODES.has(m.mode);
      if (!loud && !quiet.has(m.id)) continue;
      alive.add(m.id);
      let s = stepLoops.get(m.id);
      if (!s) { s = { loop: sfx.loop('monster-footsteps', { pos: { x: m.pos.x, y: 0.2, z: m.pos.z }, gain: 0, ref: 2, rolloff: 1.2 }), lastX: m.pos.x, lastZ: m.pos.z }; stepLoops.set(m.id, s); }
      const speed = Math.hypot(m.pos.x - s.lastX, m.pos.z - s.lastZ) / Math.max(dt, 1e-3);
      s.lastX = m.pos.x; s.lastZ = m.pos.z;
      s.loop.setPos(m.pos.x, m.pos.z, 0.2);
      let gain = 0;
      if (speed > 0.25) {
        if (loud) gain = Math.min(2.8, 1.1 + speed * 0.2);
        else gain = 0.45 * (1 - Math.hypot(m.pos.x - P.pos.x, m.pos.z - P.pos.z) / CROWD_EAR); // faint, and fades with distance
      }
      s.loop.setGain(gain, 0.15);
    }
    for (const [id, s] of stepLoops) if (!alive.has(id)) { s.loop.stop(); stepLoops.delete(id); }
  }

  // Now and then, something out in the crowd growls in the dark.
  let farGrowlT = 6 + Math.random() * 6;
  function tickFarGrowls(dt, state) {
    farGrowlT -= dt;
    if (farGrowlT > 0) return;
    farGrowlT = 7 + Math.random() * 12;
    const crowd = state.monsters.filter((m) => m.mode === 'shamble');
    if (!crowd.length) return;
    const m = crowd[Math.floor(Math.random() * crowd.length)];
    sfx.play(pick(['far-away-growl', 'far-away-growl2', 'far-away-growl3']), { pos: { x: m.pos.x, y: 1, z: m.pos.z }, gain: 1.6, ref: 6, rolloff: 0.9, rate: 0.9 + Math.random() * 0.2 });
  }

  // Every few minutes a car goes by somewhere far off in the dark, and doesn't stop.
  let carT = 60 + Math.random() * 60, car = null;
  function tickPassingCar(dt, state) {
    if (car) {
      car.t += dt;
      const k = car.t / car.dur;
      car.loop.setPos(car.x0 + (car.x1 - car.x0) * k, car.z0 + (car.z1 - car.z0) * k, 1);
      if (k >= 1) { car.loop.stop(); car = null; }
      return;
    }
    carT -= dt;
    if (carT > 0 || !sfx.has('passing-car-ambience')) return;
    carT = 150 + Math.random() * 150;
    // a straight road ~70 m out, crossing past on one side
    const b = Math.random() * Math.PI * 2, d = 70, f = { x: Math.sin(b), z: Math.cos(b) }, r = { x: f.z, z: -f.x };
    const dir = Math.random() < 0.5 ? 1 : -1;
    car = {
      t: 0, dur: 12,
      x0: f.x * d - r.x * 60 * dir, z0: f.z * d - r.z * 60 * dir,
      x1: f.x * d + r.x * 60 * dir, z1: f.z * d + r.z * 60 * dir,
      loop: sfx.loop('passing-car-ambience', { pos: { x: f.x * d, y: 1, z: f.z * d }, gain: 2.2, ref: 20, rolloff: 0.6, randomStart: false }),
    };
  }

  // ---------- event → sound ----------
  function onEvent(e, state) {
    const m = e.id != null ? state.monsters.find((x) => x.id === e.id) : null;
    const pos = e.pos || (m ? m.pos : state.player.pos);
    const cfg = state.cfg;
    switch (e.type) {
      case 'step':
        if (sfx.has('monster-footsteps')) break; // the recorded footsteps loop covers it (tickFootsteps)
        // four feet: an uneven double patter
        crunch(pos.x, pos.z, { gain: 0.3 });
        crunch(pos.x, pos.z, { gain: 0.2, when: 0.07 + Math.random() * 0.05 });
        break;
      case 'probe':
        for (let i = 0; i < 5; i++) crunch(pos.x, pos.z, { gain: 0.45, when: i * 0.09 + Math.random() * 0.05 });
        breath(pos.x, pos.z, { gain: 0.18, dur: 0.5, when: 0.5, inhale: false });
        break;
      case 'warn':
        if (!sfx.play(pick(['growl3', 'growl4']), { pos: { x: pos.x, y: 1, z: pos.z }, gain: 1.3, rate: e.deep ? 1.15 : 0.95 + Math.random() * 0.1 })) {
          growl(pos.x, pos.z, e.deep ? cfg.monster.deepDarkWarnTime : cfg.monster.warnTime);
        }
        break;
      case 'lunge':
        for (let i = 0; i < 14; i++) crunch(pos.x, pos.z, { gain: 0.6, when: i * 0.06 + Math.random() * 0.03, pitch: 0.8 });
        break;
      case 'scatter':
        for (let i = 0; i < 5; i++) crunch(pos.x, pos.z, { gain: 0.5, when: i * 0.035, pitch: 1.2 });
        break;
      case 'climb': scrape(pos.x, pos.z, cfg.monster.climbTime); break;
      case 'repel': case 'spotted': case 'shot_hit':
        if (!sfx.play('monster-flee', { pos: { x: pos.x, y: 1, z: pos.z }, gain: 1.1, rate: 0.93 + Math.random() * 0.14 })) shriek(pos.x, pos.z);
        break;
      case 'break_off':
        if (!sfx.play(pick(['growl1', 'growl2']), { pos: { x: pos.x, y: 1, z: pos.z }, gain: 1.5, ref: 5, rolloff: 0.9 })) moan(pos.x, pos.z);
        break;
      case 'fled_for_good': moan(pos.x, pos.z); break;
      // breakers: hammering on the light bar, then the glass going
      case 'smash_start':
        sfx.play('growl4', { pos: { x: pos.x, y: 1, z: pos.z }, gain: 1.1, rate: 0.8 });
        for (let i = 0; i < 6; i++) clang(pos.x, pos.z, { gain: 0.45, when: 0.1 + i * 0.26 + Math.random() * 0.05, freq: 380 + Math.random() * 120 });
        break;
      case 'lights_smashed': glass(pos.x, pos.z); clang(pos.x, pos.z, { gain: 0.6, freq: 300 }); break;
      // rammers: snorting and pawing, the charge, the impact
      case 'ram_windup':
        if (!sfx.play('growl3', { pos: { x: pos.x, y: 0.8, z: pos.z }, gain: 1.3, rate: 0.72 })) growl(pos.x, pos.z, cfg.monster.windupTime);
        for (let i = 0; i < 4; i++) crunch(pos.x, pos.z, { gain: 0.5, when: i * 0.22, pitch: 0.6 });
        break;
      case 'ram':
        for (let i = 0; i < 10; i++) crunch(pos.x, pos.z, { gain: 0.7, when: i * 0.07, pitch: 0.7 });
        break;
      case 'car_rammed':
        thud();
        clang(pos.x, pos.z, { gain: e.kind === 'jostle' ? 0.5 : 0.9, freq: 180 + Math.random() * 60 });
        for (let i = 0; i < 5; i++) crunch(pos.x, pos.z, { gain: 0.6, when: i * 0.04, pitch: 0.5 });
        break;
      case 'stagger': thud(); break;
      case 'hit': thud(); heartbeat(); reloadSnd?.stop(); reloadSnd = null; break; // a hit knocks the reload out of your hands
      case 'knocked_off': thud(); break;
      case 'flash_on': case 'flash_off':
        if (!sfx.play('flashlight-on-off', { gain: 0.55, rate: e.type === 'flash_off' ? 0.94 : 1 })) click();
        break;
      case 'shot': if (!sfx.play('gunshot', { gain: 0.9 })) gunshot(); break;
      case 'dry_fire': metalClick(0, 1800, 0.2); break;
      case 'reload_start':
        reloadSnd = sfx.play('reloading', { gain: 0.8 });
        if (!reloadSnd) {
          metalClick(0.05, 2400, 0.18);                                  // mag out
          for (let i = 0; i < 3; i++) metalClick(0.35 + i * 0.28, 4200, 0.05); // fumbling
        }
        break;
      case 'reload_done':
        reloadSnd?.stop(); reloadSnd = null;
        if (!sfx.play('reload-success', { gain: 0.8 })) { metalClick(0, 2000, 0.2); metalClick(0.18, 1500, 0.25); } // mag in, slide
        break;
      case 'reload_perfect':
        reloadSnd?.stop(); reloadSnd = null;
        if (!sfx.play('reload-success', { gain: 0.9, rate: 1.08 })) { metalClick(0, 2600, 0.28); metalClick(0.07, 1700, 0.3); }
        blip(1400, 0.02, 0.06, 0.06); // the little 'nailed it' blip on top
        break;
      case 'reload_jam':
        reloadSnd?.stop(); reloadSnd = null;
        if (!sfx.play('failed-reload', { gain: 0.9 })) { metalClick(0, 350, 0.4); metalClick(0.09, 500, 0.3); } // clunk
        break;
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
      // ---------- hazards (packet 05): placeholder cues from the procedural kit ----------
      case 'fire_start': hiss(pos.x, pos.z, 2, 0.15, 2500); break;
      case 'fire_grow': hiss(pos.x, pos.z, 2.5, 0.4, 900); crunch(pos.x, pos.z, { gain: 0.3, pitch: 0.5 }); break;
      case 'fire_out': hiss(pos.x, pos.z, 0.8, 0.25, 5000); break;
      case 'car_exploded': thud(); clang(pos.x, pos.z, { gain: 0.9, freq: 160 }); hiss(pos.x, pos.z, 3, 0.6, 700); break;
      case 'knocked_down': thud(); break;
      case 'extinguisher_pickup': metalClick(0, 900, 0.25); break;
      case 'swarm_start': hiss(pos.x, pos.z, 3, 0.18, 6500); break;
      case 'swarm_hit': crunch(pos.x, pos.z, { gain: 0.25, pitch: 1.8 }); break;
      case 'swarm_scattered': hiss(pos.x, pos.z, 1.2, 0.25, 7000); break;
      case 'tentacle_start': scrape(pos.x, pos.z, 1.5); break;
      case 'tentacle_smash': for (let i = 0; i < 5; i++) clang(pos.x, pos.z, { gain: 0.4, when: i * 0.3, freq: 400 + Math.random() * 120 }); break;
      case 'tentacle_drag': scrape(pos.x, pos.z, 3); clang(pos.x, pos.z, { gain: 0.5, freq: 150 }); break;
      case 'tentacle_hit': crunch(pos.x, pos.z, { gain: 0.3, pitch: 0.6 }); break;
      case 'tentacle_severed': moan(pos.x, pos.z); break;
      case 'struggle': crunch(null, null, { gain: 0.2, pitch: 0.9 }); break;
      case 'gust_warn': hiss(pos.x, pos.z, cfg.hazards.gust.warnTime + cfg.hazards.gust.blowTime, 0.5, 500); break;
      case 'zombie_start': moan(pos.x, pos.z); break;
      case 'zombie_grab': thud(); growl(pos.x, pos.z, 0.8); break;
      case 'zombie_bite': growl(pos.x, pos.z, 0.4); break;
      case 'zombie_shoved': crunch(pos.x, pos.z, { gain: 0.5, pitch: 0.7 }); break;
      case 'zombie_hit': crunch(pos.x, pos.z, { gain: 0.35, pitch: 0.6 }); break;
      case 'rescued': case 'death': heartbeat(10, 0.9); break;
    }
  }

  // ---------- per-frame ----------
  let playerStepT = 0;
  let workBlipT = 0;
  function tick(dt, state, moving) {
    const P = state.player;
    startLoops(state.cfg);
    tickFootsteps(dt, state);
    tickFarGrowls(dt, state);
    tickPassingCar(dt, state);
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
    stopAll() {
      ambience.stopAll();
      for (const s of stepLoops.values()) s.loop.stop();
      stepLoops.clear();
      reloadSnd?.stop(); reloadSnd = null;
      if (car) { car.loop.stop(); car = null; }
    },
    hazardOn,
  };
}
