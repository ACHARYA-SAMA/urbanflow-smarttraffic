export default function EmergencyPage({ simState, engineCtrl }) {
  const { emgCount, emgByType, emgEntries } = simState
  return (
    <>
      <div className="emg-hero">
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,234,0,.7)',letterSpacing:'3px',marginBottom:'8px'}}>// EMERGENCY VEHICLE SYSTEM</div>
        <div className="emg-count">{emgCount}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,234,0,.6)',letterSpacing:'2px'}}>EMERGENCY VEHICLES DETECTED</div>
      </div>
      <div className="emg-sg">
        <div className="emg-st"><div className="emg-sv">{emgByType.police}</div><div className="emg-sl">POLICE</div></div>
        <div className="emg-st"><div className="emg-sv">{emgByType.ambulance}</div><div className="emg-sl">AMBULANCE</div></div>
        <div className="emg-st"><div className="emg-sv">{emgByType.fire}</div><div className="emg-sl">FIRE TRUCK</div></div>
      </div>
      <div className="card glass-yellow">
        <div className="sec-lbl c-yellow">MANUAL DISPATCH</div>
        <div className="spawn-grid">
          {[['police','🚔','POLICE'],['ambulance','🚑','AMBULANCE'],['fire','🚒','FIRE TRUCK']].map(([type,icon,label])=>(
            <button key={type} className={`spawn-btn ${type}`} onClick={()=>engineCtrl.spawnEmergency(type, Math.floor(Math.random()*4))}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
      <div className="sec-lbl c-yellow">EMERGENCY FEED</div>
      <div style={{display:'flex',flexDirection:'column',gap:'9px'}}>
        {emgEntries.length===0
          ? <div style={{textAlign:'center',padding:'26px',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'var(--muted)'}}>🚨 No emergency vehicles · Start simulation</div>
          : emgEntries.map(e=>(
            <div key={e.id} className="emg-item">
              <div style={{fontSize:'20px'}}>{e.type==='police'?'🚔':e.type==='ambulance'?'🚑':'🚒'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className={`emg-type ${e.type}`}>{e.type.toUpperCase()} · {e.plate}</div>
                <div className="emg-det">Road {e.road} · Green corridor active</div>
                <span className={`emg-bdg ${e.type}`}>OVERRIDE</span>
              </div>
              <div className="emg-time">{e.time}</div>
            </div>
          ))
        }
      </div>
    </>
  )
}
