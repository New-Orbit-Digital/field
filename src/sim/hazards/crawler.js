// Under-car crawler: it lives under the wreck. Hang around the hull (or stand on the roof) and after a
// few seconds there's a tell — scraping, snow shifting underneath — then it lunges: rooted, a hit, and
// off the roof. Step away during the tell, or put the beam on it.
import { emit } from '../events.js';
import { carClosestPoint, carDistance } from '../car.js';
import { hitPlayer } from '../player.js';
import { inBeam } from '../perception.js';
import { attacker } from './common.js';

export function spawnCrawler(state) {
  const hz = state.hazards;
  if (hz.crawler) return;
  hz.crawler = { state: 'lurk', t: 0, delay: nextDelay(state), pos: carClosestPoint(state.cfg, state.player.pos), holdT: 0 };
  emit(state, 'crawler_start');
}

const nextDelay = (state) => state.rng.range(state.cfg.hazards.crawler.delayMin, state.cfg.hazards.crawler.delayMax);

export function stepCrawler(state, dt) {
  const C = state.hazards.crawler;
  if (!C) return;
  const cc = state.cfg.hazards.crawler, P = state.player, cfg = state.cfg;
  const near = P.onCar || carDistance(cfg, P.pos) <= cc.triggerRange;
  if (C.holdT > 0) { C.holdT -= dt; if (C.holdT <= 0 && P.held === 'crawler') P.held = null; }
  C.t += dt;
  if (C.state === 'lurk') {
    if (!near) { C.t = 0; return; }
    C.pos = carClosestPoint(cfg, P.pos);
    if (C.t >= C.delay) { C.state = 'tell'; C.t = 0; emit(state, 'crawler_tell', { pos: { ...C.pos } }); }
  } else if (C.state === 'tell') {
    if (inBeam(state, C.pos)) { C.state = 'cooldown'; C.t = 0; C.cool = cc.repelCooldown; emit(state, 'crawler_repelled', { pos: { ...C.pos } }); return; }
    if (C.t >= cc.tellTime) {
      const inRange = P.onCar || carDistance(cfg, P.pos) <= cc.lungeRange;
      if (inRange) {
        emit(state, 'crawler_grab', { pos: { ...C.pos } });
        if (P.invuln <= 0) hitPlayer(state, attacker('crawler', C.pos));
        if (state.alive) { P.held = P.held || 'crawler'; C.holdT = cc.rootTime; P.interacting = false; }
      } else emit(state, 'crawler_miss', { pos: { ...C.pos } });
      C.state = 'cooldown'; C.t = 0; C.cool = cc.cooldown;
    }
  } else if (C.state === 'cooldown' && C.t >= C.cool) { C.state = 'lurk'; C.t = 0; C.delay = nextDelay(state); }
}
