// ════════════════════════════════════════════════════════
//  Urban Flow — TrafficEngine v3.1
//  Pure JavaScript class. No React dependencies.
//  All simulation bugs fixed:
//    BUG 1 — vehicles stopping on green (follow-gap + signal stop guard)
//    BUG 2 — vehicles leaving road (lane locking)
//    BUG 3 — fullscreen misalignment (DPR-aware resize, vehicle rescale)
//    BUG 4 — timer frozen (sigTimer always reset with sigDur)
// ════════════════════════════════════════════════════════

export class TrafficEngine {
  constructor() {
    // Canvas
    this.canvas = null;
    this.ctx = null;
    this.CW = 800;
    this.CH = 600;
    this._dpr = 1;

    // Loop
    this.animId = null;
    this.lastTS = 0;
    this.frameN = 0;
    this.simRunning = false;

    // ── Signal state ──────────────────────────────────
    // BUG 4 FIX: sigTimer is always reset to 0 when sigDur changes.
    this.sigState = 'NS_GREEN';
    this.sigTimer = 0;
    this.sigDur = 7000;

    // Density per road [A, B, C, D]
    this.dens = [8, 4, 6, 3];
    this.maxD = 20;

    // Signal cycle counter
    this.cycleN = 0;

    // ── Override ──────────────────────────────────────
    this.overrideActive = false;
    this.overrideDir = -1;
    this.overrideMs = 0;
    this.manualOverrideDir = -1;
    this.manualOverrideMs = 0;

    // ── Vehicles ──────────────────────────────────────
    this.vehs = [];
    this.emgVehs = [];
    this.vid = 0;
    this.spawnTimers = [0, 0, 0, 0];

    // ── Emergency ─────────────────────────────────────
    this.emgCount = 0;
    this.emgByType = { police: 0, ambulance: 0, fire: 0 };
    this.emgAutoTimer = 23000;
    this.sirenTick = 0;

    // ── Violations ────────────────────────────────────
    this.violations = [];
    this.vioCount = 0;
    this.vioByRoad = [0, 0, 0, 0];
    this.vioFlashes = [];

    // ── Accidents ─────────────────────────────────────
    this.accidents = [];
    this.accCount = 0;
    this.accInjured = 0;
    this.accCleared = 0;
    this.responseTimes = [];
    this.crashFlashes = [];
    this.recentAccidents = new Set();

    // ── Environment ───────────────────────────────────
    this.envFuel = 0;
    this.envCO2 = 0;
    this.simTimeSeconds = 0;
    this._envTick = 0;

    // ── World geometry ─────────────────────────────────
    this.buildings = [];
    this.trees = [];

    // ── Callbacks ─────────────────────────────────────
    this.callbacks = {};

    // ── Constants ─────────────────────────────────────
    this.VEH_SPD = 85;
    this.VIO_CHANCE = 0.11;
    this.MAX_PER_DIR = 9;
    this.EMG_SPAWN_MS = 18000;
    this.STOP_GAP = 6;
    this.VEH_TYPES = ['sedan','sedan','sedan','suv','suv','truck','van','bus'];
    this.CAR_COLS = [
      '#00ff88','#00d4ff','#ff6b00','#e040fb','#ffea00',
      '#00bcd4','#ff4081','#69f0ae','#ff8f00','#40c4ff',
      '#a0ff40','#c0ff40','#40ffd4','#ff8040','#80d0ff'
    ];
    this.EMG_CFG = {
      police:    { col:'#1a44ee', roof:'#0d2fcc', s1:'#ff2244', s2:'#4488ff', label:'POLICE',    spd:130 },
      ambulance: { col:'#f0f0f0', roof:'#d0d0d0', s1:'#ff3333', s2:'#ff3333', label:'AMBULANCE', spd:125 },
      fire:      { col:'#cc2000', roof:'#aa1100', s1:'#ff6600', s2:'#ffcc00', label:'FIRE TRUCK', spd:118 },
    };
    this.BLDG_COLS = ['#0e1a2e','#0c1822','#101e2c','#0b1520','#0d2035','#091618'];
    this.BLDG_ROOF = ['#1a2d44','#16283a','#1c3040','#142230','#1f2e48','#112420'];
    this.TREE_COLS = ['#0d2e0d','#0b260b','#0f380f','#102810','#163416'];

    this._bannerTO = null;
  }

  // ══════════════════════════════════════════
  //  GEOMETRY HELPERS
  // ══════════════════════════════════════════
  cx()  { return this.CW / 2; }
  cy()  { return this.CH / 2; }
  RW()  { return Math.round(Math.min(this.CW, this.CH) * 0.11); }
  IBOX(){ return Math.round(this.RW() * 1.05); }
  VL()  { return Math.round(this.RW() * 0.32); }
  VW()  { return Math.round(this.RW() * 0.148); }
  // BUG 1 FIX: increased follow gap so vehicles have comfortable spacing
  FG()  { return Math.round(this.RW() * 0.09) + 4; }

  getLaneCenter(dir) {
    const off = this.RW() / 4;
    return [-off, -off, off, off][dir];
  }

  // The precise pixel coordinate where a vehicle's CENTER must stop
  stopCoord(dir) {
    const gap = this.IBOX() + this.STOP_GAP + this.VL() / 2;
    if (dir === 0) return this.cy() - gap;
    if (dir === 2) return this.cy() + gap;
    if (dir === 1) return this.cx() + gap;
    return this.cx() - gap;
  }

  // ══════════════════════════════════════════
  //  SETUP
  // ══════════════════════════════════════════
  attachCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._sizeCanvas();
    this.initWorld();
  }

  setCallbacks(cbs) { this.callbacks = { ...cbs }; }

  emit(event, data) {
    if (this.callbacks[event]) this.callbacks[event](data);
  }

  // ── Canvas sizing ─────────────────────────────────
  // BUG 3 FIX: DPR-aware sizing, retina-sharp rendering.
  _sizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._dpr = dpr;
    const wrap = this.canvas.parentElement;
    const cssW = Math.max(280, wrap.clientWidth - 4);
    const cssH = Math.round(cssW * 0.58);
    this.canvas.style.width  = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width  = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.CW = cssW;
    this.CH = cssH;
  }

  // BUG 3 FIX: On resize, rescale existing vehicle positions proportionally
  // so they stay aligned to the road grid.
  resize() {
    if (!this.canvas) return;
    const oldCX = this.cx(), oldCY = this.cy();
    const oldRW = this.RW();
    this._sizeCanvas();
    const newCX = this.cx(), newCY = this.cy();

    // Rescale vehicle positions relative to new intersection center
    for (const v of [...this.vehs, ...this.emgVehs]) {
      if (v.dir === 0 || v.dir === 2) {
        // N/S: recompute laneX, rescale py relative to cy
        v.laneX = newCX + this.getLaneCenter(v.dir);
        v.px = v.laneX;
        v.py = newCY + (v.py - oldCY);
        v.stopAt = this.stopCoord(v.dir);
        v.L = Math.round(this.VL() * v._sf);
        v.W = Math.round(this.VW() * v._wf);
      } else {
        // E/W: recompute laneY, rescale px relative to cx
        v.laneY = newCY + this.getLaneCenter(v.dir);
        v.py = v.laneY;
        v.px = newCX + (v.px - oldCX);
        v.stopAt = this.stopCoord(v.dir);
        v.L = Math.round(this.VL() * v._sf);
        v.W = Math.round(this.VW() * v._wf);
      }
    }

    this.initWorld();
    if (!this.simRunning) this.drawStatic();
  }

  destroy() {
    this.simRunning = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
  }

  // ══════════════════════════════════════════
  //  WORLD GENERATION
  // ══════════════════════════════════════════
  initWorld() {
    this.buildings = [];
    this.trees = [];
    const X = this.cx(), Y = this.cy(), R = this.RW(), IB = this.IBOX();
    const SW = Math.round(R * 0.28), G = 5;

    const quads = [
      { x: G,      y: G,      w: X-IB-R/2-SW-G,     h: Y-IB-R/2-SW-G },
      { x: X+IB+R/2+SW+G, y: G,      w: this.CW-X-IB-R/2-SW-G*2, h: Y-IB-R/2-SW-G },
      { x: G,      y: Y+IB+R/2+SW+G, w: X-IB-R/2-SW-G,     h: this.CH-Y-IB-R/2-SW-G*2 },
      { x: X+IB+R/2+SW+G, y: Y+IB+R/2+SW+G, w: this.CW-X-IB-R/2-SW-G*2, h: this.CH-Y-IB-R/2-SW-G*2 },
    ];
    const rng = (a, b) => Math.random() * (b - a) + a;
    quads.forEach(q => {
      if (q.w < 16 || q.h < 16) return;
      let bx = q.x;
      while (bx < q.x + q.w - 12) {
        let by = q.y;
        while (by < q.y + q.h - 12) {
          const bw = Math.min(rng(12, Math.min(48, q.w * 0.6)), q.x + q.w - bx - G);
          const bh = Math.min(rng(12, Math.min(48, q.h * 0.6)), q.y + q.h - by - G);
          if (bw > 10 && bh > 10) {
            const ci = Math.floor(Math.random() * this.BLDG_COLS.length);
            this.buildings.push({ x: bx, y: by, w: bw, h: bh, col: this.BLDG_COLS[ci], roof: this.BLDG_ROOF[ci] });
          }
          by += bh + G;
        }
        bx += rng(14, 52);
      }
    });

    const TR = Math.max(3, Math.round(R * 0.065));
    const TS = Math.round(R * 0.42);
    const edges = [
      { ax:'x', fx:X-R/2-SW*0.55, fy:G,      ty:Y-IB },
      { ax:'x', fx:X+R/2+SW*0.55, fy:G,      ty:Y-IB },
      { ax:'x', fx:X-R/2-SW*0.55, fy:Y+IB,   ty:this.CH-G },
      { ax:'x', fx:X+R/2+SW*0.55, fy:Y+IB,   ty:this.CH-G },
      { ax:'y', fx:Y-R/2-SW*0.55, fy:G,      ty:X-IB },
      { ax:'y', fx:Y+R/2+SW*0.55, fy:G,      ty:X-IB },
      { ax:'y', fx:Y-R/2-SW*0.55, fy:X+IB,   ty:this.CW-G },
      { ax:'y', fx:Y+R/2+SW*0.55, fy:X+IB,   ty:this.CW-G },
    ];
    edges.forEach(e => {
      for (let p = e.fy + TS / 2; p < e.ty; p += TS) {
        this.trees.push(e.ax === 'x' ? { x: e.fx, y: p, r: TR } : { x: p, y: e.fx, r: TR });
      }
    });
  }

  // ══════════════════════════════════════════
  //  D. TRAFFIC LOGIC — SIGNALS
  // ══════════════════════════════════════════
  getSig(dir) {
    if (this.overrideActive) {
      const ns = dir === 0 || dir === 2;
      const ew = dir === 1 || dir === 3;
      const oNS = this.overrideDir === 0 || this.overrideDir === 2;
      const oEW = this.overrideDir === 1 || this.overrideDir === 3;
      return (oNS && ns) || (oEW && ew) ? 'green' : 'red';
    }
    if (this.manualOverrideDir >= 0) {
      const mNS = this.manualOverrideDir === 0 || this.manualOverrideDir === 2;
      const mEW = this.manualOverrideDir === 1 || this.manualOverrideDir === 3;
      const ns = dir === 0 || dir === 2;
      const ew = dir === 1 || dir === 3;
      return (mNS && ns) || (mEW && ew) ? 'green' : 'red';
    }
    switch (this.sigState) {
      case 'NS_GREEN':  return (dir === 0 || dir === 2) ? 'green' : 'red';
      case 'NS_YELLOW': return (dir === 0 || dir === 2) ? 'yellow' : 'red';
      case 'EW_GREEN':  return (dir === 1 || dir === 3) ? 'green' : 'red';
      case 'EW_YELLOW': return (dir === 1 || dir === 3) ? 'yellow' : 'red';
    }
    return 'red';
  }

  tickSignals(dt) {
    if (this.overrideActive) return;
    if (this.manualOverrideDir >= 0) {
      this.manualOverrideMs -= dt;
      if (this.manualOverrideMs <= 0) { this.manualOverrideDir = -1; this.manualOverrideMs = 0; }
      return;
    }
    this.sigTimer += dt;
    if (this.sigTimer < this.sigDur) return;
    // BUG 4 FIX: sigTimer always reset when sigDur changes
    this.sigTimer = 0;
    const nsLoad = this.dens[0] + this.dens[2];
    const ewLoad = this.dens[1] + this.dens[3];
    if      (this.sigState === 'NS_GREEN')  { this.sigState = 'NS_YELLOW'; this.sigDur = 1800; }
    else if (this.sigState === 'NS_YELLOW') { this.sigState = 'EW_GREEN';  this.sigDur = Math.min(14000, 5000 + ewLoad * 220); this.cycleN++; this._onPhaseSwitch(); }
    else if (this.sigState === 'EW_GREEN')  { this.sigState = 'EW_YELLOW'; this.sigDur = 1800; }
    else if (this.sigState === 'EW_YELLOW') { this.sigState = 'NS_GREEN';  this.sigDur = Math.min(14000, 5000 + nsLoad * 220); this.cycleN++; this._onPhaseSwitch(); }
  }

  _onPhaseSwitch() {
    const ns   = this.sigState === 'NS_GREEN' || this.sigState === 'NS_YELLOW';
    const road = ns ? 'A & C' : 'B & D';
    const load = ns ? this.dens[0] + this.dens[2] : this.dens[1] + this.dens[3];
    const dur  = Math.round(this.sigDur / 1000);
    this.emit('onLog', { road, load, dur, cycle: this.cycleN, ns, time: new Date().toLocaleTimeString() });
    this.emit('onStateChange', this._buildState());
    if (load > 18) this.emit('onAlert', { sev: 'critical', title: '🔴 HEAVY CONGESTION', body: `Road ${road}: ${load} vehicles queued.` });
    else if (load > 12) this.emit('onAlert', { sev: 'warn', title: '🟡 MODERATE CONGESTION', body: `Road ${road}: ${load} vehicles. Monitor.` });
  }

  // ── Manual controls ───────────────────────────────
  forceGreen(dir) {
    if (!this.simRunning) return false;
    this.manualOverrideDir = dir;
    this.manualOverrideMs  = 8000;
    this.emit('onAlert', { sev: 'emg', title: `🟢 ROAD ${'ABCD'[dir]} FORCED GREEN`, body: 'Manual override active for 8 seconds.' });
    this.emit('onStateChange', this._buildState());
    return true;
  }

  resetSignals() {
    this.manualOverrideDir = -1; this.manualOverrideMs = 0;
    this.overrideActive = false; this.overrideDir = -1; this.overrideMs = 0;
    this.sigState = 'NS_GREEN';
    // BUG 4 FIX: reset sigTimer when sigDur changes
    this.sigTimer = 0; this.sigDur = 7000;
    this.emit('onAlert', { sev: 'info', title: '⟳ Signals Reset', body: 'All signals returned to AI control.' });
    this.emit('onStateChange', this._buildState());
  }

  triggerEmgMode() {
    if (!this.simRunning) return;
    const dir = Math.floor(Math.random() * 4);
    this.spawnEmgVeh('police', dir);
    this.spawnEmgVeh('ambulance', (dir + 2) % 4);
  }

  // ══════════════════════════════════════════
  //  VEHICLE SPAWNING
  // ══════════════════════════════════════════
  _genPlate() {
    const L = 'ABCEFGHJKLMNPQRSTUVWXYZ';
    const r = () => L[Math.floor(Math.random() * L.length)];
    const n = () => Math.floor(Math.random() * 10);
    return `${r()}${r()}${n()}${n()}-${r()}${r()}${n()}`;
  }

  spawnVeh(dir) {
    const col   = this.CAR_COLS[Math.floor(Math.random() * this.CAR_COLS.length)];
    const vtype = this.VEH_TYPES[Math.floor(Math.random() * this.VEH_TYPES.length)];
    const lane  = this.getLaneCenter(dir);
    const far   = Math.max(this.CW, this.CH) * 0.56;

    const sf = { sedan:1, suv:1.1, truck:1.25, van:1.15, bus:1.5  }[vtype] || 1;
    const wf = { sedan:1, suv:1.1, truck:1.15, van:1.1,  bus:1.12 }[vtype] || 1;
    const L  = Math.round(this.VL() * sf);
    const W  = Math.round(this.VW() * wf);

    let px, py, vx, vy, laneX, laneY;
    if      (dir === 0) { laneX = this.cx() + lane; laneY = null; px = laneX; py = this.cy() - far; vx = 0; vy = this.VEH_SPD; }
    else if (dir === 2) { laneX = this.cx() + lane; laneY = null; px = laneX; py = this.cy() + far; vx = 0; vy = -this.VEH_SPD; }
    else if (dir === 1) { laneY = this.cy() + lane; laneX = null; px = this.cx() + far; py = laneY; vx = -this.VEH_SPD; vy = 0; }
    else                { laneY = this.cy() + lane; laneX = null; px = this.cx() - far; py = laneY; vx = this.VEH_SPD;  vy = 0; }

    this.vehs.push({
      id: this.vid++, dir, px, py, vx, vy, col, vtype,
      laneX, laneY, // BUG 2 FIX: lane anchor coords
      passed: false, waiting: false,
      L, W, _sf: sf, _wf: wf,
      stopAt: this.stopCoord(dir),
      isViolator: Math.random() < this.VIO_CHANCE,
      plate: this._genPlate(), detected: false,
    });
  }

  spawnEmgVeh(type, dir) {
    if (!this.simRunning) return;
    const cfg  = this.EMG_CFG[type];
    const lane = this.getLaneCenter(dir);
    const far  = Math.max(this.CW, this.CH) * 0.56;
    let px, py, vx, vy, laneX, laneY;
    if      (dir === 0) { laneX = this.cx() + lane; laneY = null; px = laneX; py = this.cy() - far; vx = 0;          vy = cfg.spd; }
    else if (dir === 2) { laneX = this.cx() + lane; laneY = null; px = laneX; py = this.cy() + far; vx = 0;          vy = -cfg.spd; }
    else if (dir === 1) { laneY = this.cy() + lane; laneX = null; px = this.cx() + far; py = laneY; vx = -cfg.spd;   vy = 0; }
    else                { laneY = this.cy() + lane; laneX = null; px = this.cx() - far; py = laneY; vx = cfg.spd;    vy = 0; }

    const ev = {
      id: this.vid++, type, dir, px, py, vx, vy,
      laneX, laneY,
      col: cfg.col, passed: false,
      L: Math.round(this.RW() * 0.44), W: Math.round(this.RW() * 0.19),
      _sf: 1.4, _wf: 0.6,
      speed: cfg.spd, plate: this._genPlate(),
    };
    this.emgVehs.push(ev);
    this._activateOverride(ev, type);
  }

  maybeSpawn(dt) {
    for (let d = 0; d < 4; d++) {
      this.spawnTimers[d] -= dt;
      if (this.spawnTimers[d] <= 0) {
        const waiting = this.vehs.filter(v => v.dir === d && v.waiting).length;
        if (waiting < this.MAX_PER_DIR) {
          this.spawnVeh(d);
          this.spawnTimers[d] = Math.max(700, 2200 - this.dens[d] * 80) + Math.random() * 600;
        } else {
          this.spawnTimers[d] = 600;
        }
      }
    }
  }

  // ══════════════════════════════════════════
  //  VEHICLE UPDATES (ALL BUGS FIXED)
  // ══════════════════════════════════════════
  updateVehs(dt) {
    const sec = dt / 1000;
    const FG  = this.FG();

    for (let i = this.vehs.length - 1; i >= 0; i--) {
      const v = this.vehs[i];

      // Wrecked vehicles: fade out and remove
      if (v._wrecked) {
        v._wreckedTtl = (v._wreckedTtl || 80) - 1;
        if (v._wreckedTtl <= 0) this.vehs.splice(i, 1);
        continue;
      }

      const sig = this.getSig(v.dir);
      let stop  = false;

      // ── BUG 1 FIX: Signal stop ──────────────────────
      // Only stop if APPROACHING stop line (center hasn't crossed it yet).
      // Prevents vehicles inside the intersection from being re-stopped.
      if (!v.passed && !v.isViolator && (sig === 'red' || sig === 'yellow')) {
        const s = v.stopAt;
        if      (v.dir === 0 && v.py < s  && v.py + v.L / 2 >= s - 2) stop = true;
        else if (v.dir === 2 && v.py > s  && v.py - v.L / 2 <= s + 2) stop = true;
        else if (v.dir === 1 && v.px > s  && v.px - v.L / 2 <= s + 2) stop = true;
        else if (v.dir === 3 && v.px < s  && v.px + v.L / 2 >= s - 2) stop = true;
      }

      // ── BUG 1 FIX: Follow-gap ───────────────────────
      // Correct ahead detection + bumper-to-bumper gap calculation.
      // Old code used center-to-center which could flag vehicles BEHIND as blockers.
      if (!stop) {
        for (let j = 0; j < this.vehs.length; j++) {
          if (j === i || this.vehs[j].dir !== v.dir || this.vehs[j]._wrecked) continue;
          const o = this.vehs[j];
          let gap = Infinity, ahead = false;
          if      (v.dir === 0) { ahead = o.py > v.py; if (ahead) gap = (o.py - o.L / 2) - (v.py + v.L / 2); }
          else if (v.dir === 2) { ahead = o.py < v.py; if (ahead) gap = (v.py - v.L / 2) - (o.py + o.L / 2); }
          else if (v.dir === 1) { ahead = o.px < v.px; if (ahead) gap = (v.px - v.L / 2) - (o.px + o.L / 2); }
          else                  { ahead = o.px > v.px; if (ahead) gap = (o.px - o.L / 2) - (v.px + v.L / 2); }
          if (ahead && gap < FG) { stop = true; break; }
        }
      }

      // ── BUG 1 FIX: Derive v.waiting fresh every frame ──
      // Previously waiting was only set to true, never cleared → permanent stall.
      v.waiting = stop;

      // ── BUG 1 FIX: Green safety net ─────────────────
      // If signal is green and stop was triggered (shouldn't be), force-release
      // unless a real vehicle ahead is blocking.
      if (stop && sig === 'green') {
        let hasBlocker = false;
        for (let j = 0; j < this.vehs.length; j++) {
          if (j === i || this.vehs[j].dir !== v.dir || this.vehs[j]._wrecked) continue;
          const o = this.vehs[j];
          let gap = Infinity, ahead = false;
          if      (v.dir === 0) { ahead = o.py > v.py; if (ahead) gap = (o.py - o.L / 2) - (v.py + v.L / 2); }
          else if (v.dir === 2) { ahead = o.py < v.py; if (ahead) gap = (v.py - v.L / 2) - (o.py + o.L / 2); }
          else if (v.dir === 1) { ahead = o.px < v.px; if (ahead) gap = (v.px - v.L / 2) - (o.px + o.L / 2); }
          else                  { ahead = o.px > v.px; if (ahead) gap = (o.px - o.L / 2) - (v.px + v.L / 2); }
          if (ahead && gap < FG) { hasBlocker = true; break; }
        }
        if (!hasBlocker) { stop = false; v.waiting = false; }
      }

      // Violation detection
      if (!v.passed && !v.detected && v.isViolator) {
        if (sig === 'red' || sig === 'yellow') {
          const s = v.stopAt;
          let crossed = false;
          if      (v.dir === 0 && v.py + v.L / 2 >= s - 1) crossed = true;
          else if (v.dir === 2 && v.py - v.L / 2 <= s + 1) crossed = true;
          else if (v.dir === 1 && v.px - v.L / 2 <= s + 1) crossed = true;
          else if (v.dir === 3 && v.px + v.L / 2 >= s - 1) crossed = true;
          if (crossed) { v.detected = true; this._triggerViolation(v); }
        }
      }

      // ── Move ──────────────────────────────────────────
      if (!stop) {
        const spd = v.isViolator ? this.VEH_SPD * 1.4 : this.VEH_SPD;
        v.px += (v.vx / this.VEH_SPD) * spd * sec;
        v.py += (v.vy / this.VEH_SPD) * spd * sec;
      }

      // ── BUG 2 FIX: Lane lock ──────────────────────────
      // Prevent lateral drift by snapping the perpendicular axis.
      if (v.laneX !== null && v.laneX !== undefined) v.px = v.laneX;
      if (v.laneY !== null && v.laneY !== undefined) v.py = v.laneY;

      // Mark passed once center exits the intersection box
      if (!v.passed) {
        const IB = this.IBOX();
        if      (v.dir === 0 && v.py > this.cy() + IB) v.passed = true;
        else if (v.dir === 2 && v.py < this.cy() - IB) v.passed = true;
        else if (v.dir === 1 && v.px < this.cx() - IB) v.passed = true;
        else if (v.dir === 3 && v.px > this.cx() + IB) v.passed = true;
      }

      // Despawn off-screen
      if (v.px < -160 || v.px > this.CW + 160 || v.py < -160 || v.py > this.CH + 160) {
        this.vehs.splice(i, 1);
      }
    }

    // Expire vio flashes
    for (let i = this.vioFlashes.length - 1; i >= 0; i--) {
      this.vioFlashes[i].ttl -= dt / 16;
      if (this.vioFlashes[i].ttl <= 0) this.vioFlashes.splice(i, 1);
    }
  }

  updateEmgVehs(dt) {
    this.sirenTick = (this.sirenTick + dt) % 600;
    const sec = dt / 1000;
    for (let i = this.emgVehs.length - 1; i >= 0; i--) {
      const v = this.emgVehs[i];
      v.px += v.vx * sec;
      v.py += v.vy * sec;

      // BUG 2 FIX: lane lock for emergency vehicles too
      if (v.laneX !== null && v.laneX !== undefined) v.px = v.laneX;
      if (v.laneY !== null && v.laneY !== undefined) v.py = v.laneY;

      if (!v.passed) {
        const IB = this.IBOX();
        if (v.dir === 0 && v.py > this.cy() + IB) v.passed = true;
        if (v.dir === 2 && v.py < this.cy() - IB) v.passed = true;
        if (v.dir === 1 && v.px < this.cx() - IB) v.passed = true;
        if (v.dir === 3 && v.px > this.cx() + IB) v.passed = true;
      }
      if (v.px < -200 || v.px > this.CW + 200 || v.py < -200 || v.py > this.CH + 200) {
        this.emgVehs.splice(i, 1);
      }
    }

    if (this.overrideActive) {
      this.overrideMs -= dt;
      if (this.overrideMs <= 0) {
        this.overrideActive = false;
        this.overrideDir = -1;
        this.sigState = 'NS_GREEN';
        // BUG 4 FIX: reset sigTimer when sigDur changes
        this.sigTimer = 0;
        this.sigDur = Math.min(14000, 5000 + (this.dens[0] + this.dens[2]) * 220);
      }
    }

    this.emgAutoTimer -= dt;
    if (this.emgAutoTimer <= 0) {
      this.emgAutoTimer = this.EMG_SPAWN_MS + Math.random() * 6000;
      const types = ['police', 'ambulance', 'fire'];
      this.spawnEmgVeh(types[Math.floor(Math.random() * types.length)], Math.floor(Math.random() * 4));
    }
  }

  // ══════════════════════════════════════════
  //  COLLISION DETECTION
  // ══════════════════════════════════════════
  checkCollisions() {
    const all = [...this.vehs, ...this.emgVehs];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.dir === b.dir || a._crashed || b._crashed) continue;
        if (
          Math.abs(a.px - b.px) < (a.L / 2 + b.L / 2) * 0.78 &&
          Math.abs(a.py - b.py) < (a.W / 2 + b.W / 2) * 0.78
        ) {
          const key = `${Math.min(a.id, b.id)}_${Math.max(a.id, b.id)}`;
          if (this.recentAccidents.has(key)) continue;
          this.recentAccidents.add(key);
          setTimeout(() => this.recentAccidents.delete(key), 5000);
          a._crashed = true; b._crashed = true;
          this._triggerAccident(a, b);
        }
      }
    }
    // Expire crash flashes
    for (let i = this.crashFlashes.length - 1; i >= 0; i--) {
      this.crashFlashes[i].ttl--;
      if (this.crashFlashes[i].ttl <= 0) this.crashFlashes.splice(i, 1);
    }
  }

  // ══════════════════════════════════════════
  //  EVENT HANDLERS
  // ══════════════════════════════════════════
  _triggerViolation(v) {
    this.vioCount++;
    this.vioByRoad[v.dir]++;
    if (this.violations.length >= 15) this.violations.length = 14;
    const entry = { plate: v.plate, road: 'ABCD'[v.dir], dir: v.dir, time: new Date().toLocaleTimeString() };
    this.violations.unshift(entry);
    if (this.vioFlashes.length < 8) this.vioFlashes.push({ px: v.px, py: v.py, ttl: 80, plate: v.plate });
    this.emit('onViolation', { ...entry, vioCount: this.vioCount, vioByRoad: [...this.vioByRoad] });
    this.emit('onAlert', { sev: 'warn', title: `⚠ VIOLATION — Road ${entry.road}`, body: `${entry.plate} · Red light infraction detected` });
  }

  _triggerAccident(a, b) {
    this.accCount++;
    const injured = 1 + Math.floor(Math.random() * 3);
    this.accInjured += injured;
    const cpx = (a.px + b.px) / 2, cpy = (a.py + b.py) / 2;
    const resp = Math.round(3 + Math.random() * 5);
    this.responseTimes.push(resp);
    if (this.responseTimes.length > 20) this.responseTimes.shift();
    for (let k = 0; k < 4; k++) {
      this.crashFlashes.push({
        px: cpx + (Math.random() - 0.5) * 18,
        py: cpy + (Math.random() - 0.5) * 18,
        ttl: 65 + k * 5, maxTtl: 65 + k * 5, r: 5 + k * 4
      });
    }
    if (this.crashFlashes.length > 16) this.crashFlashes.length = 16;
    if (!a.type) { a.vx = 0; a.vy = 0; a.waiting = true; a._wrecked = true; }
    if (!b.type) { b.vx = 0; b.vy = 0; b.waiting = true; b._wrecked = true; }
    const entry = {
      id: this.accCount,
      roadA: 'ABCD'[a.dir], roadB: 'ABCD'[b.dir],
      plates: [a.plate || '??', b.plate || '??'],
      injured, time: new Date().toLocaleTimeString(), resp,
    };
    if (this.accidents.length >= 10) this.accidents.length = 9;
    this.accidents.unshift(entry);
    setTimeout(() => {
      if (this.simRunning) {
        this.spawnEmgVeh('ambulance', Math.floor(Math.random() * 4));
        this.spawnEmgVeh('police', (a.dir + 2) % 4);
      }
      this.accCleared++;
      this.emit('onAccident', this._accState());
    }, 2200);
    this.emit('onAccident', this._accState());
    this.emit('onAlert', { sev: 'critical', title: `💥 COLLISION`, body: `Road ${entry.roadA}×${entry.roadB} · ${injured} injured · Services dispatched` });
    // Flash overlay signal
    this.emit('onCrashFlash', {});
  }

  _activateOverride(ev, type) {
    this.overrideActive = true;
    this.overrideDir = ev.dir;
    this.overrideMs = 5500;
    const ns = ev.dir === 0 || ev.dir === 2;
    this.sigState = ns ? 'NS_GREEN' : 'EW_GREEN';
    // BUG 4 FIX: reset sigTimer when sigDur changes
    this.sigTimer = 0;
    this.sigDur = 99999;
    this.emgCount++;
    this.emgByType[type]++;
    const entry = { type, plate: ev.plate, dir: ev.dir, road: 'ABCD'[ev.dir], time: new Date().toLocaleTimeString() };
    this.emit('onEmergency', { ...entry, emgCount: this.emgCount, emgByType: { ...this.emgByType } });
    this.emit('onAlert', { sev: 'emg', title: `🚨 EMERGENCY — ${this.EMG_CFG[type].label}`, body: `Road ${entry.road} · Green corridor activated` });
    this.emit('onStateChange', this._buildState());
  }

  // ══════════════════════════════════════════
  //  ENVIRONMENT
  // ══════════════════════════════════════════
  tickEnvironment(dt) {
    if (!this.simRunning) return;
    this._envTick += dt;
    if (this._envTick < 1000) return;
    this._envTick = 0;
    this.simTimeSeconds++;
    const rate = this.vehs.length * 0.0025;
    this.envFuel += rate;
    this.envCO2  += rate * 2.3;
    const waitSaved = Math.min(95, Math.round(this.simTimeSeconds * 0.08 + this.cycleN * 0.3));
    const flowOpt   = this.vehs.length + this.emgVehs.length;
    this.emit('onEnv', { fuel: this.envFuel, co2: this.envCO2, wait: waitSaved, flow: flowOpt });
  }

  // ══════════════════════════════════════════
  //  STATE BUILDERS
  // ══════════════════════════════════════════
  _buildState() {
    const isNS = this.sigState === 'NS_GREEN' || this.sigState === 'NS_YELLOW';
    const rem  = Math.max(0, Math.ceil((this.sigDur - this.sigTimer) / 1000));
    return {
      sigState: this.sigState,
      sigs:     [0, 1, 2, 3].map(d => this.getSig(d)),
      dens:     [...this.dens],
      cycleN:   this.cycleN,
      vehCount: this.vehs.length + this.emgVehs.length,
      overrideActive: this.overrideActive,
      overrideDir:    this.overrideDir,
      overrideType:   this.overrideActive ? this._lastOverrideType : null,
      manualDir:      this.manualOverrideDir,
      manualRemMs:    this.manualOverrideMs,
      timerRem:       rem,
      timerRoad:      this.overrideActive ? `🚨 Road ${'ABCD'[this.overrideDir]}` :
                      this.manualOverrideDir >= 0 ? `👮 Road ${'ABCD'[this.manualOverrideDir]}` :
                      isNS ? 'Road A & C' : 'Road B & D',
    };
  }

  _accState() {
    const avg = this.responseTimes.length
      ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
      : null;
    return {
      accCount: this.accCount, accInjured: this.accInjured,
      accCleared: this.accCleared, avgResp: avg,
      accidents: this.accidents.slice(0, 8),
    };
  }

  // ══════════════════════════════════════════
  //  MAIN LOOP
  // ══════════════════════════════════════════
  start() {
    if (this.simRunning) return;
    this.simRunning = true;
    this.lastTS = performance.now();
    this.animId = requestAnimationFrame(ts => this._loop(ts));
    this.emit('onAlert', { sev: 'info', title: '▶ Simulation Started', body: 'Urban Flow AI actively managing signals.' });
    this.emit('onStateChange', this._buildState());
  }

  pause() {
    this.simRunning = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
  }

  reset() {
    this.pause();
    this.vehs = []; this.emgVehs = []; this.vid = 0;
    this.sigState = 'NS_GREEN'; this.sigTimer = 0; this.sigDur = 7000;
    this.spawnTimers = [0, 0, 0, 0];
    this.overrideActive = false; this.overrideDir = -1; this.overrideMs = 0;
    this.manualOverrideDir = -1; this.manualOverrideMs = 0;
    this.emgAutoTimer = this.EMG_SPAWN_MS + 5000;
    this.emgCount = 0; this.emgByType = { police:0, ambulance:0, fire:0 };
    this.vioFlashes = []; this.violations = []; this.vioCount = 0; this.vioByRoad = [0,0,0,0];
    this.crashFlashes = []; this.accidents = []; this.accCount = 0;
    this.accInjured = 0; this.accCleared = 0; this.responseTimes = [];
    this.recentAccidents.clear();
    this.envFuel = 0; this.envCO2 = 0; this.simTimeSeconds = 0; this._envTick = 0;
    this.cycleN = 0; this.frameN = 0;
    // Density: slight random variation on reset
    this.dens = [6 + Math.floor(Math.random()*6), 2+Math.floor(Math.random()*4), 4+Math.floor(Math.random()*6), 2+Math.floor(Math.random()*4)];
    this.initWorld();
    this.drawStatic();
    this.emit('onReset', {});
    this.emit('onStateChange', this._buildState());
  }

  _loop(ts) {
    if (!this.simRunning) return;
    const dt = Math.min(ts - this.lastTS, 50);
    this.lastTS = ts;
    this.frameN++;

    // ── UPDATE ORDER (as specified in requirements) ──
    this.tickSignals(dt);        // 1. updateSignals
    this.maybeSpawn(dt);
    this.updateVehs(dt);         // 2. updateVehicles
    this.updateEmgVehs(dt);
    this.checkCollisions();      // 3. detectCollisions
    this.tickEnvironment(dt);    // 4. updateTimer / env

    // Density drift
    if (this.frameN % 180 === 0) {
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.4) this.dens[i] = Math.max(1, Math.min(this.maxD, this.dens[i] + (Math.random() > 0.5 ? 1 : -1)));
      }
    }

    // 5. renderScene
    this._render();

    if (this.frameN % 7 === 0) this.emit('onStateChange', this._buildState());
    this.animId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  drawStatic() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.CW, this.CH);
    this._drawScene();
  }

  // ══════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════
  _render() {
    this.ctx.clearRect(0, 0, this.CW, this.CH);
    this._drawScene();
    [...this.vehs, ...this.emgVehs]
      .sort((a, b) => a.py - b.py)
      .forEach(v => v.type ? this._drawEmgCar(v) : this._drawCar(v));
    this._drawCrashFlashes();
    this._drawVioFlashes();
    this._drawHUD();
  }

  _rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  _shade(hex, a) {
    let n = parseInt(hex.replace('#','').padEnd(6,'0'),16) || 0;
    return '#' + [n>>16,(n>>8)&255,n&255].map(c => Math.max(0,Math.min(255,c+a)).toString(16).padStart(2,'0')).join('');
  }

  _drawScene() {
    const ctx = this.ctx;
    const X = this.cx(), Y = this.cy(), R = this.RW(), IB = this.IBOX();
    const SW = Math.round(R * 0.28);

    ctx.fillStyle = '#030d0c'; ctx.fillRect(0,0,this.CW,this.CH);
    ctx.strokeStyle = 'rgba(0,212,255,0.022)'; ctx.lineWidth = 1;
    const gs = Math.round(this.CW / 18);
    for (let x=0; x<=this.CW; x+=gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.CH); ctx.stroke(); }
    for (let y=0; y<=this.CH; y+=gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.CW,y); ctx.stroke(); }

    // Buildings
    this.buildings.forEach(b => {
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(b.x+4,b.y+4,b.w,b.h);
      ctx.fillStyle=b.col; ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle=b.roof; ctx.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);
      const wSz=Math.max(2,Math.min(5,b.w*.18)), wPad=Math.max(2,b.w*.1), wGap=wSz+wPad;
      for (let wx=b.x+wPad; wx<b.x+b.w-wSz; wx+=wGap) {
        for (let wy=b.y+wPad; wy<b.y+b.h-wSz; wy+=wGap) {
          if (Math.sin(wx*.3+wy*.5)>0) {
            ctx.fillStyle=`rgba(0,${Math.random()>.6?'255,136':'212,255'},.18)`;
            ctx.fillRect(wx,wy,wSz,wSz*1.3);
          }
        }
      }
      ctx.strokeStyle='rgba(0,212,255,0.07)'; ctx.lineWidth=.7; ctx.strokeRect(b.x,b.y,b.w,b.h);
    });

    // Sidewalks
    ctx.fillStyle='#0e1e2e';
    ctx.fillRect(X-R/2-SW,0,SW,Y-IB); ctx.fillRect(X+R/2,0,SW,Y-IB);
    ctx.fillRect(X-R/2-SW,Y+IB,SW,this.CH-Y-IB); ctx.fillRect(X+R/2,Y+IB,SW,this.CH-Y-IB);
    ctx.fillRect(0,Y-R/2-SW,X-IB,SW); ctx.fillRect(0,Y+R/2,X-IB,SW);
    ctx.fillRect(X+IB,Y-R/2-SW,this.CW-X-IB,SW); ctx.fillRect(X+IB,Y+R/2,this.CW-X-IB,SW);

    // Trees
    this.trees.forEach(t => {
      const tr = t.r || 3;
      ctx.fillStyle='#3d2010'; ctx.beginPath(); ctx.ellipse(t.x,t.y+tr*.3,tr*.26,tr*.38,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(t.x+2,t.y+2,tr,tr*.78,0,0,Math.PI*2); ctx.fill();
      const gi=Math.floor(Math.abs(Math.sin(t.x+t.y))*this.TREE_COLS.length);
      ctx.fillStyle=this.TREE_COLS[gi%this.TREE_COLS.length]; ctx.beginPath(); ctx.arc(t.x,t.y,tr,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(0,255,100,0.13)'; ctx.beginPath(); ctx.arc(t.x-tr*.2,t.y-tr*.2,tr*.5,0,Math.PI*2); ctx.fill();
    });

    // Roads
    ctx.fillStyle='#1e2e3e';
    ctx.fillRect(X-R/2,0,R,Y-IB); ctx.fillRect(X-R/2,Y+IB,R,this.CH-Y-IB);
    ctx.fillRect(0,Y-R/2,X-IB,R); ctx.fillRect(X+IB,Y-R/2,this.CW-X-IB,R);
    ctx.fillStyle='#1a2834'; ctx.fillRect(X-IB,Y-IB,IB*2,IB*2);

    // Emergency corridor
    if (this.overrideActive && this.overrideDir >= 0) {
      const ns = this.overrideDir===0||this.overrideDir===2;
      ctx.fillStyle='rgba(255,234,0,0.07)';
      if (ns) ctx.fillRect(X-R/2,0,R,this.CH);
      else    ctx.fillRect(0,Y-R/2,this.CW,R);
      ctx.strokeStyle='rgba(255,234,0,0.25)'; ctx.lineWidth=1.5; ctx.setLineDash([8,6]);
      if (ns) {
        ctx.beginPath(); ctx.moveTo(X-R/2,0); ctx.lineTo(X-R/2,this.CH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X+R/2,0); ctx.lineTo(X+R/2,this.CH); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0,Y-R/2); ctx.lineTo(this.CW,Y-R/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,Y+R/2); ctx.lineTo(this.CW,Y+R/2); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Kerbs
    ctx.strokeStyle='rgba(0,212,255,0.2)'; ctx.lineWidth=1.5;
    [[X-R/2,0,X-R/2,Y-IB],[X+R/2,0,X+R/2,Y-IB],[X-R/2,Y+IB,X-R/2,this.CH],[X+R/2,Y+IB,X+R/2,this.CH],
     [0,Y-R/2,X-IB,Y-R/2],[0,Y+R/2,X-IB,Y+R/2],[X+IB,Y-R/2,this.CW,Y-R/2],[X+IB,Y+R/2,this.CW,Y+R/2]
    ].forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });

    // Lane dashes
    ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=1.6; ctx.setLineDash([R*.16,R*.12]);
    [[X,0,X,Y-IB],[X,Y+IB,X,this.CH],[0,Y,X-IB,Y],[X+IB,Y,this.CW,Y]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Zebra crossings
    const ZT = Math.round(R * 0.11);
    const zebra = (bx,by,bw,bh,hz) => {
      const n=6, sw=hz?bw/n:bh/n;
      ctx.fillStyle='rgba(255,255,255,0.065)';
      for (let i=0;i<n;i+=2) hz?ctx.fillRect(bx+i*sw,by,sw,bh):ctx.fillRect(bx,by+i*sw,bw,sw);
    };
    zebra(X-R/2,Y-IB-ZT,R,ZT,true); zebra(X-R/2,Y+IB,R,ZT,true);
    zebra(X-IB-ZT,Y-R/2,ZT,R,false); zebra(X+IB,Y-R/2,ZT,R,false);

    // Stop lines
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(X-R/2,Y-IB-this.STOP_GAP); ctx.lineTo(X,Y-IB-this.STOP_GAP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X,Y+IB+this.STOP_GAP); ctx.lineTo(X+R/2,Y+IB+this.STOP_GAP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X-IB-this.STOP_GAP,Y); ctx.lineTo(X-IB-this.STOP_GAP,Y+R/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X+IB+this.STOP_GAP,Y-R/2); ctx.lineTo(X+IB+this.STOP_GAP,Y); ctx.stroke();

    // Signal poles
    const po = Math.round(R * 0.54);
    this._drawPole(X-R/2-po, Y-IB-po, 0);
    this._drawPole(X+R/2+po, Y+IB+po, 2);
    this._drawPole(X+IB+po,  Y-R/2-po,1);
    this._drawPole(X-IB-po,  Y+R/2+po,3);

    // Road labels
    const fs = Math.max(9,Math.min(12,this.CW/66));
    ctx.font=`700 ${fs}px "Share Tech Mono",monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,212,255,0.72)';
    ctx.fillText('ROAD A',X,13); ctx.fillText('ROAD C',X,this.CH-11);
    ctx.textAlign='left';  ctx.fillText('ROAD B',X+IB+R/2+14,Y);
    ctx.textAlign='right'; ctx.fillText('ROAD D',X-IB-R/2-14,Y);
    ctx.textAlign='center';
    const dfs=Math.max(7,Math.min(10,this.CW/84));
    ctx.font=`600 ${dfs}px "Share Tech Mono",monospace`;
    const sc=[0,1,2,3].map(i=>{const s=this.getSig(i);return s==='green'?'#00ff88':s==='yellow'?'#ffea00':'#ff4444';});
    ctx.fillStyle=sc[0]; ctx.fillText(`▼ ${this.dens[0]} veh`,X,24);
    ctx.fillStyle=sc[2]; ctx.fillText(`▲ ${this.dens[2]} veh`,X,this.CH-22);
    ctx.fillStyle=sc[1]; ctx.textAlign='left';  ctx.fillText(`◀ ${this.dens[1]}`,X+IB+R/2+14,Y+fs+3);
    ctx.fillStyle=sc[3]; ctx.textAlign='right'; ctx.fillText(`▶ ${this.dens[3]}`,X-IB-R/2-14,Y-fs-3);
    ctx.textAlign='center'; ctx.textBaseline='middle';
  }

  _drawPole(x, y, dir) {
    const ctx = this.ctx, sig = this.getSig(dir);
    const sc=Math.max(.65,Math.min(1.5,this.CW/650));
    const HW=Math.round(16*sc), HH=Math.round(43*sc), LR=5.2*sc;
    ctx.strokeStyle='#263d56'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x,y+HH/2); ctx.lineTo(x,y+HH/2+Math.round(19*sc)); ctx.stroke();
    ctx.fillStyle='#06101c'; this._rr(x-HW/2,y-HH/2,HW,HH,4); ctx.fill();
    ctx.strokeStyle='rgba(0,212,255,0.28)'; ctx.lineWidth=1.1; this._rr(x-HW/2,y-HH/2,HW,HH,4); ctx.stroke();
    [{state:'red',col:'#ff1744',off:'#2a0808',oy:-HH*.31},{state:'yellow',col:'#ffea00',off:'#2a2000',oy:0},{state:'green',col:'#00ff88',off:'#082a12',oy:HH*.31}].forEach(l=>{
      const on = l.state===sig;
      ctx.beginPath(); ctx.arc(x,y+l.oy,LR,0,Math.PI*2);
      if (on) { ctx.shadowColor=l.col; ctx.shadowBlur=12; }
      ctx.fillStyle=on?l.col:l.off; ctx.fill(); ctx.shadowBlur=0;
      if (on) { ctx.beginPath(); ctx.arc(x-1.4,y+l.oy-1.4,1.3,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fill(); }
    });
  }

  _drawCar(v) {
    const ctx=this.ctx; let col=v.col;
    if (v.isViolator&&!v.detected) col='#ff5500';
    if (v.isViolator&&v.detected)  col='#ff006e';
    if (v._wrecked) col='#882200';
    const L=v.L, W=v.W, vtype=v.vtype||'sedan';
    ctx.save(); ctx.translate(v.px,v.py); ctx.rotate([Math.PI/2,Math.PI,3*Math.PI/2,0][v.dir]);
    if (v._wrecked) ctx.globalAlpha=Math.max(.1,(v._wreckedTtl||1)/80);
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(2,3,L*.43,W*.37,0,0,Math.PI*2); ctx.fill();
    const wr=W*.25, wxF=L/2-wr*1.55, wxR=-L/2+wr*1.55;
    [[wxF,-W/2+wr*.05],[wxF,W/2-wr*.05],[wxR,-W/2+wr*.05],[wxR,W/2-wr*.05]].forEach(([wx,wy])=>{
      ctx.fillStyle='#181818'; ctx.beginPath(); ctx.ellipse(wx,wy,wr,wr*.77,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=this._shade(col,28)+'bb'; ctx.beginPath(); ctx.arc(wx,wy,wr*.55,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=.55;
      for (let k=0;k<4;k++){const a=k*Math.PI/2; ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(wx+Math.cos(a)*wr*.48,wy+Math.sin(a)*wr*.46); ctx.stroke();}
      ctx.fillStyle='#bbb'; ctx.beginPath(); ctx.arc(wx,wy,wr*.17,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle=col; this._rr(-L/2,-W/2,L,W,W*.22); ctx.fill();
    ctx.fillStyle=this._shade(col,36)+'42'; this._rr(-L/2+1,-W/2+1,L-2,W*.4,W*.17); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.2)'; this._rr(-L/2+1,W/2-W*.3,L-2,W*.28,W*.08); ctx.fill();
    ctx.strokeStyle=this._shade(col,-32); ctx.lineWidth=.75; this._rr(-L/2,-W/2,L,W,W*.22); ctx.stroke();
    ctx.fillStyle=this._shade(col,-18);
    this._rr(L/2-L*.1,-W/2+W*.07,L*.1,W*.86,2); ctx.fill();
    this._rr(-L/2,-W/2+W*.07,L*.1,W*.86,2); ctx.fill();
    const cxs=vtype==='bus'?-L*.37:vtype==='van'?-L*.28:-L*.05, cw=vtype==='bus'?L*.74:vtype==='van'?L*.68:L*.49;
    ctx.fillStyle=this._shade(col,-26); this._rr(cxs,-W*.33,cw,W*.66,W*.09); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)'; this._rr(cxs+1,-W*.29,cw-2,W*.28,W*.07); ctx.fill();
    if (!v._wrecked) {
      ctx.fillStyle='rgba(130,210,255,0.65)'; this._rr(L*.13,-W*.29,L*.2,W*.58,2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(L*.15,-W*.26); ctx.lineTo(L*.21,-W*.26); ctx.lineTo(L*.19,-W*.08); ctx.lineTo(L*.15,-W*.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(80,160,200,0.52)'; this._rr(-L*.33,-W*.27,L*.16,W*.54,2); ctx.fill();
      ctx.fillStyle='#fffff0';
      ctx.beginPath(); ctx.ellipse(L/2-3.2,-W*.3,3.5,2.1,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(L/2-3.2,W*.3,3.5,2.1,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,240,180,0.3)';
      ctx.beginPath(); ctx.ellipse(L/2,-W*.3,5.5,3.2,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(L/2,W*.3,5.5,3.2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#f44336';
      ctx.beginPath(); ctx.ellipse(-L/2+2.8,-W*.3,3,1.8,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-L/2+2.8,W*.3,3,1.8,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(244,67,54,0.16)';
      ctx.beginPath(); ctx.ellipse(-L/2,-W*.3,5,2.8,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-L/2,W*.3,5,2.8,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=this._shade(col,-14)+'88'; ctx.lineWidth=.45;
      ctx.beginPath(); ctx.moveTo(L/2-1.2,0); ctx.lineTo(-L/2+1.2,0); ctx.stroke();
    }
    if (v.waiting&&!v._wrecked) { ctx.fillStyle='rgba(244,67,54,0.18)'; ctx.beginPath(); ctx.ellipse(-L/2-2,0,L*.2,W*.65,0,0,Math.PI*2); ctx.fill(); }
    if (v.isViolator&&!v._wrecked) { ctx.strokeStyle='rgba(255,80,0,0.45)'; ctx.lineWidth=1.3; this._rr(-L/2-1.3,-W/2-1.3,L+2.6,W+2.6,W*.25); ctx.stroke(); }
    ctx.restore();
  }

  _drawEmgCar(v) {
    const ctx=this.ctx, cfg=this.EMG_CFG[v.type];
    const L=v.L, W=v.W, blink=this.sirenTick<300;
    ctx.save(); ctx.translate(v.px,v.py); ctx.rotate([Math.PI/2,Math.PI,3*Math.PI/2,0][v.dir]);
    const ac=v.type==='police'?'rgba(68,136,255,0.16)':v.type==='ambulance'?'rgba(255,60,60,0.16)':'rgba(255,100,0,0.16)';
    ctx.fillStyle=ac; ctx.beginPath(); ctx.ellipse(0,0,L*1.2,W*1.55,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(2,4,L*.44,W*.39,0,0,Math.PI*2); ctx.fill();
    const wr=W*.25, wxF=L/2-wr*1.48, wxR=-L/2+wr*1.48;
    [[wxF,-W/2+wr*.05],[wxF,W/2-wr*.05],[wxR,-W/2+wr*.05],[wxR,W/2-wr*.05]].forEach(([wx,wy])=>{
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.ellipse(wx,wy,wr,wr*.77,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#666'; ctx.beginPath(); ctx.arc(wx,wy,wr*.53,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#aaa'; ctx.beginPath(); ctx.arc(wx,wy,wr*.19,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle=cfg.col; this._rr(-L/2,-W/2,L,W,W*.2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=.9; this._rr(-L/2,-W/2,L,W,W*.2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.09)'; this._rr(-L/2+1,-W/2+1,L-2,W*.38,W*.14); ctx.fill();
    ctx.fillStyle=cfg.roof; this._rr(-L/2+3,-W/2+2.5,L-6,W-5,2); ctx.fill();
    ctx.fillStyle='rgba(190,235,255,0.62)'; this._rr(L/2-9.5,-W/2+2.5,7.5,W-5,2); ctx.fill();
    if (v.type==='ambulance') { ctx.fillStyle='rgba(220,0,0,0.88)'; ctx.fillRect(-1.4,-W/2+3,2.8,W-6); ctx.fillRect(-5.5,-1.3,11,2.6); }
    else if (v.type==='police') { ctx.fillStyle='rgba(255,255,255,0.43)'; const sw=(L-10)/4; for (let k=0;k<4;k++) if (k%2===0) { ctx.fillRect(-L/2+5+k*sw,-W/2+1.4,sw,2.8); ctx.fillRect(-L/2+5+k*sw,W/2-4.2,sw,2.8); } }
    else { ctx.fillStyle='rgba(255,210,0,0.68)'; ctx.fillRect(-L/2+5,-1.3,L-10,2.6); }
    const s1=blink?cfg.s1:'#0a0a0a', s2=blink?'#0a0a0a':cfg.s2;
    if (blink) { ctx.shadowColor=s1; ctx.shadowBlur=10; }
    ctx.fillStyle=s1; ctx.beginPath(); ctx.arc(L/2-6.5,-W/2+3.8,3.2,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    if (!blink) { ctx.shadowColor=s2; ctx.shadowBlur=10; }
    ctx.fillStyle=s2; ctx.beginPath(); ctx.arc(L/2-6.5,W/2-3.8,3.2,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='#fffff0';
    ctx.beginPath(); ctx.ellipse(L/2-2.4,-W*.3,3.3,1.9,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(L/2-2.4,W*.3,3.3,1.9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#f44336';
    ctx.beginPath(); ctx.ellipse(-L/2+2.8,-W*.3,2.8,1.7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-L/2+2.8,W*.3,2.8,1.7,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    const lc=v.type==='police'?'#4488ff':v.type==='ambulance'?'#ff5555':'#ff8800';
    const lfs=Math.max(7,Math.min(10,this.CW/84));
    ctx.font=`700 ${lfs}px "Share Tech Mono",monospace`; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillStyle=lc; ctx.fillText(cfg.label,v.px,v.py-(v.W/2+5));
  }

  _drawCrashFlashes() {
    const ctx = this.ctx;
    this.crashFlashes.forEach(f => {
      const al = f.ttl / f.maxTtl, rad = f.r + (1-al) * f.r * 3;
      ctx.strokeStyle=`rgba(255,${Math.round(80+al*120)},0,${al*.82})`; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.arc(f.px,f.py,rad,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle=`rgba(255,200,0,${al*.32})`;
      ctx.beginPath(); ctx.arc(f.px,f.py,rad*.33,0,Math.PI*2); ctx.fill();
    });
  }

  _drawVioFlashes() {
    const ctx = this.ctx;
    this.vioFlashes.forEach(f => {
      const al = Math.min(1, f.ttl / 30), r = 12 + (1 - f.ttl / 80) * 20;
      ctx.strokeStyle=`rgba(255,0,80,${al*.78})`; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.arc(f.px,f.py,r,0,Math.PI*2); ctx.stroke();
    });
  }

  _drawHUD() {
    const ctx = this.ctx;
    const rem = Math.max(0, this.sigDur - this.sigTimer), pct = rem / this.sigDur;
    const isY = this.sigState==='NS_YELLOW'||this.sigState==='EW_YELLOW';
    const isNS= this.sigState==='NS_GREEN'||this.sigState==='NS_YELLOW';
    const col = this.overrideActive?'#ff6b00':this.manualOverrideDir>=0?'rgba(255,234,0,.9)':isY?'#ffea00':'#00ff88';
    ctx.fillStyle='rgba(2,8,18,0.86)'; ctx.fillRect(0,this.CH-30,this.CW,30);
    ctx.fillStyle='rgba(0,212,255,0.08)'; ctx.fillRect(0,this.CH-30,this.CW,1);
    const fs = Math.max(8,Math.min(11,this.CW/72));
    ctx.font=`700 ${fs}px "Share Tech Mono",monospace`; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle=col;
    let lbl;
    if (this.overrideActive) lbl=`🚨 EMERGENCY OVERRIDE — ROAD ${'ABCD'[this.overrideDir]}`;
    else if (this.manualOverrideDir>=0) lbl=`👮 MANUAL OVERRIDE — ROAD ${'ABCD'[this.manualOverrideDir]} — ${Math.ceil(this.manualOverrideMs/1000)}s`;
    else if (isY) lbl='⚠ YELLOW — TRANSITIONING';
    else lbl=`▶ GREEN — ROAD ${isNS?'A & C':'B & D'}`;
    ctx.fillText(lbl,12,this.CH-15);
    const bw = Math.min(150, this.CW*.18);
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(this.CW-bw-12,this.CH-22,bw,8);
    ctx.fillStyle=col; ctx.fillRect(this.CW-bw-12,this.CH-22,bw*Math.min(1,pct),8);
    ctx.font=`500 ${Math.max(7,fs-1)}px "Share Tech Mono",monospace`; ctx.textAlign='right';
    ctx.fillStyle='rgba(255,255,255,.38)';
    ctx.fillText(this.overrideActive?'OVR':this.manualOverrideDir>=0?'MAN':Math.ceil(rem/1000)+'s',this.CW-16,this.CH-17);
  }
}
