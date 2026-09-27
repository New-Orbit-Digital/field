// The in-game HUD (packet 07): prompts that hover over the car spots (the radio's bar tracks the whole rescue),
// battery + ammo dots beside the head while aiming, a health bar under the feet while hurt, the aim dot (on what a
// shot would hit) and the active-reload bar under it. Nothing is written across the top of the screen.
import { reloadProgress } from '../sim/game.js';
import { $, KEY } from './dom.js';

// Prompt text when you're standing at a car spot and facing it — short; it hovers over the spot itself.
const PROMPTS = {
  radio: (g) => g.radio.phase === 'repair' ? `${KEY('E')} Fix radio` : g.radio.phase === 'call' ? `${KEY('E')} Call for help` : 'Help is coming',
  ammo: (g) => g.hazards.fire && !g.player.hasExtinguisher ? `${KEY('E')} Extinguisher` : 'Trunk', // ammo is unlimited now; the trunk only has the extinguisher
  fire: (g) => g.player.extinguisher > 0 ? `${KEY('E')} Spray` : `${KEY('E')} Kick snow`,
  flares: (g) => g.player.flares >= g.cfg.flares.carryMax ? 'Holding a flare' : g.t < g.flareReadyAt ? `Next flare ${Math.ceil(g.flareReadyAt - g.t)}s` : `${KEY('E')} Flare`,
};
const ACTIONABLE = (html) => html.includes('class="key"');
let lastPrompt = null, lastSpot = null, lastFlare = null, lastShotAt = -99, lastDots = null, hpShowUntil = 0, hpShown = 1;

const place = (el, p, dy = 0) => { el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + dy).toFixed(1)}px) translate(-50%, -100%)`; };

export function update(game, phase, world, view = {}) {
  const P = game.player, R = game.radio, cfg = game.cfg;
  const playing = phase === 'playing';
  // nothing written across the top any more (packet 07): progress lives on the radio prompt's bar

  // health: a bar under your feet, only while you're hurt (it fills back up as you recover). The pulsing red
  // screen edge it replaced was a full-screen animated shadow and cost too much frame time (Justin, packet 07).
  // It refills smoothly while you recover (the next point creeps in over regenEvery), shows full for a moment, then hides.
  const hpBar = $('hpBar'), pc = cfg.player;
  const now = performance.now();
  const hurt = playing && game.alive && P.health < pc.maxHealth;
  if (hurt) hpShowUntil = now + 900;
  const regenFrac = hurt && P.hurtT >= pc.regenDelay ? Math.min(1, (P.regenT || 0) / pc.regenEvery) : 0;
  const target = Math.max(0, P.health + regenFrac) / pc.maxHealth;
  hpShown += (target - hpShown) * (target < hpShown ? 1 : Math.min(1, 0.12)); // drops at once, rises smoothly
  const showHp = playing && game.alive && now < hpShowUntil;
  hpBar.hidden = !showHp;
  if (showHp) {
    const ft = world.feetScreen(game);
    hpBar.hidden = !ft.visible;
    hpBar.style.transform = `translate(${ft.x.toFixed(1)}px, ${(ft.y + 14).toFixed(1)}px) translate(-50%, 0)`;
    $('hpFill').style.width = `${(100 * hpShown).toFixed(1)}%`;
  } else hpShown = target;

  // bottom right: just the flare hint now
  const flareHtml = P.flares > 0 ? `<span class="hint flare">${KEY('Q')} drop flare</span>` : '';
  if (flareHtml !== lastFlare) { $('flare').innerHTML = flareHtml; lastFlare = flareHtml; }

  // beside your head while aiming (right mouse), reloading or just after a shot: battery + the magazine as 6 dots
  const aimHud = $('aimHud');
  const showAim = playing && game.alive && (view.aiming || P.flashlightOn || P.reloading > 0 || performance.now() - lastShotAt < 1500);
  aimHud.hidden = !showAim;
  if (showAim) {
    const h = world.headScreen(game);
    aimHud.hidden = !h.visible;
    aimHud.style.transform = `translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px) translate(calc(-100% - 38px), -50%)`; // beside the head, to the left
    const b = P.flashlightBroken ? 0 : P.battery / cfg.flashlight.batteryMax;
    const level = Math.ceil(b * 5 - 1e-6); // five steps, like a phone battery
    $('battLevel').style.width = `${level * 20}%`;
    $('battIcon').classList.toggle('low', level <= 1);
    $('battIcon').classList.toggle('dead', P.flashlightLocked || P.flashlightBroken);
    const dots = Array.from({ length: cfg.pistol.magSize }, (_, i) => `<i${i < P.mag ? '' : ' class="spent"'}></i>`).join('');
    if (dots !== lastDots) { $('ammoDots').innerHTML = dots; lastDots = dots; }
  }

  // hazards: the warmth bar (backlogged) and frost at the edges
  const hz = game.hazards;
  $('warmWrap').hidden = !hz.cold;
  if (hz.cold) {
    $('warmFill').style.width = `${(100 * P.heat / cfg.hazards.cold.max).toFixed(1)}%`;
    $('warm').classList.toggle('numb', !!hz.cold.numb);
  }
  $('frost').style.opacity = hz.cold ? String(Math.max(0, 1 - P.heat / (cfg.hazards.cold.max * 0.5)).toFixed(2)) : '0';

  // the car-spot prompt hovers over the spot, with its progress bar under it (a stompable tentacle wins)
  const sp = $('spotPrompt');
  const stomp = playing && game.hazards.stompable;
  const spot = playing && !P.held && P.activeSpot ? P.activeSpot : null;
  if (stomp) {
    const html = `${KEY('E')} Stomp`;
    if (html !== lastSpot) { $('spotText').innerHTML = html; lastSpot = html; sp.classList.remove('dim'); }
    const at = world.worldScreen(stomp.pos, 0.4);
    sp.hidden = !at.visible; place(sp, at); $('spotProg').hidden = true;
  } else if (spot) {
    const html = PROMPTS[spot](game);
    if (html !== lastSpot) { $('spotText').innerHTML = html; lastSpot = html; sp.classList.toggle('dim', !ACTIONABLE(html)); }
    const at = world.spotScreen(game, spot);
    sp.hidden = !at.visible;
    place(sp, at);
    let prog = 0, showProg = P.interacting;
    if (spot === 'radio') { // the radio's bar is the whole rescue: repair, then the call, then help on its way
      showProg = true;
      prog = R.phase === 'repair' ? R.repair / cfg.radio.repairTime : R.phase === 'call' ? R.call / cfg.radio.callTime
        : R.phase === 'wait' ? 1 - Math.max(0, R.rescueLeft) / cfg.radio.rescueTime : 1;
    } else if (P.interacting) {
      if (spot === 'fire') prog = game.hazards.fire ? game.hazards.fire.douse / cfg.hazards.fire.douse : 1;
      else if (spot === 'ammo' && game.hazards.fire && !P.hasExtinguisher) prog = P.hold / cfg.hazards.fire.extinguisherPickup;
      else prog = P.hold / (spot === 'ammo' ? cfg.pistol.pickupTime : cfg.flares.pickupTime);
    }
    $('spotProg').hidden = !showProg;
    $('spotProgFill').style.width = `${Math.min(100, prog * 100).toFixed(1)}%`;
  } else { sp.hidden = true; lastSpot = null; }

  // bottom-centre: only for things that aren't at a spot (grabbed, knocked flat, on the roof)
  const held = P.held === 'zombie' ? `${KEY('A')} ${KEY('D')} ${KEY('A')} ${KEY('D')} shove it off — or shoot it` : P.held === 'down' ? 'Knocked flat…' : null;
  $('prompt').classList.toggle('urgent', !!held);
  const prompt = held || (P.onCar ? 'On the roof — you can\'t reach anything from up here' : '');
  if (prompt !== lastPrompt) { $('prompt').innerHTML = prompt; lastPrompt = prompt; }

  // aim dot follows where the gun/flashlight actually points (recoil included) — always shown, even with a dead battery
  const aim = world.aimScreen();
  const dot = $('aim');
  dot.hidden = !playing || !aim.visible;
  dot.style.transform = `translate(${aim.x.toFixed(1)}px, ${aim.y.toFixed(1)}px)`;
  // active-reload bar under the aim dot (no instructions — players discover the flagged zone)
  const rb = $('reloadBar');
  rb.hidden = !(P.reloading > 0 && P.reloadWindow);
  if (!rb.hidden) {
    $('reloadZone').style.left = `${(P.reloadWindow.a * 100).toFixed(1)}%`;
    $('reloadZone').style.width = `${((P.reloadWindow.b - P.reloadWindow.a) * 100).toFixed(1)}%`;
    $('reloadMark').style.left = `${(reloadProgress(P) * 100).toFixed(1)}%`;
    rb.classList.toggle('used', P.reloadTried);
  }
}

// ---------- transient feedback ----------
let dmgTimer = null;
export function flashDamage() {
  const v = $('vignette');
  v.classList.remove('hit');
  void v.offsetWidth;
  v.classList.add('hit');
  clearTimeout(dmgTimer);
  dmgTimer = setTimeout(() => v.classList.remove('hit'), 700);
}

// Event-driven HUD feedback. (No text toasts any more: nothing is written across the top of the screen.)
export function onEvent(e) {
  if (e.type === 'hit') flashDamage();
  if (e.type === 'shot' || e.type === 'dry_fire') lastShotAt = performance.now();
  if (e.type === 'reload_jam') $('reloadBar').classList.add('jam');
  if (e.type === 'reload_start') $('reloadBar').classList.remove('jam');
}
