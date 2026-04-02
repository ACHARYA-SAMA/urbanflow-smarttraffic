export default function PredictionPage({ simState }) {
  const roads = ['A — NORTHBOUND','B — EASTBOUND','C — SOUTHBOUND','D — WESTBOUND']
  return (
    <>
      <div className="card glass-purple" style={{textAlign:'center',padding:'22px'}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'var(--nv)',letterSpacing:'3px',marginBottom:'6px'}}>// TRAFFIC PREDICTION ENGINE</div>
        <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:'clamp(18px,4vw,28px)',fontWeight:900,color:'var(--nv)',marginBottom:'4px'}}>AI-POWERED FORECAST</div>
        <div style={{fontSize:'11px',color:'#8a80a0'}}>Predictive analysis based on current density · historical patterns · signal timing</div>
      </div>
      <div className="sec-lbl c-purple">CONGESTION FORECAST — NEXT 10 MINUTES</div>
      {simState.dens.map((d,i)=>{
        const pct=Math.min(95,Math.round(d/20*100*1.1))
        const action=pct>70?'→ Extend green signal immediately':pct>45?'→ Prepare to adjust timing':'→ Maintain current timing'
        const meta=pct>70?`High risk · Expected congestion in ~${Math.round(2+Math.random()*4)} min`:pct>45?'Moderate risk · Monitor closely':'Low risk · Traffic flowing normally'
        return (
          <div key={i} className="pred-card" style={{position:'relative'}}>
            <div className="pred-road">ROAD {roads[i]}</div>
            <div className="pred-bar-wrap">
              <div className="pred-track"><div className="pred-fill" style={{width:pct+'%'}}></div></div>
              <div className="pred-pct">{pct}%</div>
            </div>
            <div className="pred-meta">{meta}</div>
            <span className="pred-action">{action}</span>
          </div>
        )
      })}
      <div className="sec-lbl c-purple">PEAK HOUR FORECAST</div>
      <div className="chart-card">
        <div className="chart-ttl">// PREDICTED CONGESTION — NEXT 6 HOURS</div>
        <div className="bar-chart" style={{height:'90px'}}>
          {[40,55,85,70,45,30].map((h,i)=>(
            <div key={i} className="bc">
              <div className="b" style={{height:h+'%',background:h>70?'linear-gradient(0,var(--np),rgba(255,0,110,.3))':h>50?'linear-gradient(0,var(--ny),rgba(255,234,0,.3))':'linear-gradient(0,var(--nv),rgba(199,125,255,.3))'}}></div>
              <div className="bl">{i===0?'Now':'+'+(i)+'h'}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
