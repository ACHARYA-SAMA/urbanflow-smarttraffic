import { useState, useEffect, useRef } from 'react'

// ── System message pool ──────────────────────────────────────────
const IDLE_MESSAGES = [
  'SCANNING INTERSECTION NODES\nTRAFFIC LOAD: NOMINAL\nSIGNAL MATRIX: ACTIVE',
  'MONITORING ROADS A · B · C · D\nDENSITY PRIORITY: ENGAGED\nADAPTIVE TIMING: ON',
  'SENSOR GRID: ONLINE\nNETWORK LATENCY: 2ms\nAI CYCLE: COMPLETE',
  'OPTIMIZING FLOW DISTRIBUTION\nINTERSECTION THROUGHPUT: NORMAL\nALL SYSTEMS: NOMINAL',
  'EMERGENCY PROTOCOL: STANDBY\nSIGNAL OPTIMIZATION ACTIVE\nREAL-TIME ANALYSIS: RUNNING',
  'REAL-WORLD CONGESTION DETECTED\nSECUNDERABAD ZONE: MODERATE\nSIMULATED OPTIMIZATION APPLIED',
  'SCANNING HYDERABAD CORRIDOR\nTRAFFIC LOAD: ELEVATED\nAI REROUTING: IN PROGRESS',
  'ADAPTIVE SIGNAL CONTROL: ACTIVE\nPEAK HOUR PROTOCOL: ENABLED\nSYSTEM PERFORMANCE: OPTIMAL',
]

function getStatusMessage(simState) {
  if (!simState) return null
  if (simState.overrideActive) {
    const road = 'ABCD'[simState.overrideDir] ?? '?'
    return `EMERGENCY OVERRIDE ACTIVE\nGREEN CORRIDOR: ROAD ${road}\nALL OTHER ROADS: HALTED`
  }
  if (simState.alerts?.[0]?.severity === 'critical') {
    const title = simState.alerts[0].title.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase()
    return `CRITICAL ALERT DETECTED\n${title}\nPRIORITY RESPONSE: ACTIVE`
  }
  if (simState.logEntries?.[0]) {
    const e = simState.logEntries[0]
    return `ROAD ${e.rn} → GREEN PHASE\nLOAD: ${e.load} VEHICLES  DUR: ${e.dur}s\nDENSITY-PRIORITY ALGORITHM: APPLIED`
  }
  return null
}

export default function HologramAI({ simState }) {
  const [open, setOpen]           = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible]     = useState(false)
  const [message, setMessage]     = useState(IDLE_MESSAGES[0])
  const [fading, setFading]       = useState(false)
  const idxRef  = useRef(1)
  const timerRef = useRef(null)

  // Appear after a short boot delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1600)
    return () => clearTimeout(t)
  }, [])

  // Fade in new message
  const showMessage = (msg) => {
    setFading(true)
    setTimeout(() => {
      setMessage(msg)
      setFading(false)
    }, 350)
  }

  // Update message from simState or rotate idle
  useEffect(() => {
    const live = getStatusMessage(simState)
    if (live) { showMessage(live); return }

    timerRef.current = setInterval(() => {
      const next = IDLE_MESSAGES[idxRef.current % IDLE_MESSAGES.length]
      idxRef.current++
      showMessage(next)
    }, 4000)
    return () => clearInterval(timerRef.current)
  }, [simState?.overrideActive, simState?.logEntries?.[0]?.cycleN, simState?.alerts?.[0]?.id])

  if (!visible) return null

  // ── Floating reopen button ──────────────────────────────────
  if (!open) {
    return (
      <button
        className="holo-reopen"
        onClick={() => { setOpen(true); setMinimized(false) }}
        title="Open AI Hologram"
        aria-label="Open AI Hologram"
      >
        <span className="holo-reopen-dot" />
        AI
      </button>
    )
  }

  return (
    <div className={`holo-container${minimized ? ' holo-minimized' : ''}`} role="complementary" aria-label="AI Hologram Panel">
      {/* ── Speech cloud bubble ──────────────────────────── */}
      {!minimized && (
        <div className={`holo-cloud${fading ? ' holo-cloud-fade' : ''}`} aria-live="polite">
          <pre className="holo-cloud-text">{message}</pre>
          <div className="holo-cloud-tail" />
        </div>
      )}

      {/* ── Hologram core ────────────────────────────────── */}
      <div className="holo-core-wrap">
        {/* Rotating outer ring */}
        <div className="holo-ring holo-ring-outer" />
        <div className="holo-ring holo-ring-mid" />

        {/* Glowing core circle */}
        <div className="holo-core">
          <div className="holo-core-inner">
            <div className="holo-core-dot" />
          </div>
        </div>

        {/* Control buttons */}
        <button
          className="holo-btn holo-minimize"
          onClick={() => setMinimized(m => !m)}
          title={minimized ? 'Expand' : 'Minimize'}
          aria-label={minimized ? 'Expand AI panel' : 'Minimize AI panel'}
        >
          {minimized ? '▲' : '▬'}
        </button>
        <button
          className="holo-btn holo-close"
          onClick={() => setOpen(false)}
          title="Close AI Hologram"
          aria-label="Close AI Hologram"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
