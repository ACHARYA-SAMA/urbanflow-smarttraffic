export default function AIPage({ simState }) {
  return (
    <>
      <div className="ai-alert">
        <div className="ai-icon">🤖</div>
        <div><div className="ai-title">DENSITY-PRIORITY ALGORITHM ACTIVE</div>
          <div className="ai-text">Evaluating all road segments every cycle. Green signal allocated to highest-density approach.</div></div>
      </div>
      <div className="sec-lbl c-green">DECISION LOG</div>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {simState.logEntries.length === 0
          ? <div style={{textAlign:'center',padding:'28px',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'var(--muted)'}}>▶ Start the simulation to see live AI decisions</div>
          : simState.logEntries.map((e,i)=>(
            <div key={i} className={`log-item ${e.cls}`}>
              <div className="log-time">{e.t} — CYCLE #{e.cycleN}</div>
              <div className="log-dec" style={{color:e.col}}>🟢 Road {e.rn} → GREEN</div>
              <div className="log-rsn">Density load: {e.load} vehicles · Duration: {e.dur}s</div>
              <span className={`log-tag ${e.cls}`}>DENSITY PRIORITY</span>
            </div>
          ))
        }
      </div>
    </>
  )
}
