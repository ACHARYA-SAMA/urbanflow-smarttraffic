import {
  MIN_GREEN_MS, MAX_GREEN_MS, YELLOW_MS, ALL_RED_MS,
  GREEN_PER_VEH_MS, MAX_STARVATION_MS, ROAD_NAMES,
} from './constants.js';

export const PHASE = { GREEN: 'GREEN', YELLOW: 'YELLOW', ALL_RED: 'ALL_RED' };

/**
 * SignalController — density-based adaptive traffic light controller.
 *
 * Core rules:
 *  • Counts vehicles WAITING (not yet past stop-line) per direction.
 *  • Selects the BUSIEST road for green — never gives green to an empty road
 *    while another road has queued vehicles.
 *  • Keeps green until queue clears OR max time reached.
 *  • Fairness: after MAX_STARVATION_MS a starved road is forced to the top.
 *  • After yellow → ALL_RED clearance → re-evaluate → new green.
 */
export class SignalController {
  constructor() {
    this.phase     = PHASE.GREEN;
    this.activeDir = 0;        // direction (or axis rep.) currently green
    this.timer     = 0;        // ms elapsed in current phase
    this.phaseDur  = MIN_GREEN_MS;
    this.cycleCount    = 142;
    this.totalUptime   = 0;

    // Emergency override
    this.overrideActive = false;
    this.overrideDir    = -1;
    this.overrideMs     = 0;

    // Fairness: track when each direction last got green
    this.lastGreenAt = [0, 0, 0, 0];
  }

  // ── Public: what colour is direction `dir`? ──────────────────────────────
  getSignal(dir) {
    if (this.overrideActive) {
      return this._sameAxis(dir, this.overrideDir) ? 'green' : 'red';
    }
    if (this.phase === PHASE.ALL_RED)  return 'red';
    if (this.phase === PHASE.YELLOW)   return this._sameAxis(dir, this.activeDir) ? 'yellow' : 'red';
    return this._sameAxis(dir, this.activeDir) ? 'green' : 'red';
  }

  /**
   * update — call once per frame.
   * @param {number}   dt      delta-time ms
   * @param {number[]} waiting vehicle counts waiting per direction [0..3]
   * @param {number}   uptime  total simulation ms (for starvation calc)
   * @returns {{ type:'phase_switch', ... } | null}
   */
  update(dt, waiting, uptime) {
    this.totalUptime = uptime;

    // ── Emergency override ──────────────────────────────────────────────
    if (this.overrideActive) {
      this.overrideMs -= dt;
      if (this.overrideMs <= 0) {
        this.overrideActive = false;
        this.overrideDir    = -1;
        return this._startGreen(this._chooseBest(waiting, uptime), waiting);
      }
      return null;
    }

    this.timer += dt;

    // ── GREEN ───────────────────────────────────────────────────────────
    if (this.phase === PHASE.GREEN) {
      const axisWaiting = this._axisWaiting(this.activeDir, waiting);
      const queueCleared = axisWaiting === 0;
      const minMet       = this.timer >= MIN_GREEN_MS;
      const maxReached   = this.timer >= this.phaseDur;

      if (maxReached || (queueCleared && minMet)) {
        this.phase = PHASE.YELLOW;
        this.timer = 0;
      }
      return null;
    }

    // ── YELLOW ──────────────────────────────────────────────────────────
    if (this.phase === PHASE.YELLOW) {
      if (this.timer >= YELLOW_MS) {
        this.phase = PHASE.ALL_RED;
        this.timer = 0;
      }
      return null;
    }

    // ── ALL_RED clearance ────────────────────────────────────────────────
    if (this.phase === PHASE.ALL_RED) {
      if (this.timer >= ALL_RED_MS) {
        const next = this._chooseBest(waiting, uptime);
        return this._startGreen(next, waiting);
      }
      return null;
    }

    return null;
  }

  // ── Emergency override ───────────────────────────────────────────────────
  activateOverride(dir) {
    this.overrideActive = true;
    this.overrideDir    = dir;
    this.overrideMs     = 5500;
    this.phase     = PHASE.GREEN;
    this.activeDir = dir;
    this.timer     = 0;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  _sameAxis(a, b) {
    return (a === 0 || a === 2) === (b === 0 || b === 2);
  }

  _axisWaiting(dir, waiting) {
    return (dir === 0 || dir === 2)
      ? waiting[0] + waiting[2]
      : waiting[1] + waiting[3];
  }

  /**
   * Choose the next direction to receive green.
   * Priority order:
   *   1. Starvation rescue (any direction waiting > MAX_STARVATION_MS with vehicles)
   *   2. Busiest axis (NS vs EW total waiting count)
   *   3. If tie, busiest single direction
   *   4. If all empty, rotate to opposite axis
   */
  _chooseBest(waiting, uptime) {
    // 1. Starvation check (skip current axis)
    let starvedDir = -1, maxWait = 0;
    for (let d = 0; d < 4; d++) {
      if (this._sameAxis(d, this.activeDir)) continue; // don't re-starve same axis
      const waited = uptime - this.lastGreenAt[d];
      if (waited > MAX_STARVATION_MS && waiting[d] > 0 && waited > maxWait) {
        maxWait   = waited;
        starvedDir = d;
      }
    }
    if (starvedDir !== -1) return starvedDir;

    const nsTotal = waiting[0] + waiting[2];
    const ewTotal = waiting[1] + waiting[3];
    const total   = nsTotal + ewTotal;

    // 4. All empty — rotate to opposite axis
    if (total === 0) {
      return this._sameAxis(this.activeDir, 0) ? 1 : 0;
    }

    // 2 & 3. Busiest axis → busiest single direction on that axis
    if (nsTotal >= ewTotal) {
      // Prefer to switch axis if we're already NS and EW has vehicles
      if (this._sameAxis(this.activeDir, 0) && ewTotal > 0) {
        return waiting[1] >= waiting[3] ? 1 : 3;
      }
      return waiting[0] >= waiting[2] ? 0 : 2;
    } else {
      if (this._sameAxis(this.activeDir, 1) && nsTotal > 0) {
        return waiting[0] >= waiting[2] ? 0 : 2;
      }
      return waiting[1] >= waiting[3] ? 1 : 3;
    }
  }

  _startGreen(dir, waiting) {
    this.phase     = PHASE.GREEN;
    this.activeDir = dir;
    this.timer     = 0;
    this.cycleCount++;

    // Mark both directions on this axis as having received green now
    if (dir === 0 || dir === 2) { this.lastGreenAt[0] = this.totalUptime; this.lastGreenAt[2] = this.totalUptime; }
    else                        { this.lastGreenAt[1] = this.totalUptime; this.lastGreenAt[3] = this.totalUptime; }

    const load = this._axisWaiting(dir, waiting);
    this.phaseDur = Math.min(MAX_GREEN_MS, MIN_GREEN_MS + load * GREEN_PER_VEH_MS);

    return {
      type:  'phase_switch',
      dir,
      road:  ROAD_NAMES[dir],
      load,
      dur:   Math.round(this.phaseDur / 1000),
      cycle: this.cycleCount,
    };
  }

  // ── Getters for UI ────────────────────────────────────────────────────────
  get remaining() {
    if (this.overrideActive)         return Math.max(0, this.overrideMs);
    if (this.phase === PHASE.YELLOW) return Math.max(0, YELLOW_MS  - this.timer);
    if (this.phase === PHASE.ALL_RED)return Math.max(0, ALL_RED_MS - this.timer);
    return Math.max(0, this.phaseDur - this.timer);
  }

  get isYellow()  { return this.phase === PHASE.YELLOW; }
  get isAllRed()  { return this.phase === PHASE.ALL_RED; }
  get isGreen()   { return this.phase === PHASE.GREEN; }
}
