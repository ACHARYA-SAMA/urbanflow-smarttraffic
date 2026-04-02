// ════════════════════════════════════════════════════════
//  SimEngine.js — Urban Flow Simulation Engine
//  All vehicle bugs fixed:
//  • BUG 1: Vehicles stopped on green  — fixed via ahead-guard + approach-guard
//  • BUG 2: Vehicles drifting off road — fixed via strict lane constraint
//  • BUG 3: Fullscreen misalignment    — engine uses CSS coords; DPR in Renderer
//  • BUG 4: Timer freezing             — timestamp-based phase timer, never drifts
// ════════════════════════════════════════════════════════

const ROAD_NAMES   = ['A','B','C','D'];
const VEH_SPD      = 85;        // px/s in CSS space
const MAX_PER_DIR  = 9;
const STOP_GAP     = 6;
const EMG_SPAWN_MS = 20000;
const VIO_CHANCE   = 0.11;

const VEH_TYPES    = ['sedan','sedan','sedan','suv','suv','truck','van','bus'];
const CAR_COLS     = [
  '#00ff88','#00d4ff','#ff6b00','#e040fb','#ffea00',
  '#00bcd4','#ff4081','#69f0ae','#ff8f00','#40c4ff',
  '#a0ff40','#c0ff40','#40ffd4','#ff8040','#80d0ff',
];
const EMG_CFG = {
  police:    { col:'#1a44ee', roof:'#0d2fcc', s1:'#ff2244', s2:'#4488ff', label:'POLICE',    spd:130 },
  ambulance: { col:'#f0f0f0', roof:'#d0d0d0', s1:'#ff3333', s2:'#ff3333', label:'AMBULANCE', spd:125 },
  fire:      { col:'#cc2000', roof:'#aa1100', s1:'#ff6600', s2:'#ffcc00', label:'FIRE TRUCK', spd:118 },
};
const BLDG_COLS  = ['#0e1a2e','#0c1822','#101e2c','#0b1520','#0d2035','#091618'];
const BLDG_ROOF  = ['#1a2d44','#16283a','#1c3040','#142230','#1f2e48','#112420'];
const TREE_COLS  = ['#0d2e0d','#0b260b','#0f380f','#102810','#163416'];

// ── helpers ──────────────────────────────────────────────
let _nextId = 0;
const uid = () => ++_nextId;

function genPlate() {
  const L = 'ABCEFGHJKLMNPQRSTUVWXYZ';
  const r = () => L[Math.floor(Math.random() * L.length)];
  const n = () => Math.floor(Math.random() * 10);
  return `${r()}${r()}${n()}${n()}-${r()}${r()}${n()}`;
}

// ════════════════════════════════════════════════════════
export default class SimEngine {
  // ── constructor ──────────────────────────────────────
  constructor(onStateUpdate) {
    this.onStateUpdate = onStateUpdate; // called every 6 frames

    // Canvas dimensions in CSS pixels (set by attachCanvas / resize)
    this.CW = 800;
    this.CH = 600;

    // Signal state machine
    this.sigState        = 'NS_GREEN';
    this.phaseStartTime  = 0;   // performance.now() when phase began — BUG4 FIX
    this.sigDur          = 7000;
    this.cycleN          = 142;

    // Density counters (simulated, slowly random-walks)
    this.dens   = [8, 4, 6, 3];
    this.maxD   = 20;

    // Manual / emergency override
    this.manualOverrideDir = -1;
    this.manualOverrideEnd = 0;   // absolute ms
    this.overrideActive    = false;
    this.overrideDir       = -1;
    this.overrideEnd       = 0;   // absolute ms

    // Vehicles
    this.vehs      = [];
    this.emgVehs   = [];
    this.spawnTick = [0,0,0,0];

    // Stats
    this.violations   = [];
    this.vioCount     = 0;
    this.vioByRoad    = [0,0,0,0];
    this.vioFlashes   = [];

    this.accidents    = [];
    this.accCount     = 0;
    this.accInjured   = 0;
    this.accCleared   = 0;
    this.respTimes    = [];
    this.crashFlashes = [];
    this.recentCrash  = new Set();

    this.emgCount     = 0;
    this.emgByType    = { police:0, ambulance:0, fire:0 };
    this.emgAutoTimer = EMG_SPAWN_MS + 6000;

    this.alerts       = [];
    this.alertCount   = 0;
    this.logEntries   = [];
    this.emgEntries   = [];

    this.sirenTick    = 0;
    this.frameN       = 0;
    this.uptimeSec    = 0;
    this._uptimeInt   = null;

    this.envFuel      = 0;
    this.envCO2       = 0;
    this.envSimSec    = 0;

    this.healthTick   = 0;
    this.healthState  = {
      cpuLoad: 12, memLoad: 34, latency: 2, wifi: 88,
      sensors: [true,true,true,true],
    };

    // World geometry (buildings/trees — pre-built on resize)
    this.buildings = [];
    this.trees     = [];

    // RAF
    this._raf     = null;
    this._lastTS  = 0;
    this.running  = false;
  }

  // ── geometry helpers (CSS space) ─────────────────────
  cx()  { return this.CW / 2; }
  cy()  { return this.CH / 2; }
  RW()  { return Math.round(Math.min(this.CW, this.CH) * 0.11); }
  IBOX(){ return Math.round(this.RW() * 1.05); }
  VEH_L(){ return Math.round(this.RW() * 0.32); }
  VEH_W(){ return Math.round(this.RW() * 0.148); }
  FG()  { return Math.round(this.RW() * 0.09); }   // follow gap

  // Lane offset from road centre (vehicles on the right side of their direction)
  laneOffset(dir) {
    const off = this.RW() / 4;
    // dir 0 (south): right lane is +off in x
    // dir 1 (west):  right lane is +off in y
    // dir 2 (north): right lane is -off in x
    // dir 3 (east):  right lane is -off in y
    return [off, off, -off, -off][dir];
  }

  stopCoord(dir) {
    const gap = this.IBOX() + STOP_GAP + this.VEH_L() / 2;
    if (dir === 0) return this.cy() - gap;
    if (dir === 2) return this.cy() + gap;
    if (dir === 1) return this.cx() + gap;
    return this.cx() - gap;
  }

  // ── attach canvas ─────────────────────────────────────
  attachCanvas(canvas) {
    this.canvas = canvas;
    // Renderer will be set by TrafficCanvas
  }

  setDimensions(cw, ch) {
    this.CW = cw;
    this.CH = ch;
    this._buildWorld();
    // Update all vehicle stopAt after resize
    this.vehs.forEach(v => { v.stopAt = this.stopCoord(v.dir); });
  }

  // ── world geometry ────────────────────────────────────
  _buildWorld() {
    const { CW, CH } = this;
    const X = this.cx(), Y = this.cy(), R = this.RW(), IB = this.IBOX();
    const SW = Math.round(R * 0.28), G = 5;

    this.buildings = [];
    this.trees     = [];

    const quads = [
      { x: G,          y: G,          w: X - IB - R/2 - SW - G,      h: Y - IB - R/2 - SW - G },
      { x: X+IB+R/2+SW+G, y: G,       w: CW - X - IB - R/2 - SW - G*2, h: Y - IB - R/2 - SW - G },
      { x: G,          y: Y+IB+R/2+SW+G, w: X - IB - R/2 - SW - G,   h: CH - Y - IB - R/2 - SW - G*2 },
      { x: X+IB+R/2+SW+G, y: Y+IB+R/2+SW+G, w: CW - X - IB - R/2 - SW - G*2, h: CH - Y - IB - R/2 - SW - G*2 },
    ];

    quads.forEach(q => {
      if (q.w < 16 || q.h < 16) return;
      let bx = q.x;
      while (bx < q.x + q.w - 12) {
        let by = q.y;
        while (by < q.y + q.h - 12) {
          const bw = Math.min(Math.random() * 36 + 12, q.x + q.w - bx - G);
          const bh = Math.min(Math.random() * 36 + 12, q.y + q.h - by - G);
          if (bw > 10 && bh > 10) {
            const ci = Math.floor(Math.random() * BLDG_COLS.length);
            this.buildings.push({ x:bx, y:by, w:bw, h:bh, col:BLDG_COLS[ci], roof:BLDG_ROOF[ci] });
          }
          by += bh + G;
        }
        bx += Math.random() * 38 + 14;
      }
    });

    const TR = Math.max(3, Math.round(R * 0.065));
    const TS = Math.round(R * 0.42);
    const edges = [
      { ax:'x', fx: X - R/2 - SW*0.55, fy: G,     ty: Y - IB },
      { ax:'x', fx: X + R/2 + SW*0.55, fy: G,     ty: Y - IB },
      { ax:'x', fx: X - R/2 - SW*0.55, fy: Y+IB,  ty: CH - G },
      { ax:'x', fx: X + R/2 + SW*0.55, fy: Y+IB,  ty: CH - G },
      { ax:'y', fx: Y - R/2 - SW*0.55, fy: G,     ty: X - IB },
      { ax:'y', fx: Y + R/2 + SW*0.55, fy: G,     ty: X - IB },
      { ax:'y', fx: Y - R/2 - SW*0.55, fy: X+IB,  ty: CW - G },
      { ax:'y', fx: Y + R/2 + SW*0.55, fy: X+IB,  ty: CW - G },
    ];
    edges.forEach(e => {
      for (let p = e.fy + TS/2; p < e.ty; p += TS)
        this.trees.push(e.ax === 'x' ? { x:e.fx, y:p, r:TR } : { x:p, y:e.fx, r:TR });
    });
  }

  // ── signal logic ──────────────────────────────────────
  getSig(dir) {
    const now = performance.now();
    // Emergency override always wins
    if (this.overrideActive && now < this.overrideEnd) {
      const oNS = this.overrideDir === 0 || this.overrideDir === 2;
      const vNS = dir === 0 || dir === 2;
      return (oNS && vNS) || (!oNS && !vNS) ? 'green' : 'red';
    }
    // Manual override
    if (this.manualOverrideDir >= 0 && now < this.manualOverrideEnd) {
      const mNS = this.manualOverrideDir === 0 || this.manualOverrideDir === 2;
      const vNS = dir === 0 || dir === 2;
      return (mNS && vNS) || (!mNS && !vNS) ? 'green' : 'red';
    }
    switch (this.sigState) {
      case 'NS_GREEN':  return (dir === 0 || dir === 2) ? 'green' : 'red';
      case 'NS_YELLOW': return (dir === 0 || dir === 2) ? 'yellow' : 'red';
      case 'EW_GREEN':  return (dir === 1 || dir === 3) ? 'green' : 'red';
      case 'EW_YELLOW': return (dir === 1 || dir === 3) ? 'yellow' : 'red';
    }
    return 'red';
  }

  _tickSignals(now) {
    // Don't advance AI signals during overrides
    if (this.overrideActive && now < this.overrideEnd) return;
    if (this.manualOverrideDir >= 0 && now < this.manualOverrideEnd) return;

    // BUG4 FIX: use absolute timestamps, never accumulate dt
    const elapsed = now - this.phaseStartTime;
    if (elapsed < this.sigDur) return;

    // FIX P2: use real on-road vehicle counts instead of the simulated dens[]
    // array so that empty roads never receive extended green time.
    const nsLoad = this.vehs.filter(v => v.dir === 0 || v.dir === 2).length;
    const ewLoad = this.vehs.filter(v => v.dir === 1 || v.dir === 3).length;

    if (this.sigState === 'NS_GREEN') {
      this.sigState = 'NS_YELLOW';
      this.sigDur   = 1800;
    } else if (this.sigState === 'NS_YELLOW') {
      this.sigState = 'EW_GREEN';
      this.sigDur   = Math.min(14000, 5000 + ewLoad * 220);
      this.cycleN++;
      this._onPhaseSwitch();
    } else if (this.sigState === 'EW_GREEN') {
      this.sigState = 'EW_YELLOW';
      this.sigDur   = 1800;
    } else {
      this.sigState = 'NS_GREEN';
      this.sigDur   = Math.min(14000, 5000 + nsLoad * 220);
      this.cycleN++;
      this._onPhaseSwitch();
    }
    this.phaseStartTime = now;
  }

  _onPhaseSwitch() {
    const ns    = this.sigState === 'NS_GREEN';
    const rn    = ns ? 'A & C' : 'B & D';
    // FIX P2: report real vehicle count in the AI log, not simulated density
    const load  = ns
      ? this.vehs.filter(v => v.dir === 0 || v.dir === 2).length
      : this.vehs.filter(v => v.dir === 1 || v.dir === 3).length;
    const dur   = Math.round(this.sigDur / 1000);
    const t     = new Date().toLocaleTimeString();
    const cls   = ns ? 'g' : 'b';
    const col   = ns ? '#00ff88' : '#00d4ff';

    const entry = { t, cycleN: this.cycleN, rn, load, dur, cls, col };
    this.logEntries.unshift(entry);
    if (this.logEntries.length > 10) this.logEntries.length = 10;

    if (load > 18)
      this._addAlert('critical', '🔴 HEAVY CONGESTION', `Road ${rn}: ${load} vehicles queued. Extended green applied.`, 'critical');
    else if (load > 12)
      this._addAlert('warn', '🟡 MODERATE CONGESTION', `Road ${rn}: ${load} vehicles. Monitor closely.`, 'warn');
  }

  // ── vehicle spawning ──────────────────────────────────
  _spawnV(dir) {
    const col   = CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)];
    const vtype = VEH_TYPES[Math.floor(Math.random() * VEH_TYPES.length)];
    const lane  = this.laneOffset(dir);
    const far   = Math.max(this.CW, this.CH) * 0.55;

    let px, py, vx, vy;
    // BUG2 FIX: vehicles are strictly constrained to their lane line
    if (dir === 0) { px = this.cx() + lane; py = this.cy() - far; vx = 0;      vy = VEH_SPD;  }
    else if (dir===2) { px = this.cx() + lane; py = this.cy() + far; vx = 0;   vy = -VEH_SPD; }
    else if (dir===1) { px = this.cx() + far;  py = this.cy() + lane; vx = -VEH_SPD; vy = 0;  }
    else            { px = this.cx() - far;  py = this.cy() + lane; vx = VEH_SPD;  vy = 0;    }

    const sf  = { sedan:1, suv:1.1, truck:1.25, van:1.15, bus:1.5  }[vtype] || 1;
    const wf  = { sedan:1, suv:1.1, truck:1.15, van:1.1,  bus:1.12 }[vtype] || 1;

    this.vehs.push({
      id:         uid(),
      dir,
      px, py, vx, vy,
      col, vtype,
      passed:     false,
      waiting:    false,
      speed:      0,           // current speed (used for smooth accel)
      L:          Math.round(this.VEH_L() * sf),
      W:          Math.round(this.VEH_W() * wf),
      stopAt:     this.stopCoord(dir),
      isViolator: Math.random() < VIO_CHANCE,
      plate:      genPlate(),
      detected:   false,
      _wrecked:   false,
      _wreckedTtl: 0,
    });
  }

  _maybeSpawn(dt) {
    for (let d = 0; d < 4; d++) {
      this.spawnTick[d] -= dt;
      if (this.spawnTick[d] <= 0) {
        const waiting = this.vehs.filter(v => v.dir === d && v.waiting).length;
        if (waiting < MAX_PER_DIR) {
          this._spawnV(d);
          // FIX P1: use a flat base interval identical for every direction so
          // no axis is starved.  A small random jitter (±400 ms) keeps arrivals
          // staggered and avoids convoy bunching.  this.dens[] still drives the
          // UI density bars and alerts — we just decouple it from spawn timing.
          this.spawnTick[d] = 1400 + Math.random() * 800;
        } else {
          this.spawnTick[d] = 600;
        }
      }
    }
  }

  // ── BUG1 & BUG2 FIX: vehicle update ──────────────────
  _updateVehs(dt) {
    const sec    = dt / 1000;
    const FG     = this.FG();
    const ACCEL  = VEH_SPD * 3.5;   // px/s² — smooth acceleration
    const DECEL  = VEH_SPD * 5.0;

    const rem = [];

    for (let i = 0; i < this.vehs.length; i++) {
      const v = this.vehs[i];

      // ── wrecked countdown ──
      if (v._wrecked) {
        v._wreckedTtl--;
        if (v._wreckedTtl <= 0) rem.push(i);
        continue;
      }

      const sig = this.getSig(v.dir);

      // ── STOP DECISION ─────────────────────────────────
      let shouldStop = false;

      // 1) Signal stop — only if APPROACHING the stop line (not yet past it)
      //    BUG1 FIX: added "approaching" guard so vehicles inside intersection
      //    are never re-stopped by the signal.
      if (!v.passed && !v.isViolator && (sig === 'red' || sig === 'yellow')) {
        const s = v.stopAt;
        const approaching =
          (v.dir === 0 && v.py < s) ||    // traveling south,  not yet at line
          (v.dir === 2 && v.py > s) ||    // traveling north,  not yet at line
          (v.dir === 1 && v.px > s) ||    // traveling west,   not yet at line
          (v.dir === 3 && v.px < s);      // traveling east,   not yet at line

        if (approaching) {
          // Stop if front bumper is at or past the stop line
          const frontReached =
            (v.dir === 0 && v.py + v.L/2 >= s - 2) ||
            (v.dir === 2 && v.py - v.L/2 <= s + 2) ||
            (v.dir === 1 && v.px - v.L/2 <= s + 2) ||
            (v.dir === 3 && v.px + v.L/2 >= s - 2);

          if (frontReached) shouldStop = true;
        }
      }

      // 2) Follow-gap stop — only if there's a vehicle GENUINELY AHEAD
      //    BUG1 FIX: old code missed the `ahead` direction check, causing
      //    rear vehicles to trigger a stop on the car in front.
      if (!shouldStop) {
        for (let j = 0; j < this.vehs.length; j++) {
          if (j === i || this.vehs[j].dir !== v.dir || this.vehs[j]._wrecked) continue;
          const o = this.vehs[j];
          let gap = Infinity;
          let ahead = false;

          if (v.dir === 0) {
            ahead = o.py > v.py;                              // o is further south
            if (ahead) gap = (o.py - o.L/2) - (v.py + v.L/2); // bumper-to-bumper
          } else if (v.dir === 2) {
            ahead = o.py < v.py;                              // o is further north
            if (ahead) gap = (v.py - v.L/2) - (o.py + o.L/2);
          } else if (v.dir === 1) {
            ahead = o.px < v.px;                              // o is further west
            if (ahead) gap = (v.px - v.L/2) - (o.px + o.L/2);
          } else {
            ahead = o.px > v.px;                              // o is further east
            if (ahead) gap = (o.px - o.L/2) - (v.px + v.L/2);
          }

          if (ahead && gap < FG) { shouldStop = true; break; }
        }
      }

      // 3) BUG1 SAFETY NET: if green AND no real follow-blocker, always release
      if (shouldStop && sig === 'green') {
        let followBlocked = false;
        for (let j = 0; j < this.vehs.length; j++) {
          if (j === i || this.vehs[j].dir !== v.dir || this.vehs[j]._wrecked) continue;
          const o = this.vehs[j];
          let gap = Infinity, ahead = false;
          if (v.dir === 0) { ahead = o.py > v.py; if (ahead) gap = (o.py-o.L/2)-(v.py+v.L/2); }
          else if (v.dir===2) { ahead=o.py<v.py; if(ahead) gap=(v.py-v.L/2)-(o.py+o.L/2); }
          else if (v.dir===1) { ahead=o.px<v.px; if(ahead) gap=(v.px-v.L/2)-(o.px+o.L/2); }
          else                { ahead=o.px>v.px; if(ahead) gap=(o.px-o.L/2)-(v.px+v.L/2); }
          if (ahead && gap < FG) { followBlocked = true; break; }
        }
        if (!followBlocked) shouldStop = false;
      }

      // v.waiting is derived every frame — never sticky
      v.waiting = shouldStop;

      // ── SMOOTH SPEED ──────────────────────────────────
      const targetSpd = shouldStop ? 0 : (v.isViolator ? VEH_SPD * 1.4 : VEH_SPD);
      if (v.speed < targetSpd) {
        v.speed = Math.min(targetSpd, v.speed + ACCEL * sec);
      } else if (v.speed > targetSpd) {
        v.speed = Math.max(targetSpd, v.speed - DECEL * sec);
      }

      // BUG2 FIX: position update uses only the direction axis — no lateral drift
      if (v.speed > 0.5) {
        const ds = v.speed * sec;
        if (v.dir === 0) v.py += ds;
        else if (v.dir === 2) v.py -= ds;
        else if (v.dir === 1) v.px -= ds;
        else v.px += ds;
      }

      // BUG2 FIX: hard-clamp lateral position to the lane center
      const lane = this.laneOffset(v.dir);
      if (v.dir === 0 || v.dir === 2) v.px = this.cx() + lane;
      else                            v.py = this.cy() + lane;

      // ── violation detection ──
      if (!v.passed && !v.detected && v.isViolator) {
        const sig2 = this.getSig(v.dir);
        if (sig2 === 'red' || sig2 === 'yellow') {
          const s = v.stopAt;
          const crossed =
            (v.dir === 0 && v.py + v.L/2 >= s - 1) ||
            (v.dir === 2 && v.py - v.L/2 <= s + 1) ||
            (v.dir === 1 && v.px - v.L/2 <= s + 1) ||
            (v.dir === 3 && v.px + v.L/2 >= s - 1);
          if (crossed) { v.detected = true; this._triggerViolation(v); }
        }
      }

      // ── passed intersection ──
      if (!v.passed) {
        const IB = this.IBOX();
        if (v.dir === 0 && v.py > this.cy() + IB) v.passed = true;
        if (v.dir === 2 && v.py < this.cy() - IB) v.passed = true;
        if (v.dir === 1 && v.px < this.cx() - IB) v.passed = true;
        if (v.dir === 3 && v.px > this.cx() + IB) v.passed = true;
      }

      // ── despawn out of bounds ──
      if (v.px < -150 || v.px > this.CW + 150 || v.py < -150 || v.py > this.CH + 150)
        rem.push(i);
    }

    for (let i = rem.length - 1; i >= 0; i--) this.vehs.splice(rem[i], 1);

    // decay violation flashes
    for (let i = this.vioFlashes.length - 1; i >= 0; i--) {
      this.vioFlashes[i].ttl -= dt / 16;
      if (this.vioFlashes[i].ttl <= 0) this.vioFlashes.splice(i, 1);
    }
  }

  // ── collision detection ───────────────────────────────
  _checkCollisions() {
    const all = [...this.vehs, ...this.emgVehs];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.dir === b.dir || a._crashed || b._crashed) continue;
        if (Math.abs(a.px - b.px) < (a.L/2 + b.L/2) * 0.78 &&
            Math.abs(a.py - b.py) < (a.W/2 + b.W/2) * 0.78) {
          const key = `${Math.min(a.id,b.id)}_${Math.max(a.id,b.id)}`;
          if (this.recentCrash.has(key)) continue;
          this.recentCrash.add(key);
          setTimeout(() => this.recentCrash.delete(key), 5000);
          a._crashed = true; b._crashed = true;
          this._triggerAccident(a, b);
        }
      }
    }
  }

  // ── emergency vehicles ────────────────────────────────
  _updateEmgVehs(dt, now) {
    this.sirenTick = (this.sirenTick + dt) % 600;
    const sec = dt / 1000;
    const rem = [];

    for (let i = 0; i < this.emgVehs.length; i++) {
      const v = this.emgVehs[i];
      const ds = v.speed * sec;
      if (v.dir === 0) v.py += ds;
      else if (v.dir === 2) v.py -= ds;
      else if (v.dir === 1) v.px -= ds;
      else v.px += ds;

      // BUG2 FIX: clamp to lane
      const lane = this.laneOffset(v.dir);
      if (v.dir === 0 || v.dir === 2) v.px = this.cx() + lane;
      else                            v.py = this.cy() + lane;

      if (!v.passed) {
        const IB = this.IBOX();
        if (v.dir===0 && v.py > this.cy()+IB) v.passed=true;
        if (v.dir===2 && v.py < this.cy()-IB) v.passed=true;
        if (v.dir===1 && v.px < this.cx()-IB) v.passed=true;
        if (v.dir===3 && v.px > this.cx()+IB) v.passed=true;
      }
      if (v.px<-160||v.px>this.CW+160||v.py<-160||v.py>this.CH+160) rem.push(i);
    }
    for (let i = rem.length-1; i>=0; i--) this.emgVehs.splice(rem[i], 1);

    // expire overrides
    if (this.overrideActive && now >= this.overrideEnd) {
      this.overrideActive = false; this.overrideDir = -1;
      this.sigState = 'NS_GREEN';
      // FIX P2: use real vehicle count when resuming after emergency override
      const nsResume = this.vehs.filter(v => v.dir === 0 || v.dir === 2).length;
      this.sigDur   = Math.min(14000, 5000 + nsResume * 220);
      this.phaseStartTime = now;
    }
    if (this.manualOverrideDir >= 0 && now >= this.manualOverrideEnd) {
      this.manualOverrideDir = -1;
    }

    // auto-spawn emergency vehicles
    this.emgAutoTimer -= dt;
    if (this.emgAutoTimer <= 0) {
      this.emgAutoTimer = EMG_SPAWN_MS + Math.random() * 8000;
      const types = ['police','ambulance','fire'];
      this.spawnEmergency(types[Math.floor(Math.random()*types.length)], Math.floor(Math.random()*4));
    }
  }

  spawnEmergency(type, dir) {
    if (!this.running) return;
    const cfg  = EMG_CFG[type];
    const lane = this.laneOffset(dir);
    const far  = Math.max(this.CW, this.CH) * 0.55;
    let px, py;

    if      (dir===0) { px = this.cx()+lane; py = this.cy()-far; }
    else if (dir===2) { px = this.cx()+lane; py = this.cy()+far; }
    else if (dir===1) { px = this.cx()+far;  py = this.cy()+lane; }
    else              { px = this.cx()-far;  py = this.cy()+lane; }

    const v = { id:uid(), type, dir, px, py, speed:cfg.spd, passed:false,
                L:Math.round(this.RW()*0.44), W:Math.round(this.RW()*0.19),
                col:cfg.col, plate:genPlate(), _crashed:false };
    this.emgVehs.push(v);
    this._activateOverride(v);
  }

  _activateOverride(ev) {
    const now = performance.now();
    this.overrideActive = true;
    this.overrideDir    = ev.dir;
    this.overrideEnd    = now + 6000;
    const ns = ev.dir === 0 || ev.dir === 2;
    this.sigState = ns ? 'NS_GREEN' : 'EW_GREEN';
    this.sigDur   = 99999;
    this.phaseStartTime = now;

    this.emgCount++;
    this.emgByType[ev.type]++;

    const entry = {
      id: uid(), type: ev.type, plate: ev.plate,
      road: ROAD_NAMES[ev.dir], time: new Date().toLocaleTimeString(),
    };
    this.emgEntries.unshift(entry);
    if (this.emgEntries.length > 8) this.emgEntries.length = 8;

    this._addAlert('emg', '🚨 EMERGENCY DETECTED',
      `${EMG_CFG[ev.type].label} on Road ${ROAD_NAMES[ev.dir]} · Green corridor activated`, 'emg');
  }

  // ── violations ────────────────────────────────────────
  _triggerViolation(v) {
    this.vioCount++;
    this.vioByRoad[v.dir]++;
    const entry = {
      id: uid(), plate: v.plate, road: ROAD_NAMES[v.dir],
      dir: v.dir, time: new Date().toLocaleTimeString(),
    };
    this.violations.unshift(entry);
    if (this.violations.length > 15) this.violations.length = 15;
    this.vioFlashes.push({ px:v.px, py:v.py, ttl:80 });
    if (this.vioFlashes.length > 8) this.vioFlashes.length = 8;
    if (this.vioCount % 5 === 0)
      this._addAlert('warn', `⚠ ${this.vioCount} Violations`,
        `Road ${entry.road} is a repeat offender zone.`, 'warn');
  }

  // ── accidents ─────────────────────────────────────────
  _triggerAccident(vA, vB) {
    this.accCount++;
    const injured = 1 + Math.floor(Math.random() * 3);
    this.accInjured += injured;
    const resp = Math.round(3 + Math.random() * 5);
    this.respTimes.push(resp);
    if (this.respTimes.length > 20) this.respTimes.shift();

    const cpx = (vA.px + vB.px) / 2, cpy = (vA.py + vB.py) / 2;
    for (let k = 0; k < 4; k++)
      this.crashFlashes.push({
        px: cpx + (Math.random()-.5)*18, py: cpy + (Math.random()-.5)*18,
        ttl: 65 + k*5, maxTtl: 65 + k*5, r: 5 + k*4,
      });
    if (this.crashFlashes.length > 16) this.crashFlashes.length = 16;

    if (!vA.type) { vA.waiting=true; vA._wrecked=true; vA._wreckedTtl=80; }
    if (!vB.type) { vB.waiting=true; vB._wrecked=true; vB._wreckedTtl=80; }

    const entry = {
      id: this.accCount,
      roadA: ROAD_NAMES[vA.dir], roadB: ROAD_NAMES[vB.dir],
      plates: [vA.plate||'??', vB.plate||'??'],
      injured, time: new Date().toLocaleTimeString(), resp,
    };
    this.accidents.unshift(entry);
    if (this.accidents.length > 10) this.accidents.length = 10;

    setTimeout(() => {
      if (this.running) {
        this.spawnEmergency('ambulance', Math.floor(Math.random()*4));
        this.spawnEmergency('police', (vA.dir+2)%4);
      }
      this.accCleared++;
    }, 2200);

    this._addAlert('critical', '💥 COLLISION DETECTED',
      `Road ${entry.roadA} × ${entry.roadB} · ${injured} injured · Services dispatched`, 'critical');
  }

  // ── alerts ────────────────────────────────────────────
  _addAlert(type, title, body, severity) {
    this.alertCount++;
    const entry = { id:uid(), type, title, body, severity, time:new Date().toLocaleTimeString() };
    this.alerts.unshift(entry);
    if (this.alerts.length > 30) this.alerts.length = 30;
  }

  // ── environmental metrics ─────────────────────────────
  _tickEnvironment(dt) {
    this.envSimSec += dt / 1000;
    const rate = (this.vehs.length + this.emgVehs.length) * 0.0025 * (dt / 1000);
    this.envFuel += rate;
    this.envCO2  += rate * 2.3;
  }

  // ── system health (simulated) ─────────────────────────
  _tickHealth() {
    this.healthTick++;
    const t = this.healthTick;
    this.healthState = {
      cpuLoad: Math.round(8  + Math.sin(t*0.1)*6  + Math.random()*4),
      memLoad: Math.round(32 + Math.sin(t*0.05)*8 + Math.random()*3),
      latency: Math.round(1  + Math.random()*3),
      wifi:    Math.round(82 + Math.sin(t*0.08)*8),
      sensors: [true,true,true,true],
    };
    // random calibration flicker
    if (t % 120 === 0 && Math.random() > 0.85) {
      const idx = Math.floor(Math.random()*4);
      this.healthState.sensors = this.healthState.sensors.map((s,i) => i===idx ? false : s);
      this._addAlert('warn','⚠ SENSOR CALIBRATING',
        `Sensor ${ROAD_NAMES[idx]} performing auto-calibration.`,'warn');
      setTimeout(() => { if(this.healthState) this.healthState.sensors[idx]=true; }, 2500);
    }
  }

  // ── density drift ─────────────────────────────────────
  _tickDensity() {
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.003)
        this.dens[i] = Math.max(1, Math.min(this.maxD, this.dens[i] + (Math.random() > 0.5 ? 1 : -1)));
    }
  }

  // ── periodic system alerts ────────────────────────────
  _periodicAlerts() {
    this._alertTick = (this._alertTick || 0) + 1;
    if (this._alertTick % 2700 === 0) {          // ~45s at 60fps
      const r = ROAD_NAMES[Math.floor(Math.random()*4)];
      const msgs = [
        `Road ${r}: Unusual traffic pattern detected`,
        `Sensor ${r} reporting elevated readings`,
        `Road ${r}: Queue length exceeding threshold`,
      ];
      this._addAlert('warn','⚠ TRAFFIC ALERT', msgs[Math.floor(Math.random()*3)],'warn');
    }
    if (this._alertTick % 1800 === 0 && Math.random() > 0.6)
      this._addAlert('info','ℹ SYSTEM INFO','AI cycle optimisation complete. Signal timing adjusted.','info');
  }

  // ── main RAF loop ─────────────────────────────────────
  _loop(ts) {
    if (!this.running) return;

    const dt = Math.min(ts - this._lastTS, 50);
    this._lastTS = ts;
    this.frameN++;

    // ── UPDATE ORDER (spec) ──────────────────────────────
    // 1. updateSignals
    this._tickSignals(ts);
    // 2. updateVehicles
    this._maybeSpawn(dt);
    this._updateVehs(dt);
    // 3. detectCollisions
    this._checkCollisions();
    // 4. update emergency, environment, health
    this._updateEmgVehs(dt, ts);
    this._tickEnvironment(dt);
    this._periodicAlerts();
    if (this.frameN % 60 === 0) {
      this._tickHealth();
      this._tickDensity();
      this.uptimeSec++;
    }

    // 5. render (via callback to Renderer in TrafficCanvas)
    if (this.onRender) this.onRender(this);

    // 6. push React state snapshot every 6 frames
    if (this.frameN % 6 === 0) this._pushState(ts);

    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  _pushState(now) {
    const sig   = this.sigState;
    const isNS  = sig === 'NS_GREEN' || sig === 'NS_YELLOW';
    const elapsed = now - this.phaseStartTime;
    const remMs = Math.max(0, this.sigDur - elapsed);

    this.onStateUpdate({
      running:        this.running,
      cycleN:         this.cycleN,
      sigState:       sig,
      sigRemSec:      Math.ceil(remMs / 1000),
      sigPct:         remMs / this.sigDur,
      isNS,
      dens:           [...this.dens],
      vehCount:       this.vehs.length + this.emgVehs.length,
      overrideActive: this.overrideActive,
      overrideDir:    this.overrideDir,
      manualDir:      this.manualOverrideDir,
      manualRemSec:   Math.ceil(Math.max(0, this.manualOverrideEnd - now) / 1000),
      violations:     this.violations,
      vioCount:       this.vioCount,
      vioByRoad:      [...this.vioByRoad],
      accidents:      this.accidents,
      accCount:       this.accCount,
      accInjured:     this.accInjured,
      accCleared:     this.accCleared,
      accAvgResp:     this.respTimes.length
        ? Math.round(this.respTimes.reduce((a,b)=>a+b,0)/this.respTimes.length) : null,
      emgCount:       this.emgCount,
      emgByType:      { ...this.emgByType },
      emgEntries:     this.emgEntries,
      logEntries:     this.logEntries,
      alerts:         this.alerts,
      alertCount:     this.alertCount,
      envFuel:        this.envFuel,
      envCO2:         this.envCO2,
      envWait:        Math.min(95, Math.round(this.envSimSec * 0.08 + this.cycleN * 0.3)),
      envFlow:        this.vehs.length + this.emgVehs.length,
      health:         { ...this.healthState },
      uptimeSec:      this.uptimeSec,
      getSig:         (dir) => this.getSig(dir),
    });
  }

  // ── public control API ────────────────────────────────
  start() {
    if (this.running) return;
    this.running        = true;
    this.phaseStartTime = performance.now();
    this._lastTS        = performance.now();
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  reset() {
    this.pause();
    // Reset all sim state
    this.sigState        = 'NS_GREEN';
    this.phaseStartTime  = 0;
    this.sigDur          = 7000;
    this.cycleN          = 142;
    this.dens            = [8,4,6,3];
    this.vehs            = [];
    this.emgVehs         = [];
    this.spawnTick       = [0,0,0,0];
    this.violations      = [];
    this.vioCount        = 0;
    this.vioByRoad       = [0,0,0,0];
    this.vioFlashes      = [];
    this.accidents       = [];
    this.accCount        = 0;
    this.accInjured      = 0;
    this.accCleared      = 0;
    this.respTimes       = [];
    this.crashFlashes    = [];
    this.recentCrash.clear();
    this.emgCount        = 0;
    this.emgByType       = { police:0, ambulance:0, fire:0 };
    this.emgAutoTimer    = EMG_SPAWN_MS + 6000;
    this.overrideActive  = false;
    this.overrideDir     = -1;
    this.manualOverrideDir = -1;
    this.alerts          = [];
    this.alertCount      = 0;
    this.logEntries      = [];
    this.emgEntries      = [];
    this.envFuel         = 0;
    this.envCO2          = 0;
    this.envSimSec       = 0;
    this.sirenTick       = 0;
    this.frameN          = 0;
    this.uptimeSec       = 0;
    this._alertTick      = 0;
    this._buildWorld();
    this._pushState(performance.now());
  }

  forceGreen(dir) {
    if (!this.running) return false;
    this.manualOverrideDir = dir;
    this.manualOverrideEnd = performance.now() + 8000;
    this._addAlert('emg', `🟢 ROAD ${'ABCD'[dir]} FORCED GREEN`,
      `Manual override active for 8 seconds. AI resumes after.`, 'emg');
    return true;
  }

  resetSignals() {
    this.manualOverrideDir = -1;
    this.manualOverrideEnd = 0;
    this.overrideActive    = false;
    this.overrideDir       = -1;
    this.overrideEnd       = 0;
    this.sigState          = 'NS_GREEN';
    this.sigDur            = 7000;
    this.phaseStartTime    = performance.now();
    this._addAlert('info','⟳ Signals Reset','All signals returned to AI control.','info');
  }

  triggerEmergencyMode() {
    if (!this.running) return;
    const dir = Math.floor(Math.random()*4);
    this.spawnEmergency('police', dir);
    this.spawnEmergency('ambulance', (dir+2)%4);
  }

  drawStaticFrame() {
    if (this.onRender) this.onRender(this);
  }
}

export { EMG_CFG, ROAD_NAMES };
