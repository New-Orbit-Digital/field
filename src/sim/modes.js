// Monster behaviour states.
export const MODES = {
  STALK: 'stalk',
  PROBE: 'probe',
  WARN: 'warn',
  COMMIT: 'commit',
  CLIMB: 'climb',
  RETREAT: 'retreat',
};
export const ATTACKING = new Set([MODES.WARN, MODES.COMMIT, MODES.CLIMB]);
