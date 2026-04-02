import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

export default function LandingPage({ onLaunch }) {
  const canvasRef = useRef(null)
  const { theme, toggleTheme, particlesEnabled, toggleParticles } = useTheme()

  useEffect(() => {
    const lc = canvasRef.current; if (!lc) return
    const lx = lc.getContext('2d'); let rafId, alive = true
    const resize = () => { lc.width = window.innerWidth; lc.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    function draw(ts) {
      if (!alive) return
      const t = ts*0.001, W=lc.width, H=lc.height
      lx.clearRect(0,0,W,H)
      lx.strokeStyle='rgba(0,212,255,0.055)'; lx.lineWidth=1
      const gs=56
      for(let x=0;x<=W;x+=gs){lx.beginPath();lx.moveTo(x,0);lx.lineTo(x,H);lx.stroke()}
      for(let y=0;y<=H;y+=gs){lx.beginPath();lx.moveTo(0,y);lx.lineTo(W,y);lx.stroke()}
      for(let x=0;x<=W;x+=gs) for(let y=0;y<=H;y+=gs){
        const w=Math.sin(t+x*.04+y*.04)*.5+.5
        if(w>.85){lx.fillStyle=`rgba(0,255,136,${(w-.85)*2.5})`;lx.beginPath();lx.arc(x,y,2,0,Math.PI*2);lx.fill()}
      }
      rafId=requestAnimationFrame(draw)
    }
    rafId=requestAnimationFrame(draw)
    return () => { alive=false; cancelAnimationFrame(rafId); window.removeEventListener('resize',resize) }
  }, [])

  return (
    <div id="landing">
      <canvas id="land-canvas" ref={canvasRef} />

      {/* ── Top-right control toggles ── */}
      <div className="land-controls">
        <button
          className={`land-ctrl-btn${theme === 'light' ? ' land-ctrl-active' : ''}`}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀ LIGHT' : '🌙 DARK'}
        </button>
        <button
          className={`land-ctrl-btn${particlesEnabled ? ' land-ctrl-active' : ''}`}
          onClick={toggleParticles}
          title={`Particles ${particlesEnabled ? 'ON' : 'OFF'}`}
          aria-label="Toggle particles"
        >
          ✦ PARTICLES {particlesEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="land-inner">
        <div className="land-logo-mark">🚦</div>
        <div className="land-title">URBAN FLOW</div>
        <div className="land-sub">SMART TRAFFIC INTELLIGENCE PLATFORM · v3.0</div>
        <div className="land-tagline">Real-time adaptive signals · AI decision engine · Emergency override<br/>Multi-junction network · Environmental monitoring</div>
        <div className="land-q">Select your device to continue</div>
        <div className="land-btns">
          <div className="land-btn phone" onClick={()=>onLaunch('phone')}>
            <div className="land-btn-icon">📱</div>
            <div className="land-btn-label">PHONE</div>
            <div className="land-btn-sub">Touch-optimised layout</div>
          </div>
          <div className="land-btn desktop" onClick={()=>onLaunch('desktop')}>
            <div className="land-btn-icon">🖥️</div>
            <div className="land-btn-label">DESKTOP</div>
            <div className="land-btn-sub">Full dashboard + sidebar</div>
          </div>
        </div>
        <div className="land-feats">
          <div className="land-feat"><div className="land-dot"></div>LIVE SIMULATION</div>
          <div className="land-feat">⚡ AI ENGINE</div>
          <div className="land-feat">🚨 EMERGENCY OVERRIDE</div>
          <div className="land-feat">🌿 ECO MONITOR</div>
        </div>
      </div>
    </div>
  )
}
