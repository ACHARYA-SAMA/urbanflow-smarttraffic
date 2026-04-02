import { useState, useEffect, useRef } from 'react'

/**
 * Smoothly animates a number from its previous value to `target`.
 * @param {number} target  - the target value to animate to
 * @param {number} duration - animation duration in ms (default 800)
 */
export default function useAnimatedCounter(target, duration = 800) {
  const [display, setDisplay] = useState(target)
  const from    = useRef(target)
  const startTs = useRef(null)
  const raf     = useRef(null)

  useEffect(() => {
    const startVal = from.current
    const diff = target - startVal
    if (diff === 0) return

    startTs.current = null
    cancelAnimationFrame(raf.current)

    const step = (ts) => {
      if (!startTs.current) startTs.current = ts
      const elapsed = ts - startTs.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal + diff * eased))
      if (progress < 1) {
        raf.current = requestAnimationFrame(step)
      } else {
        from.current = target
      }
    }
    raf.current = requestAnimationFrame(step)

    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return display
}
