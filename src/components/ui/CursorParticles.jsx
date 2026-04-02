import { useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext.jsx'

// ── Config ────────────────────────────────────────────────
const MAX_PARTICLES = 90
const SPAWN_PER_MOVE = 3   // particles emitted per mousemove

// White, electric-blue, occasional green — data-signal palette
const PALETTE = [
  { r: 255, g: 255, b: 255, w: 6 },   // white      (common)
  { r:   0, g: 212, b: 255, w: 5 },   // #00d4ff    (common)
  { r:   0, g: 212, b: 255, w: 4 },   // extra blue weight
  { r: 180, g: 240, b: 255, w: 2 },   // pale blue
  { r:   0, g: 255, b: 136, w: 1 },   // #00ff88    (rare green)
]

// Weighted random pick from palette
const totalWeight = PALETTE.reduce((s, p) => s + p.w, 0)
function pickColor() {
  let roll = Math.random() * totalWeight
  for (const c of PALETTE) { roll -= c.w; if (roll <= 0) return c }
  return PALETTE[0]
}

function rand(a, b) { return a + Math.random() * (b - a) }

export default function CursorParticles() {
  const { particlesEnabled } = useTheme()
  const canvasRef = useRef(null)
  const enabledRef = useRef(particlesEnabled)

  // Keep enabledRef in sync with state (without restarting the loop)
  useEffect(() => {
    enabledRef.current = particlesEnabled
  }, [particlesEnabled])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let particles = []
    let raf
    let mx = -1000, my = -1000

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e) => {
      if (!enabledRef.current) return
      mx = e.clientX ?? e.touches?.[0]?.clientX ?? mx
      my = e.clientY ?? e.touches?.[0]?.clientY ?? my

      for (let i = 0; i < SPAWN_PER_MOVE && particles.length < MAX_PARTICLES; i++) {
        const col = pickColor()
        // Spawn within a small jitter radius — NOT on cursor itself
        const ox = rand(-16, 16)
        const oy = rand(-16, 16)

        // Short streak: dx/dy define the direction the line points
        const angle = Math.random() * Math.PI * 2
        const spd   = rand(1.2, 3.8)     // fast — data packet feel
        const len   = rand(3, 11)         // streak half-length

        particles.push({
          x:  mx + ox,
          y:  my + oy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          len,
          life:  1,
          // Short life → quick fade (data, not sparkles)
          decay: rand(0.055, 0.11),
          col,
          // Occasional "flicker": a random dim factor applied each frame
          flicker: Math.random() < 0.22,
        })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })

    // ── Render loop ───────────────────────────────────────
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // When disabled, drain existing particles but spawn no new ones
      if (!enabledRef.current) {
        particles = particles.filter(p => p.life > 0.02)
        for (const p of particles) {
          p.life -= p.decay * 2 // fast fade-out when toggled off
        }
        raf = requestAnimationFrame(loop)
        return
      }

      particles = particles.filter(p => p.life > 0.02)

      for (const p of particles) {
        // Flicker: randomly lower opacity this frame
        const flickerDim = p.flicker && Math.random() < 0.3 ? 0.35 : 1
        const alpha = p.life * flickerDim

        const { r, g, b } = p.col

        // Streak: draw a short line in the direction of travel
        const nx = p.vx / (Math.abs(p.vx) + Math.abs(p.vy) + 0.001)
        const ny = p.vy / (Math.abs(p.vx) + Math.abs(p.vy) + 0.001)

        ctx.beginPath()
        ctx.moveTo(p.x - nx * p.len, p.y - ny * p.len)
        ctx.lineTo(p.x + nx * p.len * 0.4, p.y + ny * p.len * 0.4)

        // Thin line — pixel/data aesthetic (not blob)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.lineWidth   = rand(0.6, 1.4)
        // Tight, hard glow — not a soft halo
        ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.9})`
        ctx.shadowBlur  = 3
        ctx.stroke()
        ctx.shadowBlur  = 0

        // Bright 1–2px head pixel at the front
        ctx.beginPath()
        ctx.arc(p.x + nx * p.len * 0.4, p.y + ny * p.len * 0.4, rand(0.5, 1.2), 0, Math.PI * 2)
        ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.95})`
        ctx.shadowColor = `rgba(${r},${g},${b},${alpha})`
        ctx.shadowBlur  = 4
        ctx.fill()
        ctx.shadowBlur  = 0

        // Update
        p.x    += p.vx
        p.y    += p.vy
        // Very slight deceleration — data packets, not projectiles
        p.vx   *= 0.97
        p.vy   *= 0.97
        p.life -= p.decay
      }

      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  )
}
