// The Quiet Gallery — tuning, colours and level layouts.
// Every number the game runs on lives here, so a balance pass touches one file.
// Field: 1280x720, border wall 24px thick. Levels are hand-designed from the
// prose spec: walls, display cases, statues and crates block movement and sight.

export const FIELD = { w: 1280, h: 720, wall: 24 };

export const TUNING = {
  walkSpeed: 168, // px/s
  sneakSpeed: 86,
  playerRadius: 13,
  coneRange: 250,
  coneHalfDeg: 32,
  bumpDist: 42, // a guard spots you on contact, any angle
  catchDist: 27, // a chasing guard catches you inside this
  chaseSpeed: 152,
  guardPause: 1.0, // seconds a guard waits at each waypoint
  suspicionBase: 0.45, // per second while seen
  suspicionClose: 1.85, // extra per second, scaled by closeness
  sneakFactor: 0.5, // suspicion rise while sneaking
  shadowFactor: 0.55, // suspicion rise while standing in shadow
  suspicionDecay: 0.38, // per second while unseen
  loseSightTime: 2.5, // seconds unseen before a chase becomes a search
  searchTime: 2.0, // seconds a guard searches your last-seen spot
  investigateTime: 1.4, // seconds a guard looks around a noise spot
  noiseWalk: 84, // px: guards inside this hear walking
  noiseSneak: 26, // px: guards inside this hear sneaking
  parSeconds: 75, // finish a level under par for the bonus
  sealScore: 100,
  levelScore: 250,
  parBonus: 250,
  ghostBonus: 400, // finish a level without ever being spotted
  lives: 3,
  sealPickupDist: 26,
  exitReachDist: 30,
};

export const COLORS = {
  floor: '#241f33',
  floorAlt: '#2a2438',
  grid: '#332c47',
  trim: '#8a6d3b',
  wall: '#17131f',
  wallTop: '#4a3f5e',
  shadow: 'rgba(10, 16, 48, 0.55)',
  caseFrame: '#8a6d3b',
  caseGlass: '#274b63',
  caseGlint: '#9fc7e0',
  statue: '#8d8578',
  statueBase: '#5d564a',
  crate: '#6e4f2a',
  crateDark: '#4e3517',
  coneCalm: 'rgba(212, 175, 55, 0.30)',
  coneWary: 'rgba(232, 130, 40, 0.38)',
  coneHot: 'rgba(214, 48, 49, 0.42)',
  guard: '#2c3e63',
  guardHelm: '#d4af37',
  player: '#2ec4b6',
  playerDark: '#1d7a70',
  seal: '#f4b942',
  sealGlow: 'rgba(244, 185, 66, 0.35)',
  exitLocked: '#6b7280',
  exitOpen: '#3fae5a',
  hudText: '#e8e2d0',
  hudDim: '#9a94a8',
  panel: 'rgba(16, 13, 26, 0.94)',
  panelBorder: '#d4af37',
};

// rects are {x, y, w, h}; points are {x, y}.
// Guards patrol a lane between a and b, pausing TUNING.guardPause at each end.
export const LEVELS = [
  {
    name: 'I — The Ember Gallery',
    hint: 'Stay out of the yellow cones. Hold SHIFT to sneak.',
    start: { x: 90, y: 630 },
    exit: { x: 1210, y: 640 },
    walls: [
      { x: 412, y: 120, w: 16, h: 130 },
      { x: 560, y: 422, w: 340, h: 16 },
    ],
    cases: [
      { x: 192, y: 154, w: 96, h: 52 },
      { x: 572, y: 154, w: 96, h: 52 },
      { x: 982, y: 154, w: 96, h: 52 },
    ],
    statues: [
      { x: 212, y: 492, w: 56, h: 56 },
      { x: 612, y: 492, w: 56, h: 56 },
      { x: 1012, y: 492, w: 56, h: 56 },
    ],
    crates: [
      { x: 536, y: 321, w: 48, h: 48 },
      { x: 736, y: 321, w: 48, h: 48 },
    ],
    shadows: [
      { x: 24, y: 24, w: 220, h: 180 },
      { x: 1036, y: 516, w: 220, h: 180 },
    ],
    seals: [
      { x: 110, y: 110 },
      { x: 640, y: 300 },
      { x: 1140, y: 610 },
    ],
    guards: [
      { a: { x: 300, y: 300 }, b: { x: 980, y: 300 }, speed: 62 },
      { a: { x: 950, y: 140 }, b: { x: 950, y: 560 }, speed: 62 },
    ],
  },
  {
    name: 'II — Sculpture Court',
    hint: 'Three guards now. The middle gap is the only way through.',
    start: { x: 90, y: 90 },
    exit: { x: 1210, y: 150 }, // top-right, kept clear of the HUD's score block
    walls: [
      { x: 632, y: 72, w: 16, h: 210 },
      { x: 632, y: 420, w: 16, h: 220 },
      { x: 120, y: 352, w: 160, h: 16 },
    ],
    cases: [
      { x: 452, y: 120, w: 96, h: 52 },
      { x: 732, y: 548, w: 96, h: 52 },
    ],
    statues: [
      { x: 152, y: 142, w: 56, h: 56 },
      { x: 1072, y: 142, w: 56, h: 56 },
      { x: 152, y: 542, w: 56, h: 56 },
      { x: 1072, y: 542, w: 56, h: 56 },
    ],
    crates: [
      { x: 180, y: 456, w: 48, h: 48 },
      { x: 1020, y: 220, w: 48, h: 48 },
    ],
    shadows: [
      { x: 24, y: 24, w: 200, h: 160 },
      { x: 1056, y: 536, w: 200, h: 160 },
      { x: 560, y: 300, w: 160, h: 120 },
    ],
    seals: [
      { x: 110, y: 620 },
      { x: 1150, y: 110 },
      { x: 640, y: 360 },
    ],
    guards: [
      { a: { x: 240, y: 300 }, b: { x: 1040, y: 300 }, speed: 68 },
      { a: { x: 320, y: 120 }, b: { x: 320, y: 600 }, speed: 68 },
      { a: { x: 960, y: 600 }, b: { x: 960, y: 120 }, speed: 74 },
    ],
  },
  {
    name: 'III — The Vault Antechamber',
    hint: 'Four guards, no safe lane. Patience is the only way in.',
    start: { x: 90, y: 360 },
    exit: { x: 1210, y: 360 },
    walls: [
      { x: 632, y: 280, w: 16, h: 160 },
      { x: 520, y: 352, w: 240, h: 16 },
      { x: 1080, y: 280, w: 16, h: 160 },
    ],
    cases: [
      { x: 152, y: 96, w: 96, h: 52 },
      { x: 1032, y: 96, w: 96, h: 52 },
      { x: 152, y: 572, w: 96, h: 52 },
      { x: 1032, y: 572, w: 96, h: 52 },
    ],
    statues: [
      { x: 612, y: 122, w: 56, h: 56 },
      { x: 612, y: 542, w: 56, h: 56 },
    ],
    crates: [
      { x: 276, y: 276, w: 48, h: 48 },
      { x: 956, y: 396, w: 48, h: 48 },
    ],
    shadows: [
      { x: 24, y: 516, w: 220, h: 180 },
      { x: 1036, y: 24, w: 220, h: 180 },
    ],
    seals: [
      { x: 640, y: 250 },
      { x: 130, y: 110 },
      { x: 1150, y: 620 },
    ],
    guards: [
      { a: { x: 200, y: 200 }, b: { x: 1100, y: 200 }, speed: 80 },
      { a: { x: 200, y: 520 }, b: { x: 1100, y: 520 }, speed: 80 },
      { a: { x: 420, y: 120 }, b: { x: 420, y: 600 }, speed: 76 },
      { a: { x: 860, y: 120 }, b: { x: 860, y: 600 }, speed: 76 },
    ],
  },
];
