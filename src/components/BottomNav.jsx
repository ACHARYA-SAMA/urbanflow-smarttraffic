const TABS = [
  { id:'home',       label:'Home',    icon:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { id:'sim',        label:'Sim',     icon:'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', circle:true },
  { id:'prediction', label:'Predict', icon:'M22 12 18 12 15 21 9 3 6 12 2 12', isPoly:true },
  { id:'alerts',     label:'Alerts',  icon:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
  { id:'health',     label:'Health',  icon:'M22 12h-4l-3 9L9 3l-3 9H2' },
]
export default function BottomNav({ activePage, onGoTo }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(t => (
        <button key={t.id} className={`bnav-btn${activePage===t.id?' active':''}`} onClick={()=>onGoTo(t.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={t.icon}/></svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
