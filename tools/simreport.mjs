// Headless balance report: many seeded nights with scripted players.
import { runHeadless } from '../src/sim/game.js';
import { idleBot, reactiveBot, objectiveBot } from '../src/sim/bots.js';

const N = Number(process.argv[2] || 60);
const seeds = Array.from({ length: N }, (_, i) => `R${i}`);
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];

console.log('— Defence only (stays put, never touches the radio) —');
const defence = {
  idle: () => idleBot(),
  'flashlight only (0.35s)': () => reactiveBot({ reaction: 0.35 }),
  'flashlight + gun (0.35s)': () => reactiveBot({ reaction: 0.35, gun: true }),
};
for (const [name, make] of Object.entries(defence)) {
  const times = []; let l = 0, r = 0, h = 0, d = 0, sh = 0;
  for (const s of seeds) {
    const g = runHeadless(s, make(), { maxTime: 600 });
    times.push(g.t);
    for (const e of g.events) {
      if (e.type === 'warn' && !e.deep) l++; if (e.type === 'repel') r++; if (e.type === 'hit') h++;
      if (e.type === 'scatter') d++; if (e.type === 'shot_hit') sh++;
    }
  }
  console.log(`${name.padEnd(26)} median ${pct(times, 0.5).toFixed(0).padStart(4)}s | per attack: light-repel ${(100 * r / l).toFixed(0)}%  shot ${(100 * sh / l).toFixed(0)}%  hit you ${(100 * h / l).toFixed(0)}%  | crowd scatters/run ${(d / N).toFixed(1)}`);
}

console.log('\n— Playing the objective (radio → call → wait for rescue) —');
const players = {
  'sharp (0.3s, misses 5%)': () => objectiveBot({ reaction: 0.3, missChance: 0.05 }),
  'average (0.45s, misses 15%)': () => objectiveBot({ reaction: 0.45, missChance: 0.15 }),
  'shaky (0.6s, misses 25%)': () => objectiveBot({ reaction: 0.6, missChance: 0.25, aimNoise: 0.08 }),
  'average, never uses flares': () => objectiveBot({ reaction: 0.45, missChance: 0.15, flares: false }),
};
for (const [name, make] of Object.entries(players)) {
  let wins = 0; const deathPhase = {}; const winT = []; const fixedAt = [], calledAt = [];
  let ammoTrips = 0, flareThrows = 0, gone = 0, hits = 0, rams = 0, smashed = 0, interrupts = 0;
  for (const s of seeds) {
    const g = runHeadless(s, make(), { maxTime: 900 });
    if (g.won) { wins++; winT.push(g.t); } else deathPhase[g.radio.phase] = (deathPhase[g.radio.phase] || 0) + 1;
    for (const e of g.events) {
      if (e.type === 'radio_fixed') fixedAt.push(e.t);
      if (e.type === 'radio_called') calledAt.push(e.t);
      if (e.type === 'ammo_pickup') ammoTrips++;
      if (e.type === 'flare_throw') flareThrows++;
      if (e.type === 'monster_gone') gone++;
      if (e.type === 'hit') hits++;
      if (e.type === 'car_rammed') rams++;
      if (e.type === 'lights_smashed') smashed++;
      if (e.type === 'interrupted') interrupts++;
    }
  }
  const dp = Object.entries(deathPhase).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  console.log(`${name.padEnd(28)} win ${(100 * wins / N).toFixed(0).padStart(3)}% | median win ${winT.length ? pct(winT, 0.5).toFixed(0) + 's' : '—'} | deaths by phase: ${dp} | radio fixed@${fixedAt.length ? pct(fixedAt, 0.5).toFixed(0) : '—'}s called@${calledAt.length ? pct(calledAt, 0.5).toFixed(0) : '—'}s | ammo trips/run ${(ammoTrips / N).toFixed(1)} flares/run ${(flareThrows / N).toFixed(1)} | hits taken/run ${(hits / N).toFixed(1)} | driven off for good/run ${(gone / N).toFixed(1)} | rams/run ${(rams / N).toFixed(1)} interrupts/run ${(interrupts / N).toFixed(1)} lights smashed/run ${(smashed / N).toFixed(1)}`);
}
