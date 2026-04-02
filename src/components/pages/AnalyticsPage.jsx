export default function AnalyticsPage({ simState }) {
  const pcts = simState.dens.map(d => d/20*100)
  return (
    <>
      <div className="st-grid">
        <div className="st-tile"><div className="st-val g">38%</div><div className="st-lbl">Wait Time Reduction</div></div>
        <div className="st-tile"><div className="st-val b">{simState.cycleN}</div><div className="st-lbl">Signal Cycles</div></div>
        <div className="st-tile"><div className="st-val y">2.4×</div><div className="st-lbl">Throughput Increase</div></div>
        <div className="st-tile"><div className="st-val p">22%</div><div className="st-lbl">Emissions Reduced</div></div>
      </div>
      <div className="chart-card">
        <div className="chart-ttl">// ROAD DENSITY COMPARISON</div>
        <div className="bar-chart" style={{height:'90px'}}>
          {['ROAD A','ROAD B','ROAD C','ROAD D'].map((r,i)=>(
            <div key={i} className="bc">
              <div className="b" style={{height:pcts[i]+'%',background:`linear-gradient(0,${['var(--ng)','var(--nb)','var(--ny)','var(--np)'][i]},rgba(0,0,0,.2))`}}></div>
              <div className="bl">{r}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-ttl">// WAIT TIME — FIXED vs URBAN FLOW</div>
        <svg viewBox="0 0 320 80" style={{width:'100%',height:'80px'}}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff006e" stopOpacity=".35"/><stop offset="100%" stopColor="#ff006e" stopOpacity="0"/></linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00ff88" stopOpacity=".28"/><stop offset="100%" stopColor="#00ff88" stopOpacity="0"/></linearGradient>
          </defs>
          <polyline points="0,18 53,20 106,16 159,22 212,14 265,18 320,15" fill="none" stroke="#ff006e" strokeWidth="2" opacity=".7"/>
          <polygon points="0,18 53,20 106,16 159,22 212,14 265,18 320,15 320,80 0,80" fill="url(#g1)"/>
          <polyline points="0,55 53,46 106,38 159,30 212,24 265,18 320,14" fill="none" stroke="#00ff88" strokeWidth="2.2"/>
          <polygon points="0,55 53,46 106,38 159,30 212,24 265,18 320,14 320,80 0,80" fill="url(#g2)"/>
          <circle cx="320" cy="14" r="4" fill="#00ff88"/>
        </svg>
      </div>
      <div className="chart-card">
        <div className="chart-ttl">// PEAK TRAFFIC HOURS</div>
        {[['08:00–10:00','Moderate',3,false],['12:00–13:00','Critical',5,true],['16:00–18:00','High',4,true],['20:00–22:00','Low',2,false]].map(([time,label,pips,hi])=>(
          <div key={time} className="peak-row">
            <div className="peak-time">{time}</div>
            <div className="peak-pips">{[...Array(5)].map((_,k)=><div key={k} className={`pip${k<pips?(hi?' hi':' on'):''}`}></div>)}</div>
            <span style={{fontSize:'9px',color:hi?'var(--np)':'var(--muted)'}}>{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}
