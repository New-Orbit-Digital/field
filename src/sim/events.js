// Every gameplay moment is an event in state.events — audio, visuals, tests and bots all read these.
export function emit(state, type, data = {}) {
  state.events.push({ t: +state.t.toFixed(4), type, ...data });
}
