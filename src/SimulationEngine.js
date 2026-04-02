import { SignalController } from './SignalController.js';
import { VehicleManager }   from './VehicleManager.js';
import { EMG_CFG, EMG_AUTO_MS, EMG_AUTO_JITTER_MS, ROAD_NAMES } from './constants.js';

/**
 * SimulationEngine — top-level orchestrator.
 *
 * Exact per-frame order (as specified in brief):
 *   1. updateVehiclePositions()   → vehicles.update()
 *   2. calculateTrafficDensity()  → vehicles.waitingCounts()
 *   3. chooseNextGreenRoad()      → signals.update()  [density-based]
 *   4. updateSignalTimers()       → (inside signals.update)
 *   5. renderSimulation()         → called externally via React canvas
 */
export class SimulationEngine {
  constructor() {
    this.signals  = new SignalController();
    this.vehicles = new VehicleManager();

    this.CW = 800;
    this.CH = 600;

    this.running = false;
    this.uptime  = 0;   // total simulation ms

    // Density display values (loosely track waiting counts + jitter for UI)
    this.dens = [10, 4, 8, 3];
    this.maxD = 16;

    // Collision de-dupe
    this._recentAcc = new Set();

    // Emergency auto-spawn
    this._emgTimer = EMG_AUTO_MS + Math.random() * EMG_AUTO_JITTER_MS;
    this.emgCount  = 0;
    this.emgByType = { police: 0, ambulance: 0, fire: 0 };

    // Callbacks
    this.onPhaseSwitch = null;  // ({ dir, road, load, dur, cycle })
    this.onViolation   = null;  // (vehicle)
    this.onAccident    = null;  // ({ a, b })
    this.onEmergency   = null;  // ({ type, dir, road, ... })

    // Wire child callbacks
    this._wireCallbacks();
  }

  _wireCallbacks() {
    this.vehicles.onViolation = (v)   => this.onViolation?.(v);
    this.vehicles.onAccident  = (acc) => this._handleAccident(acc);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() { this.running = true; }
  pause() { this.running = false; }

  resize(CW, CH) {
    this.CW = CW; this.CH = CH;
    this.vehicles.onResize(CW, CH);
  }

  /**
   * tick — call every animation frame.
   * Runs the 5-step update cycle in the specified order.
   */
  tick(dt) {
    if (!this.running) return;
    const ms = Math.min(dt, 50);
    this.uptime += ms;

    // ── 1. Update vehicle positions ─────────────────────────────────────
    const getSig = (dir) => this.signals.getSignal(dir);
    this.vehicles.update(ms, getSig, this.CW, this.CH);

    // ── 2. Calculate traffic density ────────────────────────────────────
    const waiting = this.vehicles.waitingCounts(this.CW, this.CH);

    // Nudge dens slightly for UI liveliness
    for (let d = 0; d < 4; d++) {
      if (Math.random() < 0.003)
        this.dens[d] = Math.max(1, Math.min(this.maxD, this.dens[d] + (Math.random() > 0.5 ? 1 : -1)));
    }

    // ── 3 & 4. Choose next green road + update signal timers ─────────────
    const event = this.signals.update(ms, waiting, this.uptime);
    if (event) this.onPhaseSwitch?.(event);

    // ── Spawn (balanced, all 4 roads, capacity-checked) ──────────────────
    this.vehicles.maybeSpawn(ms, this.dens, this.CW, this.CH);

    // ── Collision detection ───────────────────────────────────────────────
    this.vehicles.detectCollisions(this._recentAcc);

    // ── Emergency auto-spawn ──────────────────────────────────────────────
    this._emgTimer -= ms;
    if (this._emgTimer <= 0) {
      this._emgTimer = EMG_AUTO_MS + Math.random() * EMG_AUTO_JITTER_MS;
      const types = Object.keys(EMG_CFG);
      this.spawnEmergency(
        types[Math.floor(Math.random() * types.length)],
        Math.floor(Math.random() * 4),
      );
    }

    // ── 5. renderSimulation() is handled by SimCanvas (React) ───────────
  }

  spawnEmergency(type, dir) {
    const ev = this.vehicles.spawnEmergency(type, dir, this.CW, this.CH);
    this.signals.activateOverride(dir);
    this.emgCount++;
    this.emgByType[type] = (this.emgByType[type] || 0) + 1;
    this.onEmergency?.({ ...ev, type, dir, road: ROAD_NAMES[dir] });
  }

  reset() {
    this.running = false;
    this.uptime  = 0;
    this.signals  = new SignalController();
    this.vehicles = new VehicleManager();
    this._wireCallbacks();
    this._recentAcc.clear();
    this.emgCount  = 0;
    this.emgByType = { police: 0, ambulance: 0, fire: 0 };
    this._emgTimer = EMG_AUTO_MS + Math.random() * EMG_AUTO_JITTER_MS;
    this.dens = [10, 4, 8, 3];
  }

  // ── Convenience getters for UI ─────────────────────────────────────────────
  getSignal(dir)    { return this.signals.getSignal(dir); }
  waitingCounts()   { return this.vehicles.waitingCounts(this.CW, this.CH); }
  get cycleCount()  { return this.signals.cycleCount; }
  get activeDir()   { return this.signals.activeDir; }
  get phase()       { return this.signals.phase; }
  get remaining()   { return this.signals.remaining; }
  get overrideActive(){ return this.signals.overrideActive; }
  get overrideDir() { return this.signals.overrideDir; }
  get allVehicles() { return this.vehicles.allVehicles; }
  get sirenBlink()  { return this.vehicles.sirenBlink; }

  // ── Internal ───────────────────────────────────────────────────────────────
  _handleAccident({ a, b }) {
    setTimeout(() => {
      if (this.running) {
        this.spawnEmergency('ambulance', Math.floor(Math.random() * 4));
        this.spawnEmergency('police',    (a.dir + 2) % 4);
      }
    }, 2200);
    this.onAccident?.({ a, b });
  }
}
