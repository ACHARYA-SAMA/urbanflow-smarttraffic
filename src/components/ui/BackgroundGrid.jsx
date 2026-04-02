import { useEffect, useRef } from 'react'

export default function BackgroundGrid() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    const GS = 56   // grid spacing px

    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(0,212,255,0.035)'
      ctx.lineWidth   = 1
      for (let x = 0; x <= W; x += GS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y <= H; y += GS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Glowing intersection nodes (animated)
      for (let xi = 0; xi <= W; xi += GS) {
        for (let yi = 0; yi <= H; yi += GS) {
          const wave = Math.sin(t * 0.5 + xi * 0.035 + yi * 0.035) * 0.5 + 0.5
          if (wave > 0.82) {
            const alpha = (wave - 0.82) * 3.5
            ctx.beginPath()
            ctx.arc(xi, yi, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(0,255,136,${alpha * 0.5})`
            ctx.shadowColor = '#00ff88'
            ctx.shadowBlur  = 6
            ctx.fill()
            ctx.shadowBlur  = 0
          }
        }
      }

      // Horizontal scan line (very subtle)
      const scanY = (t * 28) % H
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      scanGrad.addColorStop(0,   'transparent')
      scanGrad.addColorStop(0.5, 'rgba(0,212,255,0.018)')
      scanGrad.addColorStop(1,   'transparent')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 40, W, 80)

      t += 0.016
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
