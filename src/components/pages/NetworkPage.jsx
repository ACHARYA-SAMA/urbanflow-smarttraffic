import { useEffect, useRef, useState } from 'react'

const INTERSECTIONS = [
  {x:.25,y:.4,name:'ALPHA',level:2},
  {x:.6, y:.3,name:'BETA', level:1},
  {x:.75,y:.65,name:'GAMMA',level:0},
]
const ROADS_LINKS = [{a:0,b:1},{a:1,b:2},{a:0,b:2}]
const LEVEL_COLS  = ['#00ff88','#ffea00','#ff006e']
const LEVEL_NAMES = ['Clear','Moderate','Heavy']

export default function NetworkPage({ simState, onGoTo }) {
  const canvasRef = useRef(null)
  const [selected, setSelected] = useState(0)

  useEffect(()=>{
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0,0,W,H)
    ctx.fillStyle='rgba(3,13,12,.95)'; ctx.fillRect(0,0,W,H)
    ctx.strokeStyle='rgba(0,212,255,0.04)'; ctx.lineWidth=1
    for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ROADS_LINKS.forEach(r=>{
      const a=INTERSECTIONS[r.a],b=INTERSECTIONS[r.b]
      ctx.strokeStyle='rgba(0,212,255,0.12)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke()
      ctx.strokeStyle='rgba(30,46,62,0.9)';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke()
      ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();ctx.setLineDash([])
    })
    INTERSECTIONS.forEach((int,i)=>{
      const ix=int.x*W,iy=int.y*H,sel=i===selected
      const col=sel?'#00d4ff':LEVEL_COLS[int.level]
      if(sel){ctx.shadowColor=col;ctx.shadowBlur=18}
      ctx.fillStyle=col+'33';ctx.beginPath();ctx.arc(ix,iy,sel?24:18,0,Math.PI*2);ctx.fill()
      ctx.strokeStyle=col;ctx.lineWidth=sel?2.5:1.5;ctx.beginPath();ctx.arc(ix,iy,sel?22:16,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0
      // signal dots
      const sigs=[0,1,2,3].map(d=>simState.getSig(d))
      const sigCols=sigs.map(s=>s==='green'?'#00ff88':s==='yellow'?'#ffea00':'#ff4444')
      ;[[-5,-5],[5,-5],[-5,5],[5,5]].forEach(([ox,oy],di)=>{
        ctx.fillStyle=sigCols[di];ctx.beginPath();ctx.arc(ix+ox,iy+oy,3,0,Math.PI*2);ctx.fill()
      })
      ctx.font=`700 10px "Share Tech Mono",monospace`;ctx.textAlign='center';ctx.textBaseline='top'
      ctx.fillStyle=col;ctx.fillText(int.name,ix,iy+(sel?27:21))
      ctx.font=`9px "Share Tech Mono",monospace`;ctx.fillStyle='rgba(224,244,255,0.5)'
      ctx.fillText(LEVEL_NAMES[int.level],ix,iy+40)
    })
  },[selected, simState.sigState])

  return (
    <>
      <div className="hero" style={{padding:'18px'}}>
        <div className="hero-eye">// CITY TRAFFIC NETWORK OVERVIEW</div>
        <div className="hero-title" style={{fontSize:'clamp(16px,3.5vw,26px)'}}>Multi-Junction<span className="acc">Network Monitor</span></div>
      </div>
      <div className="net-canvas-wrap">
        <canvas ref={canvasRef} id="netCanvas" width="600" height="220" style={{width:'100%',borderRadius:'10px'}} />
      </div>
      <div className="net-legend">
        {[['var(--np)','Heavy Traffic'],['var(--ny)','Moderate'],['var(--ng)','Clear'],['var(--nb)','Selected']].map(([c,l])=>(
          <div key={l} className="net-leg-item"><div className="net-leg-dot" style={{background:c}}></div>{l}</div>
        ))}
      </div>
      <div className="sec-lbl c-blue">INTERSECTION STATUS</div>
      <div className="int-grid">
        {INTERSECTIONS.map((int,i)=>(
          <div key={i} className={`int-card${i===selected?' selected':''}`} onClick={()=>{setSelected(i);if(i===0)onGoTo('sim')}}>
            <div className="int-name">JUNCTION {int.name}</div>
            <div className={`int-status ${['clear','moderate','heavy'][2-int.level]}`}>{['Clear Flow','Moderate Flow','Heavy Traffic'][2-int.level]}</div>
            <div style={{fontSize:'9px',color:'var(--muted)',marginTop:'4px',fontFamily:"'Share Tech Mono',monospace"}}>{i===0?'Active simulation':`${[3,8,12][i]} vehicles/min`}</div>
          </div>
        ))}
      </div>
    </>
  )
}
