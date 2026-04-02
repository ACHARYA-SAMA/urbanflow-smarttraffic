import {
  VEH_SPEED, VEH_ACCEL, VEH_BRAKE, MAX_QUEUE,
  BASE_SPAWN_MS, SPAWN_JITTER_MS, VIOLATOR_CHANCE,
  CAR_COLORS, EMG_CFG,
} from './constants.js';
import { ibox, cx, cy, vehL, vehW, followGap, laneOff, stopCoord, spawnPt, snapLane } from './geometry.js';

let _vid = 0;
const uid   = () => ++_vid;
const plate = () => {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const r = () => L[Math.floor(Math.random() * L.length)];
  const n = () => Math.floor(Math.random() * 10);
  return `${r()}${r()}${n()}${n()}-${r()}${r()}${n()}`;
};

export class VehicleManager {
  constructor() {
    this.vehicles    = [];
    this.emgVehicles = [];

    // ── Rotating spawn system (FIX #2) ──────────────────────────────────
    // Each direction gets its own independent countdown timer.
    // All four timers start staggered so spawns don't all happen at once.
    this._spawnTimers = [
      BASE_SPAWN_MS * 0.1,
      BASE_SPAWN_MS * 0.35,
      BASE_SPAWN_MS * 0.6,
      BASE_SPAWN_MS * 0.85,
    ];

    // Siren blink
    this._sirenMs = 0;

    // Callbacks (set by SimulationEngine)
    this.onViolation = null;
    this.onAccident  = null;
  }

  // ── Public getters ─────────────────────────────────────────────────────────

  /** Vehicles waiting per direction [0..3] (not yet past stop-line) */
  waitingCounts(CW, CH) {
    const c = [0, 0, 0, 0];
    for (const v of this.vehicles) if (!v.passed && !v._wrecked) c[v.dir]++;
    return c;
  }

  get allVehicles() { return [...this.vehicles, ...this.emgVehicles]; }
  get sirenBlink()  { return this._sirenMs < 300; }

  // ── Resize ─────────────────────────────────────────────────────────────────

  onResize(CW, CH) {
    for (const v of this.vehicles)    snapLane(v, CW, CH);
    for (const v of this.emgVehicles) snapLane(v, CW, CH);
  }

  // ── Spawning ───────────────────────────────────────────────────────────────

  /**
   * maybeSpawn — balanced rotating spawn system.
   * Each of the 4 directions has its own timer.
   * Spawn interval is density-adjusted so busier settings spawn faster.
   * Blocked if lane queue ≥ MAX_QUEUE (FIX #3).
   */
  maybeSpawn(dt, dens, CW, CH) {
    for (let d = 0; d < 4; d++) {
      this._spawnTimers[d] -= dt;
      if (this._spawnTimers[d] > 0) continue;

      // Count vehicles already waiting on this lane
      const queueLen = this.vehicles.filter(v => v.dir === d && !v.passed && !v._wrecked).length;

      if (queueLen < MAX_QUEUE) {
        this._spawnOne(d, CW, CH);
      }

      // Density factor: higher dens[d] → shorter interval → more vehicles
      // dens range 1-16; factor goes from 1.0 (sparse) down to 0.4 (dense)
      const df       = Math.max(0.4, 1 - dens[d] / 26);
      const interval = BASE_SPAWN_MS * df + Math.random() * SPAWN_JITTER_MS;
      this._spawnTimers[d] = interval;
    }
  }

  _spawnOne(dir, CW, CH) {
    const { px, py } = spawnPt(dir, CW, CH);
    this.vehicles.push({
      id:         uid(),
      dir,
      px, py,
      speed:      0,            // FIX #5: starts at rest, accelerates gradually
      col:        CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      passed:     false,
      waiting:    false,
      L:          vehL(CW, CH),
      W:          vehW(CW, CH),
      stopAt:     stopCoord(dir, CW, CH),
      isViolator: Math.random() < VIOLATOR_CHANCE,
      plate:      plate(),
      detected:   false,
      _wrecked:   false,
      _wreckedTtl: 0,
    });
  }

  spawnEmergency(type, dir, CW, CH) {
    const cfg = EMG_CFG[type];
    const off = laneOff(dir, CW, CH);
    const far = Math.max(CW, CH) * 0.54;
    let px, py, vx = 0, vy = 0;
    if      (dir === 0) { px = cx(CW)+off; py = cy(CH)-far; vy =  cfg.spd; }
    else if (dir === 2) { px = cx(CW)+off; py = cy(CH)+far; vy = -cfg.spd; }
    else if (dir === 1) { px = cx(CW)+far; py = cy(CH)+off; vx = -cfg.spd; }
    else                { px = cx(CW)-far; py = cy(CH)+off; vx =  cfg.spd; }
    const ev = {
      id: uid(), type, dir, px, py, vx, vy,
      col: cfg.col, roof: cfg.roof, s1: cfg.s1, s2: cfg.s2, label: cfg.label,
      passed: false, speed: cfg.spd,
      L: Math.round((Math.min(CW,CH)*0.10) * 0.42),
      W: Math.round((Math.min(CW,CH)*0.10) * 0.18),
      plate: plate(),
    };
    this.emgVehicles.push(ev);
    return ev;
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  /**
   * update — FIX #5, #6, #7
   * Order per vehicle:
   *   1. Snap cross-axis (lane discipline)
   *   2. Determine shouldStop (signal + follow distance)
   *   3. Smooth acceleration / braking
   *   4. Violation detection
   *   5. Move
   *   6. Mark passed / despawn (FIX #4)
   */
  update(dt, getSig, CW, CH) {
    const sec = dt / 1000;
    this._sirenMs = (this._sirenMs + dt) % 600;

    // ── Regular vehicles ──────────────────────────────────────────────────
    const dead = [];
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // Wrecked: count down then remove
      if (v._wrecked) { if (--v._wreckedTtl <= 0) dead.push(i); continue; }

      // 1. Snap to lane (prevents drift after resize or floating-point creep)
      this._snapLane(v, CW, CH);

      const sig = getSig(v.dir);

      // 2. Determine shouldStop ────────────────────────────────────────────
      let shouldStop = false;

      // Signal: stop if red/yellow and approaching stop-line
      if (!v.passed && !v.isViolator && (sig === 'red' || sig === 'yellow')) {
        const s = v.stopAt;
        if (v.dir === 0 && v.py + v.L/2 >= s - 1) shouldStop = true;
        if (v.dir === 2 && v.py - v.L/2 <= s + 1) shouldStop = true;
        if (v.dir === 1 && v.px - v.L/2 <= s + 1) shouldStop = true;
        if (v.dir === 3 && v.px + v.L/2 >= s - 1) shouldStop = true;
      }

      // Follow distance: stop if too close to vehicle ahead
      if (!shouldStop) {
        const gap = this._gapAhead(i, CW, CH);
        if (gap < 0) shouldStop = true;
      }

      v.waiting = shouldStop;

      // 3. Smooth accel / brake ────────────────────────────────────────────
      const target = shouldStop ? 0 : (v.isViolator ? VEH_SPEED * 1.45 : VEH_SPEED);
      if (v.speed < target) v.speed = Math.min(target, v.speed + VEH_ACCEL * sec);
      else                  v.speed = Math.max(target, v.speed - VEH_BRAKE * sec);

      // 4. Violation detection ──────────────────────────────────────────────
      if (!v.passed && !v.detected && v.isViolator) {
        const s2 = getSig(v.dir);
        if (s2 === 'red' || s2 === 'yellow') {
          let cross = false;
          const s = v.stopAt;
          if (v.dir === 0 && v.py + v.L/2 >= s - 1) cross = true;
          if (v.dir === 2 && v.py - v.L/2 <= s + 1) cross = true;
          if (v.dir === 1 && v.px - v.L/2 <= s + 1) cross = true;
          if (v.dir === 3 && v.px + v.L/2 >= s - 1) cross = true;
          if (cross) { v.detected = true; this.onViolation?.(v); }
        }
      }

      // 5. Move ──────────────────────────────────────────────────────────────
      if (v.speed > 0.5) {
        if      (v.dir === 0) v.py += v.speed * sec;
        else if (v.dir === 2) v.py -= v.speed * sec;
        else if (v.dir === 1) v.px -= v.speed * sec;
        else                  v.px += v.speed * sec;
      }

      // 6. Mark passed ────────────────────────────────────────────────────────
      if (!v.passed) {
        const ib = ibox(CW, CH);
        if (v.dir === 0 && v.py > cy(CH)+ib) v.passed = true;
        if (v.dir === 2 && v.py < cy(CH)-ib) v.passed = true;
        if (v.dir === 1 && v.px < cx(CW)-ib) v.passed = true;
        if (v.dir === 3 && v.px > cx(CW)+ib) v.passed = true;
      }

      // FIX #4: despawn when 140px past canvas edge
      const M = 140;
      if (v.px < -M || v.px > CW+M || v.py < -M || v.py > CH+M) dead.push(i);
    }
    for (let i = dead.length-1; i >= 0; i--) this.vehicles.splice(dead[i], 1);

    // ── Emergency vehicles ─────────────────────────────────────────────────
    const edead = [];
    for (let i = 0; i < this.emgVehicles.length; i++) {
      const v = this.emgVehicles[i];
      this._snapLane(v, CW, CH);
      v.px += v.vx * sec; v.py += v.vy * sec;
      if (!v.passed) {
        const ib = ibox(CW, CH);
        if (v.dir === 0 && v.py > cy(CH)+ib) v.passed = true;
        if (v.dir === 2 && v.py < cy(CH)-ib) v.passed = true;
        if (v.dir === 1 && v.px < cx(CW)-ib) v.passed = true;
        if (v.dir === 3 && v.px > cx(CW)+ib) v.passed = true;
      }
      const M = 140;
      if (v.px < -M || v.px > CW+M || v.py < -M || v.py > CH+M) edead.push(i);
    }
    for (let i = edead.length-1; i >= 0; i--) this.emgVehicles.splice(edead[i], 1);
  }

  // ── Collision detection ────────────────────────────────────────────────────

  detectCollisions(recentSet) {
    const all = this.allVehicles;
    for (let i = 0; i < all.length; i++) {
      for (let j = i+1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.dir === b.dir || a._wrecked || b._wrecked) continue;
        const ox = Math.abs(a.px-b.px) < (a.L/2+b.L/2)*0.80;
        const oy = Math.abs(a.py-b.py) < (a.W/2+b.W/2)*0.80;
        if (!ox || !oy) continue;
        const key = `${Math.min(a.id,b.id)}_${Math.max(a.id,b.id)}`;
        if (recentSet.has(key)) continue;
        recentSet.add(key);
        setTimeout(() => recentSet.delete(key), 5000);
        a._wrecked = true; a._wreckedTtl = 90; a.speed = 0; a.waiting = true;
        b._wrecked = true; b._wreckedTtl = 90; b.speed = 0; b.waiting = true;
        this.onAccident?.({ a, b });
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _snapLane(v, CW, CH) {
    const off = laneOff(v.dir, CW, CH);
    if (v.dir === 0 || v.dir === 2) v.px = cx(CW) + off;
    else                             v.py = cy(CH) + off;
    v.stopAt = stopCoord(v.dir, CW, CH);
  }

  _gapAhead(idx, CW, CH) {
    const v  = this.vehicles[idx];
    const fg = followGap(CW, CH);
    let min  = Infinity;
    for (let j = 0; j < this.vehicles.length; j++) {
      if (j === idx || this.vehicles[j].dir !== v.dir || this.vehicles[j]._wrecked) continue;
      const o = this.vehicles[j];
      let gap;
      if      (v.dir === 0) gap = (o.py - v.py) - v.L - fg;
      else if (v.dir === 2) gap = (v.py - o.py) - v.L - fg;
      else if (v.dir === 1) gap = (v.px - o.px) - v.L - fg;
      else                  gap = (o.px - v.px) - v.L - fg;
      if (gap < v.L * 3) min = Math.min(min, gap);
    }
    return min;
  }
}
