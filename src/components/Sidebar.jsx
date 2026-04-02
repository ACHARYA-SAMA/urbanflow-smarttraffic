const NAV = [
  { id:'home',        icon:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', label:'Dashboard',   section:'MONITOR' },
  { id:'sim',         icon:'M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83', label:'Simulation',   circle:true },
  { id:'network',     icon:'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', label:'City Network' },
  { id:'ai',          icon:'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18', label:'AI Decisions', dividerBefore:true, section2:'INTELLIGENCE' },
  { id:'prediction',  icon:'M22 12 18 12 15 21 9 3 6 12 2 12', label:'Predictions',  isPoly:true },
  { id:'analytics',   icon:'M18 20v-10M12 20V4M6 20v-6', label:'Analytics' },
  { id:'environment', icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label:'Eco Impact' },
  { id:'survey',      icon:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', label:'Survey Data',  section3:'SYSTEM' },
  { id:'health',      icon:'M22 12h-4l-3 9L9 3l-3 9H2', label:'System Health' },
  { id:'alerts',      icon:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', label:'Alerts',       badge:'alertCount', badgeRed:false },
  { id:'violations',  icon:'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01', label:'Violations',   badge:'vioCount', badgeRed:true, section4:'ENFORCEMENT' },
  { id:'emergency',   icon:'M13 2 3 14 12 14 11 22 21 10 12 10 13 2', label:'Emergency',    badge:'emgCount', badgeRed:false, isPoly2:true },
  { id:'accidents',   icon:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01', label:'Accidents',    badge:'accCount', badgeRed:true },
]

export default function Sidebar({ activePage, onGoTo, simState }) {
  return (
    <aside className="sidebar">
      {NAV.map((n, i) => {
        const showSection = n.section && i===0
        const showSection2 = n.section2
        const showSection3 = n.section3
        const showSection4 = n.section4
        const showDivider  = showSection3 || showSection4
        const badgeVal = n.badge ? simState[n.badge] : null
        return (
          <span key={n.id}>
            {showSection  && <div className="sb-section">{n.section}</div>}
            {showSection2 && <div className="sb-section">{n.section2}</div>}
            {showSection3 && <div className="sb-section">{n.section3}</div>}
            {showSection4 && <><div className="sb-divider"/><div className="sb-section">{n.section4}</div></>}
            <div className={`nav-item${activePage===n.id?' active':''}`} onClick={()=>onGoTo(n.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={n.icon}/>
              </svg>
              {n.label}
              {badgeVal>0 && <span className={`nav-badge${n.badgeRed?' red':''}`}>{badgeVal}</span>}
            </div>
          </span>
        )
      })}
    </aside>
  )
}
