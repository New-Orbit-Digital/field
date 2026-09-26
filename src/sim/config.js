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
    x: 0, z: 0,            // where it lies now (rammers shove it around during the night)
    yaw: 0.4,              // …and which way it points
    maxDrift: 1.6,         // it never ends up further than this from where the night started
    maxTurn: 0.4,          // …or turned more than this (radians)
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
    fire:   { stand: { x: 3.0, z: 0 },     face: { x: 2.35, z: 0 },    label: 'engine' },  // front: put the fire out (hazard)
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
    gutterTime: 3,         // over its last few seconds the light dies down — and so does the circle it protects
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
    // Three kinds, each with its own look and its own idea of what to do when it breaks off:
    //   hunter  — comes for you (stalk, probe, warn, lunge)
    //   breaker — goes for the flashing lights on one side of the car and smashes them (that side stays dark)
    //   rammer  — charges the car and shoves it: jostles, turns or slides it, interrupting whatever you're doing
    // Rammers are retired (Justin, packet 05): the car-dragging tentacle replaces them. Their code stays;
    // set a count and weight here to bring them back.
    kinds: { hunter: 14, breaker: 4, rammer: 0 },
    breakOffWeights: { hunter: 0.75, breaker: 0.25, rammer: 0 },
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
    // Breakers and rammers
    approachSpeed: 3.4,    // walking in to the car
    smashTime: 1.6,        // telegraphed (banging, glass) — light it and it runs before the lights go
    smashReach: 0.9,       // how close to the light bar it has to get
    windupTime: 1.0,       // a rammer paws and snorts this long before it charges
    ramStartDist: 4.5,     // …from about this far out
    ramSpeed: 7,
    ramCloseCharge: 1.5,   // lit when it's this close to the hull: too late, it hits anyway
    rammersIgnoreFlares: true, // they're too big and too angry to care about a flare (the beam still works)
    jostleChance: 0.5,     // a ram: jostle (tiny shove) …
    rotateChance: 0.25,    // … or turn the car a few degrees; otherwise slide it
    jostleTurn: 0.015, jostleSlide: 0.05,
    rotateMin: 0.05, rotateMax: 0.1,
    slideMin: 0.2, slideMax: 0.4,
    roofFallChance: 0.5,   // standing on the roof when it hits: you might go over
    // Walking out into the dark: the crowd is right there
    deepDarkWarnTime: 0.5,
    deepDarkSpeedMult: 1.4,
    deepDarkPack: 3,       // how many of the crowd come for you at once
    deepDarkRange: 16,     // …from this close
  },
  // Hazards (packet 05, second revision). Whiteouts (gust.random) are part of a normal night; fire, tentacle
  // and zombie are tested one at a time in the sandbox (?hazard) until they're scheduled. Swarm and cold are
  // backlogged (code kept).
  hazards: {
    fire: {
      igniteEvery: 10, igniteChance: 1 / 6, // once the first flare's out: every 10 s, a 1-in-6 chance it catches (Justin's call)
      smolderTime: 2,          // after it catches: a couple of seconds of smoke before it really goes
      explodeK: 1 / 450,       // chance per second the car goes up = burn time × this (≈22% by 15 s, 63% by 30 s)
      blastRange: 4,           // near the car when it goes: knocked down, a hit, your flashlight dead
      downTime: 1.5,           // knocked down this long
      douse: 3,                // seconds of extinguisher to put it out
      snowMult: 3,             // kicking snow on it instead is this much slower
      extinguisherCharge: 12,  // seconds of spray in the trunk extinguisher
      extinguisherPickup: 1.2,
      lightMin: 2, lightMax: 6.5, lightGrow: 0.15, // it's light too (grows as it burns); the monsters keep out of it
      warmRange: 4.5,
    },
    swarm: {
      speed: 3.8, idleSpeed: 1.2,
      spawnDist: 22, seekRange: 26,
      reach: 1.3,              // on you / on a flare from this close
      drainPerSec: 18,         // flashlight battery
      hurtEvery: 3,
      smotherRate: 8,          // a flare it sits on burns down this many times faster
      // any gunshot scatters it (Justin's call)
    },
    tentacles: {
      max: 3,
      spawnDist: 18,
      speed: 1.6, litMult: 0.5, // light (beam, flare, fire) only slows it on the way in
      smashTime: 1.6,          // per side of the light bar
      dragSpeed: 0.35,         // then it hauls the car toward the dark…
      loseDist: 7,             // …and if the car ends up this far from where it started, it's gone (game over)
      hitsToSever: 2,
      retractSpeed: 5,
      bodyRadius: 0.5,
    },
    cold: {
      max: 100,
      drain: 1.0, stillMult: 1.6, roofMult: 2,
      flareWarm: 8, flareRange: 3,
      fireWarm: 14,
      exhaustWarm: 6, exhaustRange: 2,
      shakeBelow: 35, shakeMax: 3 * DEG,
      slowMult: 0.55,          // at zero: slowed, no damage (Justin's call)
    },
    gust: {
      warnTime: 1.2, blowTime: 8,
      flareBurnMult: 3,
      flickerEvery: 0.12, flickerOffChance: 0.35,
      random: true,            // part of a normal night: they blow in at random (Justin's call)
      firstMin: 45, firstMax: 90, // the first one somewhere in here…
      gapMin: 60, gapMax: 120,  // …then one every so often
      // the renderer piles on snow and drives it hard in one direction (no fog change)
    },
    zombie: {
      speed: 1.3,              // slow, but light doesn't stop it
      spawnDist: 20,
      grabRange: 0.8,
      shoveFree: 6,            // alternate A/D this many times to shove it off…
      biteAfter: 2.5,          // …before it bites (a hit, and it lets go)
      shoveDist: 4,
      staggerTime: 1.5,        // after a shove
      shotStagger: 0.8,        // a bullet stops it for a moment; it doesn't die
      bodyRadius: 0.45,
    },
  },
  sim: {
    dt: 1 / 60,
  },
};

export const TAU = Math.PI * 2;
export { DEG };
