// Rescue countdown after the call, and the win.
import { emit } from './events.js';

export function stepRadio(state, dt) {
  const { radio, cfg } = state;
  if (radio.phase !== 'wait') return;
  radio.rescueLeft -= dt;
  const k = Math.max(0, radio.rescueLeft) / cfg.radio.rescueTime;
  radio.rescueDist = cfg.radio.rescueEndDistance + (cfg.arena.landmarkDistance - cfg.radio.rescueEndDistance) * k;
  if (radio.rescueLeft <= 0) {
    radio.phase = 'rescued';
    state.won = true;
    state.alive = false;
    emit(state, 'rescued', { time: +state.t.toFixed(2) });
  }
}
