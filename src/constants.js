// ── World geometry ratios ──────────────────────────────────────────────────
export const ROAD_WIDTH_RATIO  = 0.10;   // road arm width = 10% of min(CW,CH)
export const STOP_GAP          = 6;      // px gap between stop line and intersection box

// ── Vehicle physics ────────────────────────────────────────────────────────
export const VEH_SPEED         = 88;     // cruise speed px/s
export const VEH_ACCEL         = 170;    // acceleration px/s²
export const VEH_BRAKE         = 420;    // braking deceleration px/s²
export const FOLLOW_GAP_RATIO  = 0.08;   // min follow gap as fraction of road width
export const VEH_LENGTH_RATIO  = 0.30;
export const VEH_WIDTH_RATIO   = 0.14;

// ── Spawning ───────────────────────────────────────────────────────────────
export const MAX_QUEUE          = 7;     // max waiting vehicles per lane
export const BASE_SPAWN_MS      = 2200;  // base ms between spawn attempts per lane
export const SPAWN_JITTER_MS    = 900;   // random ms jitter added to interval
export const VIOLATOR_CHANCE    = 0.12;  // fraction of vehicles that run red lights

// ── Signal timing ──────────────────────────────────────────────────────────
export const MIN_GREEN_MS       = 4000;
export const MAX_GREEN_MS       = 14000;
export const YELLOW_MS          = 1800;
export const ALL_RED_MS         = 400;
export const GREEN_PER_VEH_MS   = 240;   // extra green ms per queued vehicle
export const MAX_STARVATION_MS  = 22000; // max time a road can wait before forced green

// ── Emergency vehicles ─────────────────────────────────────────────────────
export const EMG_OVERRIDE_MS    = 5500;
export const EMG_AUTO_MS        = 18000;
export const EMG_AUTO_JITTER_MS = 7000;

// ── Directions ─────────────────────────────────────────────────────────────
// 0 = North→South  (py increases)
// 1 = East→West    (px decreases)
// 2 = South→North  (py decreases)
// 3 = West→East    (px increases)
export const ROAD_NAMES = ['A', 'B', 'C', 'D'];

export const CAR_COLORS = [
  '#00ff88','#00d4ff','#ff6b00','#e040fb','#ffea00',
  '#00bcd4','#ff4081','#69f0ae','#ff8f00','#40c4ff',
  '#a0ff40','#ff40a0','#c0ff40','#40ffd4',
];

export const EMG_CFG = {
  police:    { col:'#1a44ee', roof:'#0d2fcc', s1:'#ff2244', s2:'#4488ff', label:'POLICE',    spd:132 },
  ambulance: { col:'#f2f2f2', roof:'#d8d8d8', s1:'#ff3333', s2:'#ff3333', label:'AMBULANCE', spd:126 },
  fire:      { col:'#cc2000', roof:'#aa1100', s1:'#ff6600', s2:'#ffcc00', label:'FIRE TRUCK', spd:120 },
};
