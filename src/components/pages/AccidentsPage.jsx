export default function AccidentsPage({ simState }) {
  const { accCount, accInjured, accCleared, accAvgResp, accidents } = simState
  return (
    <>
      <div className="acc-hero">
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,107,0,.7)',letterSpacing:'3px',marginBottom:'8px'}}>// COLLISION DETECTION SYSTEM</div>
        <div className="acc-count">{accCount}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,107,0,.6)',letterSpacing:'2px'}}>COLLISIONS DETECTED</div>
      </div>
      <div className="acc-sg">
        <div className="acc-st"><div className="acc-sv">{accInjured}</div><div className="acc-sl">INJURED</div></div>
        <div className="acc-st"><div className="acc-sv">{accCleared}</div><div className="acc-sl">CLEARED</div></div>
        <div className="acc-st"><div className="acc-sv">{accAvgResp?accAvgResp+'min':'—'}</div><div className="acc-sl">AVG RESP</div></div>
      </div>
      <div style={{background:'var(--gls)',border:'1px solid var(--border)',borderRadius:'11px',padding:'12px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>
        {accCount>0
          ? <span style={{color:'#ff5000'}}>⚠ {accCount} incident{accCount>1?'s':''} · Services dispatched · Avg response {accAvgResp||'—'}min</span>
          : '● Monitoring active — no incidents detected'}
      </div>
      <div className="sec-lbl c-orange">INCIDENT LOG</div>
      <div style={{display:'flex',flexDirection:'column',gap:'9px'}}>
        {accidents.length===0
          ? <div style={{textAlign:'center',padding:'26px',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'var(--muted)'}}>💥 No collisions · Start simulation to monitor</div>
          : accidents.map(a=>(
            <div key={a.id} className="acc-item">
              <div style={{fontSize:'20px'}}>💥</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="acc-type">INCIDENT #{a.id} · Road {a.roadA} × {a.roadB}</div>
                <div className="acc-det">{a.plates.join(' & ')} · {a.injured} injured · ETA {a.resp}min</div>
                <span className="acc-bdg">AUTHORITIES NOTIFIED</span>
              </div>
              <div className="acc-time">{a.time}</div>
            </div>
          ))
        }
      </div>
    </>
  )
}
