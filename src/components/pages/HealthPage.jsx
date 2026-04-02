const COMPONENTS = [
  ['esp32','ESP32 Controller'],['sa','Sensor A (Road A)'],['sb','Sensor B (Road B)'],
  ['sc','Sensor C (Road C)'],['sd','Sensor D (Road D)'],['sig','Signal Controller'],
  ['cam','Camera Module'],['ai','AI Engine'],['net','Network Module'],['pw','Power Supply'],
]
const STATUSES = ['ONLINE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','RUNNING','ACTIVE','PROCESSING','CONNECTED','STABLE']
export default function HealthPage({ simState }) {
  const { health } = simState
  return (
    <>
      <div className="card glass-green" style={{textAlign:'center',padding:'22px'}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'var(--ng)',letterSpacing:'3px',marginBottom:'4px'}}>// SYSTEM HEALTH MONITOR</div>
        <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:'clamp(16px,3.5vw,24px)',fontWeight:900,color:'var(--ng)'}}>ALL SYSTEMS <span style={{color:'var(--nb)'}}>NOMINAL</span></div>
      </div>
      <div className="sec-lbl c-green">COMPONENT STATUS</div>
      <div className="health-grid">
        {COMPONENTS.map(([id,name],i)=>{
          const sensorIdx = ['sa','sb','sc','sd'].indexOf(id)
          const healthy   = sensorIdx>=0 ? (health.sensors[sensorIdx]!==false) : true
          return (
            <div key={id} className="health-item">
              <div className={`health-dot ${healthy?'online':'warn'}`}></div>
              <div>
                <div className="health-name">{name}</div>
                <div className={`health-status ${healthy?'online':'warn'}`}>{healthy?STATUSES[i]:'CALIBRATING'}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="sec-lbl c-blue">PERFORMANCE METRICS</div>
      <div className="card">
        {[['CPU Load', health.cpuLoad+'%', health.cpuLoad, 'linear-gradient(90deg,var(--ng),var(--nb))'],
          ['Memory Usage', health.memLoad+'%', health.memLoad, 'linear-gradient(90deg,var(--nb),var(--nv))'],
          ['Signal Latency', health.latency+'ms', Math.min(50,health.latency*8), 'linear-gradient(90deg,var(--ng),var(--ny))'],
          ['WiFi Signal', health.wifi+'%', health.wifi, 'linear-gradient(90deg,var(--nb),var(--ng))']
        ].map(([label,val,pct,bg])=>(
          <div key={label} className="health-bar-row" style={{marginTop:'10px'}}>
            <div className="hb-label"><span>{label}</span><span style={{color:'var(--ng)'}}>{val}</span></div>
            <div className="hb-track"><div className="hb-fill" style={{width:pct+'%',background:bg}}></div></div>
          </div>
        ))}
      </div>
    </>
  )
}
