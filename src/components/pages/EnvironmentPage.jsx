export default function EnvironmentPage({ simState }) {
  const { envFuel, envCO2, envWait, envFlow } = simState
  const maxF=50,maxC=100,maxW=95,maxFl=30
  return (
    <>
      <div className="card glass-green" style={{textAlign:'center',padding:'24px'}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'var(--ng)',letterSpacing:'3px',marginBottom:'6px'}}>// ENVIRONMENTAL IMPACT DASHBOARD</div>
        <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:'clamp(18px,4vw,28px)',fontWeight:900,background:'linear-gradient(90deg,var(--ng),var(--nb))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>ECO BENEFIT METRICS</div>
      </div>
      <div className="st-grid">
        {[
          ['env-big g',envFuel.toFixed(1),'LITRES FUEL SAVED',envFuel,maxF,'linear-gradient(90deg,var(--ng),var(--nb))'],
          ['env-big b',envCO2.toFixed(1),'kg CO₂ REDUCED',envCO2,maxC,'linear-gradient(90deg,var(--nb),var(--nv))'],
          ['env-big y',envWait,'SEC AVG WAIT SAVED',envWait,maxW,'linear-gradient(90deg,var(--ny),var(--no))'],
          ['env-big v',envFlow,'VEHICLES OPTIMISED',envFlow,maxFl,'linear-gradient(90deg,var(--nv),var(--np))'],
        ].map(([cls,val,label,v,max,bg])=>(
          <div key={label} className="st-tile">
            <div className={cls}>{val}</div>
            <div style={{fontSize:'9px',color:'var(--ng)'}}>{label}</div>
            <div className="env-bar"><div className="env-bar-fill" style={{width:Math.min(100,v/max*100)+'%',background:bg}}></div></div>
          </div>
        ))}
      </div>
      <div className="sec-lbl c-green">IMPACT BREAKDOWN</div>
      <div className="card glass-green">
        <div className="d-list">
          {[['Idle Time Cut',38,'linear-gradient(90deg,var(--ng),var(--nb))'],
            ['Fuel Efficiency',22,'linear-gradient(90deg,var(--nb),var(--nv))'],
            ['Emissions Down',19,'linear-gradient(90deg,var(--nv),var(--np))'],
            ['Flow Improvement',56,'linear-gradient(90deg,var(--ny),var(--no))']
          ].map(([label,pct,bg])=>(
            <div key={label} className="d-row">
              <div className="d-road" style={{width:'130px',fontSize:'9px'}}>{label}</div>
              <div className="d-track"><div className="d-fill" style={{width:pct+'%',background:bg}}></div></div>
              <div className="d-num">{pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
