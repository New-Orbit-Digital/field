// All tunables live here. Units: metres, seconds, radians.
const DEG = Math.PI / 180;

export const CONFIG = {
  arena: {
    darkRadius: 14,        // the dim play area around the wreck (lit by the far headlights + strobes); past it is the crowd
    boundRadius: 30,       // hard edge of the playable field
    strobeHz: 1.6,         // red/blue alternation rate (visual)
    landmarkDistance: 50,  // vehicle up on the embankment (steady headlights aimed at the wreck) — rescue drives in from here
    landmarkBearing: 2.3,  // world bearing from the wreck (radians)
    embankmentHeight: 4,   // how far above the field the headlights sit, so the crowd rarely blocks them
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
    carSupply: Infinity,   // the box never runs out — you just have to go back to the car for each one
    carryMax: 1,           // one at a time
    pickupTime: 2.0,
    restockTime: 35,       // after you take one, the next isn't ready for this long (0 = no wait). Keeps a flare a reprieve, not a wall.
    dropDist: 0.8,         // dropped right in front of your feet
    flightTime: 0.3,
    burnTime: 20,
    startBurnTime: 30,     // the one already burning when the night starts
    startDistance: 5,      // …this far from the wreck, on the side away from the headlights
    radius: 9,             // lights (and keeps them out of) a circle this big
  },
  radio: {
    repairTime: 40,        // cumulative seconds of holding E at the radio
    callTime: 6,           // cumulative seconds on the handset
    rescueTime: 90,        // seconds after the call until help arrives (headlights drive in)
    rescueEndDistance: 12, // headlights stop here: rescued
  },
  // The crowd at the edge of the dark. It's one pool: hunters break off from it and go back to it.
  horde: {
    crowd: 18,             // monsters shambling at the edge when the night starts
    crowdInner: 18,        // they wander between these distances from the wreck
    crowdOuter: 27,
    shambleSpeed: 0.55,
    max: 8,                // most hunters out at once
    repairRampEvery: 90,   // while repairing, +1 hunter every N s…
    repairRampCap: 3,      // …up to this many
    waitSpawnEvery: 15,    // after the call, +1 hunter every N s up to max
    breakOffMin: 2,        // delay before a replacement hunter breaks off
    breakOffMax: 6,
    goneDist: 55,          // a twice-shot monster runs this far out and is gone for good
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
    fleeReaction: 0.12,    // beam on it this long → it runs
    closeCharge: 2,        // …unless it's already this close to you mid-lunge: then it keeps coming
    fleeSpeed: 9,
    fleeBeamSteer: 1.4,    // how hard a fleeing monster veers out of the beam
    fleeFlareSteer: 1.2,   // …and away from flares
    scatterTime: 0.9,      // a lit shambler at the edge scatters this long
    scatterSpeed: 6,
    impactRadius: 5,       // monsters this close to where a bullet lands run from it
    impactDist: 14,        // a miss lands in the snow about this far out
    spotRepelTime: 0.45,   // (climbing) cumulative beam time to knock it off the car
    beamDecay: 4,
    hitRange: 1.1,
    commitTimeout: 5,
    doubleTapChance: 0.2,  // sometimes it turns straight back round instead of rejoining the crowd
    // Climbing the car after you
    climbTime: 1.0,        // telegraphed (scrape) — flashlight or gun can knock it off
    climbReach: 2.4,
    // Several of them
    attackerCapBase: 1,    // concurrent warn/commit/climb allowed = base + floor((n-1)/perExtra)
    attackerPerExtra: 99,  // tuned: a 2nd simultaneous attacker made the wait phase unwinnable (see balance notes)
    // Walking out into the dark: the crowd is right there
    deepDarkWarnTime: 0.5,
    deepDarkSpeedMult: 1.4,
    deepDarkPack: 3,       // how many of the crowd come for you at once
    deepDarkRange: 16,     // …from this close
  },
  sim: {
    dt: 1 / 60,
  },
};

export const TAU = Math.PI * 2;
export { DEG };
