// Monster behaviour states.
//   shamble — out in the crowd at the edge of the dark, quiet
//   stalk / probe / warn / commit / climb — hunting you (broke off from the crowd)
//   retreat — running back to the dark, veering out of the beam and away from flares
//   gone — shot twice: leaving the field for good
//   approach → smash (breakers: the lights) / approach → windup → ram (rammers: the car)
export const MODES = {
  SHAMBLE: 'shamble',
  STALK: 'stalk',
  PROBE: 'probe',
  WARN: 'warn',
  COMMIT: 'commit',
  CLIMB: 'climb',
  RETREAT: 'retreat',
  GONE: 'gone',
  APPROACH: 'approach',
  SMASH: 'smash',
  WINDUP: 'windup',
  RAM: 'ram',
};
export const ATTACKING = new Set([MODES.WARN, MODES.COMMIT, MODES.CLIMB]);
export const HUNTING = new Set([MODES.STALK, MODES.PROBE, MODES.WARN, MODES.COMMIT, MODES.CLIMB, MODES.APPROACH, MODES.SMASH, MODES.WINDUP, MODES.RAM]);
