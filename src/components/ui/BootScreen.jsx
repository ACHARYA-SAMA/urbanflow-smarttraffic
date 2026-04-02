import { useState, useEffect } from 'react'

const CHECKS = [
  'Initializing neural traffic core...',
  'Calibrating road sensors A–D...',
  'Loading adaptive signal matrix...',
  'Connecting to city-wide network...',
  'Deploying AI decision engine v3.0...',
  'System ready.',
]

export default function BootScreen({ onComplete }) {
  const [lineIdx, setLineIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let line = 0
    const iv = setInterval(() => {
      line++
      setLineIdx(line)
      setProgress(Math.round((line / CHECKS.length) * 100))
      if (line >= CHECKS.length) {
        clearInterval(iv)
        setTimeout(() => setFading(true), 500)
        setTimeout(() => onComplete(), 1100)
      }
    }, 340)
    return () => clearInterval(iv)
  }, [onComplete])

  return (
    <div className={`boot-screen${fading ? ' boot-fade' : ''}`}>
      <div className="boot-inner">
        <div className="boot-logo">
          <div className="boot-logo-mark">🚦</div>
          <div className="boot-logo-text">URBAN FLOW</div>
          <div className="boot-logo-sub">SMART TRAFFIC INTELLIGENCE PLATFORM · v3.0</div>
        </div>

        <div className="boot-title">SYSTEM INITIALIZING</div>

        <div className="boot-bar-wrap">
          <div className="boot-bar">
            <div className="boot-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="boot-pct">{progress}%</div>
        </div>

        <div className="boot-log">
          {CHECKS.slice(0, lineIdx).map((c, i) => (
            <div key={i} className={`boot-line${i === lineIdx - 1 ? ' boot-line-active' : ''}`}>
              <span className="boot-prompt">{'>'}</span>
              <span>{c}</span>
              {i === lineIdx - 1 && <span className="boot-cursor" />}
              {i < lineIdx - 1 && <span className="boot-ok"> OK</span>}
            </div>
          ))}
        </div>

        <div className="boot-scanning" />
      </div>
    </div>
  )
}
