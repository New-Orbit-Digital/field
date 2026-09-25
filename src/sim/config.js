// All tunables live here. Units: metres, seconds, radians.
const DEG = Math.PI / 180;

export const CONFIG = {
  arena: {
    lightRadius: 9,        // radius of the cop-car light circle
    boundRadius: 30,       // hard edge of the playable field
    strobeHz: 1.6,         // red/blue alternation rate (visual)
    landmarkDistance: 50,  // distant vehicle (steady headlights) — rescue drives in from here
    landmarkBearing: 2.3,  // world bearing from the wreck (radians)
  },
  car: {
    yaw: 0.4,              // must match the rendered wreck's rotation
    halfLength: 2.35,      // local x half-extent
    halfWidth: 0.95,       // local z half-extent
    top: 1.62,             // height of the upturned chassis you can stand on
  },
  // Pickup / interaction spots, in car-local coords. `stand` is where you stand,
  // `face` is the point on the hull you must be looking at while you hold E.
  spots: {
    radio:  { stand: { x: 0.35, z: 1.6 },  face: { x: 0.35, z: 0.95 }, label: 'radio' },   // driver's window
    ammo:   { stand: { x: -3.0, z: 0 },    face: { x: -2.35, z: 0 },   label: 'trunk' },   // trunk
    flares: { stand: { x: 0.9, z: -1.6 },  face: { x: 0.9, z: -0.95 }, label: 'flares' },  // passenger side
    standRange: 1.15,
    faceHalfAngle: 40 * DEG,
  },
  player: {
    radius: 0.35,
    speed: 3.2,
    maxHealth: 3,
    invulnTime: 1.2,
    knockback: 1.6,
    jumpVelocity: 3.4,     // low, weak jump: apex ≈ 0.41 m — can't just hop onto the car
    gravity: 14,
    mantleReach: 0.5,      // how close to the hull you must be, airborne, to grab the edge
    mantleMinHeight: 0.15, // must actually be off the ground
    mantleFaceAngle: 50 * DEG,
    mantleTime: 0.75,      // hauling yourself up: vulnerable, no actions
  },
  perception: {
    viewHalfAngle: 45 * DEG,
    rearHalfAngle: 25 * DEG,
    rearRange: 2.8,
  },
  flashlight: {
    beamHalfAngle: 14 * DEG,
    beamRange: 16,
    batteryMax: 100,
    drainPerSec: 5,
    rechargePerSec: 3,
    carRechargePerSec: 12,
    carRechargeRange: 3.4,
    restartThreshold: 15,
  },
  pistol: {
    magSize: 6,
    startReserve: 6,
    maxReserve: 18,
    fireCooldown: 0.35,
    reloadTime: 2.4,       // both hands busy: no flashlight, no firing
    perfectStartMin: 0.35, // 'perfect reload' zone starts somewhere in here (fraction of the bar)…
    perfectStartMax: 0.6,
    perfectWidth: 0.12,    // …and is this wide. Hit R inside it: instant reload.
    jamPenalty: 1.2,       // hit R outside it: jammed, this much longer
    recoilKick: 0.045,     // aim/flashlight waver per shot (radians)
    recoilMax: 0.09,
    recoilDecay: 0.12,     // radians per second
    recoilWobbleHz: 7,
    range: 30,
    aimTolerance: 3 * DEG, // plus the monster's body width at range
    bodyRadius: 0.45,
    pickupAmount: 6,
    pickupTime: 1.2,
  },
  flares: {
    carSupply: 8,          // total in the car
    carryMax: 1,           // one at a time
    pickupTime: 1.0,
    throwDist: 11,
    flightTime: 0.7,
    burnTime: 25,
    radius: 5.5,           // it won't enter this
  },
  radio: {
    repairTime: 40,        // cumulative seconds of holding E at the radio
    callTime: 6,           // cumulative seconds on the handset
    rescueTime: 90,        // seconds after the call until help arrives (headlights drive in)
    rescueEndDistance: 12, // headlights stop here: rescued
  },
  horde: {
    max: 8,
    repairRampEvery: 90,   // while repairing, +1 every N s…
    repairRampCap: 3,      // …up to this many
    waitSpawnEvery: 15,    // after the call, +1 every N s up to max
    spawnDist: 30,
  },
  monster: {
    stalkMinDist: 7,
    darkMargin: 2,
    orbitSpeed: 0.9,
    stepInterval: 0.55,
    lullMin: 2.5,
    lullMax: 9,
    probeChance: 0.3,
    probeTime: 1.6,
    unseenWeight: 3,
    seenWeight: 1,
    warnTime: 0.9,
    commitSpeedDark: 8,
    commitSpeedLight: 6,
    beamSlow: 0.4,         // the beam slows a lunge, but it can scramble out of it
    repelTime: 0.5,        // cumulative beam time to repel a commit (resets as it dodges)
    beamDecay: 4,          // beamAccum drains fast once it's out of the beam
    spotRepelTime: 0.45,
    hitRange: 1.1,
    commitTimeout: 5,
    retreatSpeed: 9,
    retreatDist: 10,
    doubleTapChance: 0.2,
    doubleTapDelayMin: 0.6,
    doubleTapDelayMax: 1.3,
    // Scramble out of the beam
    dodgeChance: 0.7,      // chance to dodge each time the beam lands (or re-lands after cooldown)
    dodgeReaction: 0.12,   // how long the beam is on it before it reacts
    dodgeSpeed: 11,
    dodgeTime: 0.3,
    dodgeCooldown: 0.6,
    dodgeForwardAngle: 35 * DEG, // during a lunge the scramble also closes distance
    // Climbing the car after you
    climbTime: 1.0,        // telegraphed (scrape) — flashlight or gun can knock it off
    climbReach: 2.4,
    // Several of them
    attackerCapBase: 1,    // concurrent warn/commit/climb allowed = base + floor((n-1)/perExtra)
    attackerPerExtra: 99,  // tuned: a 2nd simultaneous attacker made the wait phase unwinnable (see balance notes)
    // Deep dark
    deepDarkMargin: 5,
    deepDarkWarnTime: 0.5,
    deepDarkSpeedMult: 1.4,
    deepDarkBeamSlow: 0.55,
    deepDarkCanRepel: false,
    deepDarkReturnDelay: 0.3,
    deepDarkStrikeDist: 6,
  },
  sim: {
    dt: 1 / 60,
  },
};

export const TAU = Math.PI * 2;
export { DEG };
