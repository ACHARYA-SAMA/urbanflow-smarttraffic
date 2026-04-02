import { useTheme } from '../context/ThemeContext.jsx'
import VoiceToggleButton from './VoiceToggleButton.jsx'

export default function Header({ simState, onGoTo, voiceEnabled, onToggle }) {
  const { theme, toggleTheme } = useTheme()

  const fmt = (s) => {
    const h=String(Math.floor(s/3600)).padStart(2,'0')
    const m=String(Math.floor((s%3600)/60)).padStart(2,'0')
    const sec=String(s%60).padStart(2,'0')
    return `${h}:${m}:${sec}`
  }
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark">🚦</div>
        <div><div className="logo-text">URBAN FLOW</div><div className="logo-sub">SMART TRAFFIC INTELLIGENCE</div></div>
      </div>
      <div className="header-right">
        <div className="hstat"><div className="hstat-val">{simState.vehCount}</div><div className="hstat-lbl">VEHICLES</div></div>
        <div className="hstat"><div className="hstat-val">{simState.cycleN}</div><div className="hstat-lbl">CYCLES</div></div>
        <div className="alert-bell" onClick={()=>onGoTo('alerts')} title="Alerts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="alert-count">{simState.alertCount}</span>
        </div>
        <div className="live-badge"><div className="land-dot"></div>LIVE · {fmt(simState.uptimeSec)}</div>
        <button
          className="hdr-theme-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <VoiceToggleButton enabled={voiceEnabled} onToggle={onToggle} />
      </div>
    </header>
  )
}
