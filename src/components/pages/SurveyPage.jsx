export default function SurveyPage() {
  return (
    <>
      <div className="card" style={{textAlign:'center',padding:'26px',background:'linear-gradient(135deg,rgba(4,15,30,.9),rgba(7,26,46,.9) 50%,rgba(4,18,14,.9))'}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'var(--nb)',letterSpacing:'3px',marginBottom:'3px'}}>COMMUTER SURVEY RESULTS</div>
        <div className="sv-num">100%</div>
        <div style={{fontSize:'13px',color:'#7a9ab0',marginTop:'5px'}}>of respondents want smarter traffic management</div>
        <div style={{fontSize:'10px',color:'var(--muted)',marginTop:'6px',fontFamily:"'Share Tech Mono',monospace"}}>Participants: students · bike riders · car drivers · pedestrians</div>
      </div>
      <div className="sec-lbl">KEY FINDINGS</div>
      {[['100%','g','are not satisfied with the current fixed traffic signal system'],
        ['100%','g','experience long waiting times at traffic signals daily'],
        ['100%','b','believe smart traffic management could significantly reduce congestion'],
        ['83.3%','y','say traffic congestion negatively impacts their daily routine']].map(([pct,cls,desc])=>(
        <div key={pct+desc} className="sv-card">
          <div className={`sv-pct ${cls}`}>{pct}</div>
          <div className="sv-desc">{desc}</div>
        </div>
      ))}
    </>
  )
}
