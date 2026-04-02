import { ROAD_WIDTH_RATIO, STOP_GAP, VEH_LENGTH_RATIO, VEH_WIDTH_RATIO, FOLLOW_GAP_RATIO } from './constants.js';

export const rw        = (CW, CH) => Math.round(Math.min(CW, CH) * ROAD_WIDTH_RATIO);
export const lw        = (CW, CH) => rw(CW, CH) / 2;
export const ibox      = (CW, CH) => rw(CW, CH);
export const cx        = (CW)     => CW / 2;
export const cy        = (CH)     => CH / 2;
export const vehL      = (CW, CH) => Math.round(rw(CW, CH) * VEH_LENGTH_RATIO);
export const vehW      = (CW, CH) => Math.round(rw(CW, CH) * VEH_WIDTH_RATIO);
export const followGap = (CW, CH) => Math.round(rw(CW, CH) * FOLLOW_GAP_RATIO);

/**
 * Cross-axis offset from canvas centre for a vehicle's lane.
 * dir 0 (N→S): x = cx - lw/2
 * dir 2 (S→N): x = cx + lw/2
 * dir 1 (E→W): y = cy - lw/2
 * dir 3 (W→E): y = cy + lw/2
 */
export const laneOff = (dir, CW, CH) => {
  const off = lw(CW, CH) / 2;
  return [-off, -off, off, off][dir];
};

/**
 * Stop-line coordinate (the travel axis).
 * Vertical dirs → py value.  Horizontal dirs → px value.
 */
export const stopCoord = (dir, CW, CH) => {
  const gap = ibox(CW, CH) + STOP_GAP + vehL(CW, CH) / 2;
  if (dir === 0) return cy(CH) - gap;   // N→S stops above intersection
  if (dir === 2) return cy(CH) + gap;   // S→N stops below intersection
  if (dir === 1) return cx(CW) + gap;   // E→W stops right of centre
  return cx(CW) - gap;                   // W→E stops left of centre
};

/**
 * Canonical spawn position (far off-screen edge, correct lane).
 */
export const spawnPt = (dir, CW, CH) => {
  const off = laneOff(dir, CW, CH);
  const far = Math.max(CW, CH) * 0.54;
  if (dir === 0) return { px: cx(CW)+off, py: cy(CH)-far };
  if (dir === 2) return { px: cx(CW)+off, py: cy(CH)+far };
  if (dir === 1) return { px: cx(CW)+far, py: cy(CH)+off };
  return               { px: cx(CW)-far, py: cy(CH)+off };
};

/** Re-snap vehicle to its lane after a resize. */
export const snapLane = (v, CW, CH) => {
  const off = laneOff(v.dir, CW, CH);
  if (v.dir === 0 || v.dir === 2) v.px = cx(CW) + off;
  else                             v.py = cy(CH) + off;
  v.stopAt = stopCoord(v.dir, CW, CH);
};
