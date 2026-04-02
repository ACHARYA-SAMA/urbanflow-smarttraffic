import { useState, useEffect } from 'react'
import { useTraffic } from '../context/TrafficContext'

/* ════════ HEADER ════════ */
export function Header({ activePage, onNav }) {
  const { state } = useTraffic()
  const [uptime, setUptime] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setUptime(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (s) => {
    const h = String(Math.floor(s/3600)).padStart(2,'0')
    const m = String(Math.floor((s%3600)/60)).padStart(2,'0')
    const sec = String(s%60).padStart(2,'0')
    return `${h}:${m}:${sec}`
  }

  return (
    <header className="app-header">
      <div className="logo">
        <div className="logo-mark">🚦</div>
        <div>
          <div className="logo-text">URBAN FLOW</div>
          <div className="logo-sub">SMART TRAFFIC INTELLIGENCE</div>
        </div>
      </div>
      <div className="header-right">
        <div className="hstat"><div className="hstat-val">{state.vehCount}</div><div className="hstat-lbl">VEHICLES</div></div>
        <div className="hstat"><div className="hstat-val">{state.cycleN}</div><div className="hstat-lbl">CYCLES</div></div>
        <div className="alert-bell" onClick={() => onNav('alerts')} title="Alerts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="alert-count">{state.alertCount}</span>
        </div>
        <div className="live-badge"><div className="land-dot" />&nbsp;LIVE · {fmt(uptime)}</div>
      </div>
    </header>
  )
}

/* ════════ SIDEBAR ════════ */
const NAV = [
  { id:'home',        label:'Dashboard',   section:'MONITOR',      icon:<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/> },
  { id:'sim',         label:'Simulation',  icon:<><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></> },
  { id:'network',     label:'City Network',icon:<><circle cx="12" cy="5" r="3"/><circle cx="4" cy="19" r="3"/><circle cx="20" cy="19" r="3"/><line x1="12" y1="8" x2="4" y2="16"/><line x1="12" y1="8" x2="20" y2="16"/></> },
  { id:'ai',          label:'AI Decisions',icon:<><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></> },
  { id:'prediction',  label:'Predictions', section:'INTELLIGENCE', icon:<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
  { id:'analytics',   label:'Analytics',   icon:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
  { id:'environment', label:'Eco Impact',  icon:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></> },
  { id:'survey',      label:'Survey Data', icon:<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { id:'health',      label:'System Health',section:'SYSTEM',      icon:<><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></> },
  { id:'alerts',      label:'Alerts',      badge:'alertCount',      icon:<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
  { divider: true },
  { id:'violations',  label:'Violations',  section:'ENFORCEMENT', badge:'vioCount', badgeRed:true, icon:<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  { id:'emergency',   label:'Emergency',   badge:'emgCount',        icon:<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></> },
  { id:'accidents',   label:'Accidents',   badge:'accCount', badgeRed:true, icon:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
]

export function Sidebar({ activePage, onNav }) {
  const { state } = useTraffic()
  return (
    <aside className="sidebar">
      {NAV.map((n, i) => {
        if (n.divider) return <div key={i} className="sb-divider" />
        if (n.section) return (
          <div key={n.section + i}>
            <div className="sb-section">{n.section}</div>
            <NavItem n={n} active={activePage===n.id} onNav={onNav} state={state} />
          </div>
        )
        return <NavItem key={n.id} n={n} active={activePage===n.id} onNav={onNav} state={state} />
      })}
    </aside>
  )
}

function NavItem({ n, active, onNav, state }) {
  const badgeVal = n.badge ? state[n.badge] : 0
  return (
    <div className={`nav-item${active?' active':''}`} onClick={() => onNav(n.id)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.icon}</svg>
      {n.label}
      {n.badge && badgeVal > 0 && <span className={`nav-badge${n.badgeRed?' red':''}`}>{badgeVal}</span>}
    </div>
  )
}

/* ════════ BOTTOM NAV ════════ */
const BNAV = [
  { id:'home',       label:'Home',    icon:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> },
  { id:'sim',        label:'Sim',     icon:<><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></> },
  { id:'prediction', label:'Predict', icon:<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
  { id:'alerts',     label:'Alerts',  icon:<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
  { id:'health',     label:'Health',  icon:<><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></> },
]

export function BottomNav({ activePage, onNav }) {
  return (
    <nav className="bottom-nav">
      {BNAV.map(n => (
        <button key={n.id} className={`bnav-btn${activePage===n.id?' active':''}`} onClick={() => onNav(n.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.icon}</svg>
          {n.label}
        </button>
      ))}
    </nav>
  )
}

/* ════════ OVERRIDE BANNER ════════ */
export function OverrideBanner() {
  const { state } = useTraffic()
  const show = state.overrideActive
  return (
    <div className={`override-banner${show?' show':''}`}>
      🚨 EMERGENCY OVERRIDE — {state.overrideType?.toUpperCase() ?? 'EMERGENCY'} → ROAD {'ABCD'[state.overrideDir] ?? '?'}
    </div>
  )
}

/* ════════ ALERT TOASTS ════════ */
export function AlertToasts() {
  const { state } = useTraffic()
  const [visible, setVisible] = useState([])

  useEffect(() => {
    const latest = state.alerts[0]
    if (!latest) return
    setVisible(v => {
      if (v.find(x => x.id === latest.id)) return v
      const next = [...v.slice(-2), latest]
      return next
    })
  }, [state.alerts])

  const dismiss = (id) => setVisible(v => v.filter(x => x.id !== id))

  useEffect(() => {
    if (!visible.length) return
    const t = setTimeout(() => {
      setVisible(v => v.slice(1))
    }, 5500)
    return () => clearTimeout(t)
  }, [visible])

  const icons = { warn:'⚠', critical:'🔴', info:'ℹ', emg:'🚨' }

  return (
    <div className="toast-container">
      {visible.map(a => (
        <div key={a.id} className={`toast ${a.sev}`} onClick={() => dismiss(a.id)}>
          <div className="toast-icon">{icons[a.sev] ?? 'ℹ'}</div>
          <div>
            <div className={`toast-title ${a.sev}`}>{a.title}</div>
            <div className="toast-body">{a.body}</div>
            <div className="toast-time">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
