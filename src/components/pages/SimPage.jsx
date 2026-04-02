export default function SimPage({ simState, engineCtrl, embeddedCanvas }) {
  // Canvas is rendered by DashboardLayout via TrafficCanvas; this page adds the controls below it
  if (embeddedCanvas) return (
    <>
      <div className="sec-lbl c-yellow">MANUAL OVERRIDE CONTROLS</div>
      <div className="card glass-yellow">
        <div style={{fontSize:'10px',color:'var(--muted)',marginBottom:'10px',fontFamily:"'Share Tech Mono',monospace"}}>Force green on selected road — overrides AI for 8 seconds</div>
        <div className="override-grid">
          {['A','B','C','D'].map((r,i)=>(
            <button key={i} className="btn btn-y" onClick={()=>engineCtrl.forceGreen(i)}>🟢 FORCE {r}</button>
          ))}
        </div>
        <div style={{marginTop:'8px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <button className="btn btn-r" style={{flex:1,minWidth:'140px'}} onClick={()=>engineCtrl.triggerEmergencyMode()}>🚨 EMERGENCY MODE</button>
          <button className="btn btn-b" style={{flex:1,minWidth:'120px'}} onClick={()=>engineCtrl.resetSignals()}>⟳ RESET SIGNALS</button>
        </div>
      </div>
      <div className="timer-wrap" style={{marginTop:'2px'}}>
        <div>
          <div className="timer-lbl">ACTIVE SIGNAL</div>
          <div className="timer-road">{simState.isNS?'Road A & C':'Road B & D'}</div>
        </div>
        <div className="timer-val">{simState.cycleN}</div>
      </div>
    </>
  )
  return null
}
