// Title / pause / game-over overlays.
import { $, fmt } from './dom.js';

export function showOverlay(which) {
  $('overlay').hidden = !which;
  for (const id of ['title', 'paused', 'over']) $(id).hidden = id !== which;
}

export function setupTitle({ seed, best, demo }) {
  if (demo) { $('cta').textContent = 'Tap to watch the demo'; $('demoNote').hidden = false; }
  $('titleSeed').textContent = seed;
  $('bestTitle').textContent = best ? `Fastest rescue: ${fmt(best)}` : '';
}

export function showGameOver(game, seed, best) {
  const t = game.t;
  $('overTitle').textContent = game.won ? 'RESCUED' : 'You lasted';
  $('overTime').textContent = fmt(t);
  $('overBest').textContent = best ? fmt(best) : '—';
  $('overSeed').textContent = seed;
  const repels = game.events.filter((e) => e.type === 'repel' || e.type === 'shot_hit').length;
  $('overRepels').textContent = String(repels);
  const ph = game.radio.phase;
  $('overPhase').textContent = game.won ? `${game.monsters.length} of them out there when help arrived`
    : ph === 'repair' ? `Radio ${Math.floor(100 * game.radio.repair / game.cfg.radio.repairTime)}% repaired`
    : ph === 'call' ? 'Radio fixed — never got the call out'
    : `Help was ${Math.ceil(game.radio.rescueLeft)}s away`;
  showOverlay('over');
}
