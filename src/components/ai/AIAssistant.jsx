import { useState, useEffect, useRef, useCallback } from 'react'

// ── Log lines pool ────────────────────────────────────────
const IDLE_LINES = [
  '> SCANNING INTERSECTION NODES',
  '> TRAFFIC LOAD: NOMINAL',
  '> SIGNAL MATRIX: ACTIVE',
  '> OPTIMIZING FLOW DISTRIBUTION',
  '> ALL SENSORS: ONLINE',
  '> NETWORK LATENCY: 2ms',
  '> AI CYCLE: COMPLETE',
  '> DENSITY-PRIORITY ALGORITHM: ENGAGED',
  '> MONITORING ROADS A · B · C · D',
  '> EMERGENCY PROTOCOL: STANDBY',
  '> INTERSECTION THROUGHPUT: NORMAL',
  '> ADAPTIVE TIMING: RECALIBRATED',
]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Derive a command-line entry from live simState events
function liveLines(simState) {
  const lines = []
  if (!simState) return lines
  if (simState.overrideActive) {
    lines.push('! EMERGENCY OVERRIDE ACTIVE')
    lines.push(`! GREEN CORRIDOR: ROAD ${'ABCD'[simState.overrideDir] ?? '?'}`)
  }
  if (simState.logEntries?.[0]) {
    const e = simState.logEntries[0]
    lines.push(`> ROAD ${e.rn} → GREEN PHASE`)
    lines.push(`> LOAD: ${e.load} VEHICLES  DUR: ${e.dur}s`)
  }
  if (simState.alerts?.[0]) {
    const a = simState.alerts[0]
    const pfx = a.severity === 'critical' ? '!' : '>'
    // strip emoji, uppercase
    lines.push(`${pfx} ${a.title.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase()}`)
  }
  return lines.slice(0, 3)
}

// Status level: 0=normal 1=warn 2=alert
function statusLevel(simState) {
  if (!simState) return 0
  if (simState.overrideActive) return 2
  if (simState.alerts?.[0]?.severity === 'critical') return 2
  if (simState.alerts?.[0]?.severity === 'warn') return 1
  return 0
}

export default function AIAssistant({ simState, voiceEnabled }) {
  // ── Panel visibility ──────────────────────────────────
  const [open,      setOpen]      = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [visible,   setVisible]   = useState(false)

  // ── Position / drag ───────────────────────────────────
  const [pos,     setPos]     = useState({ x: 18, y: 88 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)
  const panelRef  = useRef(null)

  // ── Log lines state ───────────────────────────────────
  const [lines, setLines] = useState([])
  const idxRef = useRef(0)

  const level = statusLevel(simState)
  const dotColor = level === 2 ? '#ff3b3b' : level === 1 ? '#ffbd2e' : '#00ff88'

  // Appear after boot
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1400)
    return () => clearTimeout(t)
  }, [])

  // Build log lines from simState or rotate idle lines
  useEffect(() => {
    const live = liveLines(simState)
    if (live.length) {
      // Push live lines in
      setLines(prev => {
        const next = [...prev, ...live.map(l => ({ text: l, id: Date.now() + Math.random(), fresh: true }))]
        return next.slice(-5) // keep last 5
      })
      return
    }

    // Idle: cycle through IDLE_LINES, one per 2.2 s
    const iv = setInterval(() => {
      const text = IDLE_LINES[idxRef.current % IDLE_LINES.length]
      idxRef.current++
      setLines(prev => {
        const entry = { text, id: Date.now(), fresh: true }
        const next  = [...prev, entry].slice(-5)
        return next
      })
    }, 2200)
    return () => clearInterval(iv)
  }, [simState?.logEntries?.[0]?.cycleN, simState?.alerts?.[0]?.id, simState?.overrideActive])

  // Mark lines as not-fresh after 300 ms (so animation plays once)
  useEffect(() => {
    const t = setTimeout(() => {
      setLines(prev => prev.map(l => ({ ...l, fresh: false })))
    }, 320)
    return () => clearTimeout(t)
  }, [lines.length])

  // ── Drag ──────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    setDragging(true)
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const pw = panelRef.current?.offsetWidth  ?? 280
      const ph = panelRef.current?.offsetHeight ?? 200
      setPos({
        x: clamp(dragStart.current.px + e.clientX - dragStart.current.mx, 0, window.innerWidth  - pw),
        y: clamp(dragStart.current.py + e.clientY - dragStart.current.my, 0, window.innerHeight - ph),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',  onUp)
    }
  }, [dragging])

  if (!visible) return null

  // ── Floating re-open button ───────────────────────────
  if (!open) {
    return (
      <button
        className="ait-reopen"
        style={{ left: pos.x, top: pos.y }}
        onClick={() => { setOpen(true); setMinimized(false) }}
        title="Open AI Status Panel"
      >
        AI
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className={`ait-panel${minimized ? ' ait-min' : ''}${dragging ? ' ait-drag' : ''}${level === 2 ? ' ait-alert' : level === 1 ? ' ait-warn' : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ── Title bar ────────────────────────────────── */}
      <div className="ait-titlebar" onMouseDown={onMouseDown}>
        <div className="ait-titlebar-left">
          <span className="ait-dot" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
          <span className="ait-title">URBAN FLOW CORE</span>
        </div>
        <div className="ait-titlebar-right">
          <button className="ait-tb-btn" onClick={() => setMinimized(m => !m)} title={minimized ? 'Expand' : 'Minimize'}>
            {minimized ? '▲' : '▬'}
          </button>
          <button className="ait-tb-btn ait-close" onClick={() => setOpen(false)} title="Close">✕</button>
        </div>
      </div>

      {/* ── Body (hidden when minimized) ─────────────── */}
      {!minimized && (
        <div className="ait-body">
          {/* Status row */}
          <div className="ait-status-row">
            <span className="ait-status-label">SYSTEM STATUS</span>
            <span className="ait-status-val" style={{ color: dotColor }}>
              {level === 2 ? 'ALERT' : level === 1 ? 'WARNING' : 'NOMINAL'}
            </span>
          </div>
          <div className="ait-divider" />

          {/* Log output */}
          <div className="ait-log">
            {lines.map((l) => (
              <div
                key={l.id}
                className={`ait-log-line${l.fresh ? ' ait-line-fresh' : ''} ${l.text.startsWith('!') ? 'ait-line-alert' : ''}`}
              >
                {l.text}
              </div>
            ))}
          </div>

          <div className="ait-divider" />

          {/* Footer: live stats + voice indicator */}
          <div className="ait-footer">
            {simState?.running ? (
              <>
                <span className="ait-stat">CYC <b>{simState.cycleN}</b></span>
                <span className="ait-stat-sep">·</span>
                <span className="ait-stat">VEH <b>{simState.vehCount}</b></span>
                <span className="ait-stat-sep">·</span>
                <span className="ait-stat">SIG <b>{simState.isNS ? 'A·C' : 'B·D'}</b></span>
              </>
            ) : (
              <span className="ait-stat ait-standby">STANDBY — START SIMULATION</span>
            )}
            {voiceEnabled && <span className="ait-voice-icon" title="Voice narration active">▶</span>}
          </div>
        </div>
      )}
    </div>
  )
}
