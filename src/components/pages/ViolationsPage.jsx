export default function ViolationsPage({ simState }) {
  const { vioCount, vioByRoad, violations } = simState
  const mi = vioByRoad.indexOf(Math.max(...vioByRoad))
  const rate = vioCount>0 ? Math.min(99,Math.round(vioCount/(vioCount+simState.cycleN*2)*100)) : 0
  return (
    <>
      <div className="vio-hero">
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,0,110,.7)',letterSpacing:'3px',marginBottom:'8px'}}>// VIOLATION DETECTION SYSTEM</div>
        <div className="vio-count">{vioCount}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'rgba(255,0,110,.6)',letterSpacing:'2px'}}>RED LIGHT VIOLATIONS</div>
      </div>
      <div className="vio-sg">
        <div className="vio-st"><div className="vio-sv">{vioCount}</div><div className="vio-sl">TODAY</div></div>
        <div className="vio-st"><div className="vio-sv">{rate}%</div><div className="vio-sl">RATE</div></div>
        <div className="vio-st"><div className="vio-sv">{vioCount>0?'RD '+'ABCD'[mi]:'—'}</div><div className="vio-sl">WORST ROAD</div></div>
      </div>
      <div className="sec-lbl c-pink">BY ROAD</div>
      <div className="rv-grid">
        {['A','B','C','D'].map((r,i)=>(
          <div key={r} className="rv-card"><div className="rv-name">ROAD {r}</div><div className="rv-num">{vioByRoad[i]}</div><div className="rv-lbl">violations</div></div>
        ))}
      </div>
      <div className="sec-lbl c-pink">LIVE LOG</div>
      <div style={{display:'flex',flexDirection:'column',gap:'9px'}}>
        {violations.length===0
          ? <div style={{textAlign:'center',padding:'26px',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'var(--muted)'}}>▶ Start simulation to detect violations</div>
          : violations.map(v=>(
            <div key={v.id} className="vio-item">
              <div style={{fontSize:'20px'}}>🚨</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="vio-plate">{v.plate}</div>
                <div className="vio-det">Road {v.road} · Red light violation</div>
                <span className="vio-bdg">RED LIGHT RUNNER</span>
              </div>
              <div className="vio-time">{v.time}</div>
            </div>
          ))
        }
      </div>
    </>
  )
}
