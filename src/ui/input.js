// Keyboard + mouse. Held controls are read each sim tick; one-shot actions (fire, reload, throw, jump)
// are queued as "edges" and consumed by the next tick.
//   WASD/arrows move · mouse look · hold right click = flashlight · left click = fire
//   R reload · Q drop flare · Space jump · hold E use the car · ` debug
const EDGE_KEYS = { KeyR: 'reload', KeyQ: 'throw', Space: 'jump' };

export function createInput(canvas, { isPlaying, onLook, onDebug, onKey }) {
  const keys = new Set();
  const edges = new Set();
  let flashlightHeld = false;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (isPlaying() && EDGE_KEYS[e.code]) { edges.add(EDGE_KEYS[e.code]); e.preventDefault(); }
    if (e.code === 'Backquote') onDebug();
    onKey?.(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('mousedown', (e) => {
    if (!isPlaying()) return;
    if (e.button === 0) edges.add('fire');        // left click: shoot
    if (e.button === 2) flashlightHeld = true;    // right click (held): flashlight
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) flashlightHeld = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('blur', () => { keys.clear(); flashlightHeld = false; });
  addEventListener('mousemove', (e) => {
    if (!isPlaying() || document.pointerLockElement !== canvas) return;
    onLook(e.movementX, e.movementY);
  });

  return {
    // Movement axes (for the "moving" animation) without consuming edges.
    axes() {
      const moveZ = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { moveX, moveZ };
    },
    // One sim tick's input. Edges are consumed.
    sample(yaw) {
      const { moveX, moveZ } = this.axes();
      const input = {
        moveX, moveZ, yaw,
        flashlight: flashlightHeld,
        interact: keys.has('KeyE'),
        fire: edges.has('fire'), reload: edges.has('reload'), throw: edges.has('throw'), jump: edges.has('jump'),
      };
      edges.clear();
      return input;
    },
    reset() { edges.clear(); flashlightHeld = false; },
  };
}
