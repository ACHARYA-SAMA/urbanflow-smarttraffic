import { useEffect, useRef, useState, useCallback } from 'react'
import { renderFrame } from '../simulation/Renderer.js'

export default function TrafficCanvas({ engine }) {
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)
  const [running, setRunning] = useState(false)
  const [isFS,    setIsFS]    = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !engine) return
    engine.attachCanvas(canvas)
    engine.onRender = (eng) => {
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.clearRect(0, 0, eng.CW, eng.CH)
      renderFrame(ctx, eng)
    }
    setupCanvas(canvas, engine)
    engine.drawStaticFrame()
    return () => { engine.onRender = null }
  }, [engine])

  useEffect(() => {
    const wrap = wrapRef.current; const canvas = canvasRef.current
    if (!wrap || !canvas || !engine) return
    const ro = new ResizeObserver(() => {
      setupCanvas(canvas, engine)
      if (!engine.running) engine.drawStaticFrame()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [engine])

  useEffect(() => {
    const onFSChange = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFS(fs)
      setTimeout(() => {
        const c = canvasRef.current; if (c && engine) { setupCanvas(c,engine); if(!engine.running)engine.drawStaticFrame() }
      }, 80)
    }
    document.addEventListener('fullscreenchange', onFSChange)
    document.addEventListener('webkitfullscreenchange', onFSChange)
    return () => { document.removeEventListener('fullscreenchange',onFSChange); document.removeEventListener('webkitfullscreenchange',onFSChange) }
  }, [engine])

  const handleToggleSim = useCallback(() => {
    if (engine.running) { engine.pause(); setRunning(false) }
    else { engine.start(); setRunning(true) }
  }, [engine])

  const handleReset = useCallback(() => {
    engine.reset(); setRunning(false)
    setTimeout(() => { const c=canvasRef.current; if(c&&engine){setupCanvas(c,engine);engine.drawStaticFrame()} }, 30)
  }, [engine])

  const handleFS = useCallback(() => {
    const wrap = wrapRef.current; if (!wrap) return
    if (!document.fullscreenElement && !document.webkitFullscreenElement)
      (wrap.requestFullscreen||wrap.webkitRequestFullscreen).call(wrap).catch(()=>{})
    else (document.exitFullscreen||document.webkitExitFullscreen).call(document).catch(()=>{})
  }, [])

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
      <div id="sim-fullscreen-wrap" ref={wrapRef} className="canvas-wrap">
        <canvas ref={canvasRef} id="simCanvas" />
        <div className="sim-ctrls">
          <button className="btn btn-g" onClick={handleToggleSim}>{running?'⏸  PAUSE':'▶  START'}</button>
          <button className="btn btn-r" onClick={handleReset}>↺  RESET</button>
          <button className="btn btn-b" onClick={handleFS}>{isFS?'✕  EXIT':'⛶  FULLSCREEN'}</button>
        </div>
      </div>
    </div>
  )
}

function setupCanvas(canvas, engine) {
  const wrap = canvas.parentElement; if (!wrap) return
  const dpr  = Math.min(window.devicePixelRatio||1, 2)
  const cssW = Math.max(280, wrap.clientWidth-4)
  const cssH = Math.round(cssW*0.58)
  canvas.style.width  = cssW+'px'; canvas.style.height = cssH+'px'
  canvas.width  = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr,dpr)
  engine.setDimensions(cssW, cssH)
}
