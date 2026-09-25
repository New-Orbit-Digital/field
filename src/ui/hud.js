// The in-game HUD: timer + objective, health, battery, ammo/flare with keycap hints, car prompts,
// the aim dot (projected from the real aim, recoil included) and the active-reload bar.
import { reloadProgress } from '../sim/game.js';
import { $, fmt, KEY } from './dom.js';

// Prompt text when you're standing at a car spot and facing it.
const PROMPTS = {
  radio: (g) => g.radio.phase === 'repair' ? `${KEY('E')} Repair the radio` : g.radio.phase === 'call' ? `${KEY('E')} Call for help` : 'Radio: waiting on dispatch',
  ammo: (g) => g.player.reserve < g.cfg.pistol.maxReserve ? `${KEY('E')} Grab ammo` : 'Ammo full',
  flares: (g) => g.carFlares <= 0 ? 'No flares left' : g.player.flares >= g.cfg.flares.carryMax ? 'Already holding a flare' : `${KEY('E')} Take a flare (${g.carFlares} left)`,
};
let lastPrompt = null, lastAmmo = null, lastFlare = null;

export function update(game, phase, world) {
  const P = game.player, R = game.radio, cfg = game.cfg;
  $('time').textContent = fmt(game.t);
  $('objective').textContent =
    R.phase === 'repair' ? `Fix the radio · ${Math.floor(100 * R.repair / cfg.radio.repairTime)}%`
    : R.phase === 'call' ? `Call for help · ${Math.floor(100 * R.call / cfg.radio.callTime)}%`
    : R.phase === 'wait' ? `Help is coming · ${fmt(Math.max(0, R.rescueLeft))}`
    : 'Rescued';
  $('hp').innerHTML = Array.from({ length: cfg.player.maxHealth }, (_, i) => `<span class="pip${i < P.health ? '' : ' lost'}"></span>`).join('');
  const b = P.battery / cfg.flashlight.batteryMax;
  $('battFill').style.width = `${(b * 100).toFixed(1)}%`;
  $('batt').classList.toggle('locked', P.flashlightLocked);
  $('batt').classList.toggle('low', b < 0.25);

  // bottom right: ammo + reload hint, flare + throw hint
  const ammoHtml = `<span class="count${P.mag === 0 && P.reloading <= 0 ? ' empty' : ''}">${P.mag} / ${P.reserve}</span>` +
    (P.reloading > 0 ? '<span class="hint">reloading…</span>' : P.mag < cfg.pistol.magSize && P.reserve > 0 ? `<span class="hint">${KEY('R')} reload</span>` : '');
  if (ammoHtml !== lastAmmo) { $('ammo').innerHTML = ammoHtml; lastAmmo = ammoHtml; }
  const flareHtml = P.flares > 0 ? `<span class="hint flare">${KEY('Q')} throw flare</span>` : '';
  if (flareHtml !== lastFlare) { $('flare').innerHTML = flareHtml; lastFlare = flareHtml; }

  // interaction prompt at the car
  const prompt = P.activeSpot ? PROMPTS[P.activeSpot](game) : P.onCar ? 'On the roof — you can see further, but you can\'t reach anything from up here' : '';
  if (prompt !== lastPrompt) { $('prompt').innerHTML = prompt; lastPrompt = prompt; }
  let prog = 0;
  if (P.interacting) {
    if (P.activeSpot === 'radio') prog = R.phase === 'repair' ? R.repair / cfg.radio.repairTime : R.call / cfg.radio.callTime;
    else prog = P.hold / (P.activeSpot === 'ammo' ? cfg.pistol.pickupTime : cfg.flares.pickupTime);
  }
  $('progress').hidden = !P.interacting;
  $('progressFill').style.width = `${Math.min(100, prog * 100).toFixed(1)}%`;

  // aim dot follows where the gun/flashlight actually points (recoil included) — always shown, even with a dead battery
  const aim = world.aimScreen();
  const dot = $('aim');
  dot.hidden = phase !== 'playing' || !aim.visible;
  dot.style.transform = `translate(${aim.x.toFixed(1)}px, ${aim.y.toFixed(1)}px)`;
  // active-reload bar under the dot (no instructions — players discover the flagged zone)
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
let toastT = null;
export function toast(msg) {
  if (!msg) return;
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3500);
}

let dmgTimer = null;
export function flashDamage() {
  const v = $('vignette');
  v.classList.remove('hit');
  void v.offsetWidth;
  v.classList.add('hit');
  clearTimeout(dmgTimer);
  dmgTimer = setTimeout(() => v.classList.remove('hit'), 700);
}

// Event-driven HUD feedback.
export function onEvent(e, game) {
  if (e.type === 'hit') flashDamage();
  if (e.type === 'reload_jam') $('reloadBar').classList.add('jam');
  if (e.type === 'reload_start') $('reloadBar').classList.remove('jam');
  if (e.type === 'radio_fixed') toast('Radio fixed. Call for help — hold E at the radio.');
  if (e.type === 'radio_called') toast('Dispatch copies. Help is on the way. Hold out.');
  if (e.type === 'spawn' && e.count >= game.cfg.horde.max) toast('They\'re all here now.');
}
