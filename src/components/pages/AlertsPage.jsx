const SEV_ICON = {critical:'🔴',warn:'⚠',info:'ℹ',emg:'🚨'}
export default function AlertsPage({ simState }) {
  return (
    <>
      <div className="card glass-yellow" style={{textAlign:'center',padding:'20px'}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'var(--ny)',letterSpacing:'3px',marginBottom:'4px'}}>// INCIDENT ALERT SYSTEM</div>
        <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:'clamp(28px,7vw,52px)',fontWeight:900,color:'var(--ny)'}}>{simState.alertCount}</div>
        <div style={{fontSize:'10px',color:'#8a8060'}}>TOTAL ALERTS</div>
      </div>
      <div className="sec-lbl c-yellow">LIVE ALERT FEED</div>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {simState.alerts.length===0
          ? <div style={{textAlign:'center',padding:'26px',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'var(--muted)'}}>✓ No active alerts · System monitoring normally</div>
          : simState.alerts.map(a=>(
            <div key={a.id} className={`alert-item ${a.severity}`}>
              <div style={{display:'flex',gap:'10px',alignItems:'flex-start'}}>
                <div style={{fontSize:'18px'}}>{SEV_ICON[a.severity]||'ℹ'}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:'10px',fontWeight:700,marginBottom:'3px'}} className={`toast-title ${a.severity}`}>{a.title}</div>
                  <div style={{fontSize:'10px',color:'#8ab0c0'}}>{a.body}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'var(--muted)',marginTop:'4px'}}>{a.time}</div>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  )
}
