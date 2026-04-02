import { useEffect, useRef, useCallback } from 'react';
import { drawScene, drawCar, drawEmgCar, drawVioFlash, drawCrashFlash, drawHUD } from '../simulation/renderer.js';

/**
 * SimCanvas — renders the simulation.
 * Props:
 *   engine       SimulationEngine instance
 *   vioFlashes   [{px,py,ttl,plate}]
 *   crashFlashes [{px,py,ttl,maxTtl,r}]
 */
export default function SimCanvas({ engine, vioFlashes, crashFlashes }) {
  const canvasRef = useRef(null);
  const lastTSRef = useRef(0);
  const animRef   = useRef(null);

  // DPR-aware resize
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr  = window.devicePixelRatio || 1;
    const wrap  = canvas.parentElement;
    const cssW  = Math.max(300, wrap.clientWidth - 4);
    const cssH  = Math.round(cssW * 0.58);
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    engine.resize(cssW, cssH);
  }, [engine]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', resize);
    document.addEventListener('webkitfullscreenchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('fullscreenchange', resize);
      document.removeEventListener('webkitfullscreenchange', resize);
    };
  }, [resize]);

  // Animation loop — step 5: renderSimulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = (ts) => {
      animRef.current = requestAnimationFrame(loop);
      const dt = Math.min(ts - (lastTSRef.current || ts), 50);
      lastTSRef.current = ts;

      // steps 1-4 happen inside engine.tick()
      engine.tick(dt);

      const CW = parseInt(canvas.style.width)  || engine.CW;
      const CH = parseInt(canvas.style.height) || engine.CH;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, CW, CH);

      // 5. Render
      drawScene(ctx, CW, CH, (d) => engine.getSignal(d), engine.dens);

      const sorted = [...engine.allVehicles].sort((a,b) => a.py - b.py);
      for (const v of sorted)
        v.type ? drawEmgCar(ctx, v, engine.sirenBlink) : drawCar(ctx, v);

      for (const f of crashFlashes) drawCrashFlash(ctx, f);
      for (const f of vioFlashes)   drawVioFlash(ctx, f);
      drawHUD(ctx, CW, CH, engine);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [engine, vioFlashes, crashFlashes]);

  return (
    <canvas
      ref={canvasRef}
      id="simCanvas"
      style={{
        display:'block', width:'100%', borderRadius:12,
        border:'1px solid rgba(0,212,255,.15)',
        boxShadow:'0 0 30px rgba(0,212,255,.08)',
      }}
    />
  );
}
