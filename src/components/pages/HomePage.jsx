import useAnimatedCounter from '../../hooks/useAnimatedCounter.js'

const ROAD_IDS = ['a','b','c','d']
const ROAD_DIRS = ['↓','←','↑','→']

function sigColor(sig) {
  return sig==='green'?'var(--ng)':sig==='yellow'?'var(--ny)':'var(--np)'
}
function sigClass(sig) { return sig==='green'?'g':sig==='yellow'?'y':'r' }

export default function HomePage({ simState }) {
  const sigs       = [0,1,2,3].map(i => simState.getSig(i))
  const vehCount   = useAnimatedCounter(simState.vehCount)
  const cycleN     = useAnimatedCounter(simState.cycleN)
  const efficiency = useAnimatedCounter(97)

  return (
    <>
      <div className="hero">
        <div className="hero-eye">// URBAN FLOW SMART TRAFFIC INTELLIGENCE PLATFORM v3.0</div>
        <h1 className="hero-title">Traffic Control<span className="acc">Command Center</span></h1>
        <p className="hero-desc">Adaptive signal management · AI-driven density priority · Emergency override · Environmental monitoring</p>
        <div className="hero-grid">
          <div className="kpi"><div className="kpi-val">{vehCount}</div><div className="kpi-lbl">Vehicles Active</div></div>
          <div className="kpi"><div className="kpi-val">{cycleN}</div><div className="kpi-lbl">Signal Cycles</div></div>
          <div className="kpi"><div className="kpi-val">38%</div><div className="kpi-lbl">Wait Reduction</div></div>
          <div className="kpi"><div className="kpi-val">{efficiency}%</div><div className="kpi-lbl">System Efficiency</div></div>
        </div>
      </div>
      <div className="ai-alert">
        <div className="ai-icon">🤖</div>
        <div>
          <div className="ai-title">AI DECISION ENGINE — {simState.running?'ACTIVE':'STANDBY'}</div>
          <div className="ai-text">
            {simState.logEntries[0]
              ? `Road ${simState.logEntries[0].rn} → GREEN. Load: ${simState.logEntries[0].load} vehicles. ${simState.logEntries[0].dur}s allocated.`
              : 'Monitoring all road segments. Density-priority algorithm engaged.'}
          </div>
        </div>
      </div>
      <div className="sec-lbl c-blue">LIVE SIGNAL STATUS</div>
      <div className="sig-grid">
        {[0,1,2,3].map(i=>{
          const sig=sigs[i]; const pct=simState.dens[i]/20*100
          return (
            <div key={i} className={`sig-card ${sig==='green'?'ag':'ar'}`}>
              <div className="sig-top">
                <div className="sig-name">ROAD {ROAD_IDS[i].toUpperCase()}</div>
                <div className={`sig-ind ${sigClass(sig)}`}></div>
              </div>
              <div className="sig-cnt">{simState.dens[i]}</div>
              <div className="sig-lbl">vehicles</div>
              <div className="sig-bar">
                <div className="sig-bar-fill" style={{width:pct+'%',background:sig==='green'?'linear-gradient(90deg,var(--ng),var(--nb))':'linear-gradient(90deg,var(--np),var(--no))'}}></div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="timer-wrap">
        <div>
          <div className="timer-lbl">ACTIVE GREEN ROAD</div>
          <div className="timer-road">
            {simState.overrideActive ? '🚨 Override' : simState.manualDir>=0 ? `👮 Road ${'ABCD'[simState.manualDir]}` : simState.isNS ? 'Road A & C' : 'Road B & D'}
          </div>
        </div>
        <div className="timer-val">
          {simState.overrideActive ? 'OVR' : simState.manualDir>=0 ? simState.manualRemSec+'s' : simState.sigRemSec+'s'}
        </div>
      </div>
      <div className="sec-lbl c-green">DENSITY MONITOR</div>
      <div className="card glass-green">
        <div className="d-list">
          {[0,1,2,3].map(i=>{
            const pct=simState.dens[i]/20*100
            const sig=sigs[i]
            return (
              <div key={i} className="d-row">
                <div className="d-road">ROAD {ROAD_IDS[i].toUpperCase()} {ROAD_DIRS[i]}</div>
                <div className="d-track"><div className="d-fill" style={{width:pct+'%',background:sig==='green'?'linear-gradient(90deg,var(--ng),var(--nb))':'linear-gradient(90deg,var(--np),var(--no))'}}></div></div>
                <div className="d-num">{simState.dens[i]}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
