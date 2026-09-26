// Debug overlay (toggle with `): per-monster state readout and a player-centred minimap.
import { bearingTo, carToWorld, inDeepDark, monsterVisible, spotWorld, attackerCap, hunterCount, wrapAngle } from '../sim/game.js';
import { $ } from './dom.js';

let mctx = null;

export function renderDebug(game, seed) {
  const P = game.player, cfg = game.cfg;
  const lines = [
    `seed ${seed}   t ${game.t.toFixed(1)}s   phase ${game.radio.phase}   deep ${inDeepDark(game)}`,
    `crowd ${game.monsters.length}/${cfg.horde.crowd}   hunting ${hunterCount(game)}/${game.hordeTarget}   attacker cap ${attackerCap(game)}   flares burning ${game.flares.length}   next flare ${Math.max(0, game.flareReadyAt - game.t).toFixed(0)}s`,
    `lights ${game.strobes.map((x) => (x ? 'ok' : 'SMASHED')).join('/')}   car ${cfg.car.x.toFixed(2)},${cfg.car.z.toFixed(2)} ${((cfg.car.yaw - (cfg.car.yaw0 ?? cfg.car.yaw)) * 180 / Math.PI).toFixed(1)}°   battery ${P.battery.toFixed(0)}  hp ${P.health}  mag ${P.mag}/${P.reserve}  y ${P.y.toFixed(2)}  onCar ${P.onCar}  spot ${P.activeSpot || '-'}`,
  ];
  for (const m of game.monsters) {
    if (m.mode === 'shamble') continue;
    const rel = wrapAngle(bearingTo(P.pos, m.pos) - P.yaw);
    lines.push(`#${m.id} ${m.kind[0].toUpperCase()} ${m.mode.padEnd(8)} rel ${(rel * 180 / Math.PI).toFixed(0).padStart(4)}°  d ${Math.hypot(m.pos.x - P.pos.x, m.pos.z - P.pos.z).toFixed(1).padStart(5)}  vis ${monsterVisible(game, m) ? 'Y' : '-'}  beam ${m.beamAccum.toFixed(2)}${m.wounds ? ' W' + m.wounds : ''}${m.deep ? ' DEEP' : ''}`);
  }
  $('debugText').textContent = lines.join('\n');

  const mini = $('minimap');
  mctx = mctx || mini.getContext('2d');
  const W = mini.width, S = W / 44;
  const f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) };
  const r = { x: -f.z, z: f.x };
  const toMap = (p) => {
    const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
    return [W / 2 + (dx * r.x + dz * r.z) * S, W / 2 - (dx * f.x + dz * f.z) * S];
  };
  mctx.fillStyle = 'rgba(0,0,0,0.65)';
  mctx.fillRect(0, 0, W, W);
  const [cx, cy] = toMap({ x: 0, z: 0 });
  mctx.lineWidth = 1;
  mctx.strokeStyle = '#f35';
  mctx.beginPath(); mctx.arc(cx, cy, cfg.arena.darkRadius * S, 0, Math.PI * 2); mctx.stroke();
  mctx.strokeStyle = '#555';
  mctx.beginPath(); mctx.arc(cx, cy, cfg.horde.crowdInner * S, 0, Math.PI * 2); mctx.stroke();
  mctx.fillStyle = '#888';
  mctx.beginPath();
  for (const [lx, lz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const [mx, my] = toMap(carToWorld(cfg, { x: lx * cfg.car.halfLength, z: lz * cfg.car.halfWidth }));
    mctx.lineTo(mx, my);
  }
  mctx.fill();
  for (const [name, col] of [['radio', '#fa2'], ['ammo', '#4f8'], ['flares', '#f42']]) {
    const [sx, sy] = toMap(spotWorld(cfg, name).stand);
    mctx.fillStyle = col; mctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  for (const fl of game.flares) {
    const [fx, fy] = toMap(fl.pos);
    mctx.strokeStyle = '#f84';
    mctx.beginPath(); mctx.arc(fx, fy, cfg.flares.radius * S, 0, Math.PI * 2); mctx.stroke();
  }
  const h = cfg.perception.viewHalfAngle;
  mctx.fillStyle = 'rgba(255,255,200,0.15)';
  mctx.beginPath(); mctx.moveTo(W / 2, W / 2);
  mctx.arc(W / 2, W / 2, 16 * S, -Math.PI / 2 - h, -Math.PI / 2 + h); mctx.fill();
  mctx.fillStyle = '#9cf';
  mctx.beginPath(); mctx.arc(W / 2, W / 2, 4, 0, Math.PI * 2); mctx.fill();
  const colors = { shamble: '#444', stalk: '#999', probe: '#fc3', warn: '#f80', commit: '#f22', climb: '#f0f', retreat: '#6af', gone: '#a33', approach: '#c9f', smash: '#f5f', windup: '#fa6', ram: '#f60' };
  for (const m of game.monsters) {
    const [mx, my] = toMap(m.pos);
    mctx.fillStyle = colors[m.mode];
    mctx.beginPath(); mctx.arc(mx, my, 4, 0, Math.PI * 2); mctx.fill();
  }
}
