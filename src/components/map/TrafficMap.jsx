import { useEffect, useRef, useState } from 'react'

const HYD_CENTER = { lat: 17.3850, lng: 78.4867 }
const GOOGLE_MAPS_KEY = '' // Replace with your key or leave blank for no-key error overlay

export default function TrafficMap() {
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const [error, setError]   = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // If no API key, show placeholder
    if (!GOOGLE_MAPS_KEY) {
      setError('no-key')
      return
    }

    // Load Google Maps script once
    if (window.google?.maps) { initMap(); return }

    const scriptId = 'gmaps-script'
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script')
      s.id  = scriptId
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=visualization`
      s.async = true
      s.defer = true
      s.onerror = () => setError('load-fail')
      document.head.appendChild(s)
    }

    const check = setInterval(() => {
      if (window.google?.maps) { clearInterval(check); initMap() }
    }, 200)
    return () => clearInterval(check)
  }, [])

  function initMap() {
    if (!mapRef.current || mapInstance.current) return
    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: HYD_CENTER,
        zoom: 13,
        mapTypeId: 'roadmap',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
          { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#00d4ff' }] },
          { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#020810' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0d2540' }] },
          { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#183050' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020c18' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0a1a30' }] },
          { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0d2040' }] },
        ],
      })
      const trafficLayer = new window.google.maps.TrafficLayer()
      trafficLayer.setMap(map)
      mapInstance.current = map
      setLoaded(true)
    } catch(e) {
      setError('init-fail')
    }
  }

  return (
    <div className="tmap-card card">
      <div className="sec-lbl c-blue">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        LIVE TRAFFIC — HYDERABAD
      </div>

      <div className="tmap-wrap" ref={mapRef}>
        {error === 'no-key' && (
          <div className="tmap-overlay">
            <div className="tmap-placeholder">
              <div className="tmap-ph-icon">🗺️</div>
              <div className="tmap-ph-title">HYDERABAD TRAFFIC LAYER</div>
              <div className="tmap-ph-sub">lat: 17.3850 · lng: 78.4867</div>
              <div className="tmap-ph-body">
                Add your Google Maps API key in<br/>
                <code>src/components/map/TrafficMap.jsx</code><br/>
                to enable live traffic visualization.
              </div>
              <div className="tmap-legend">
                <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#ff4444'}}/> HEAVY</span>
                <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#ffbb33'}}/> MODERATE</span>
                <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#44cc44'}}/> LIGHT</span>
              </div>
              <div className="tmap-ai-msg">
                «REAL-WORLD CONGESTION DETECTED IN SECUNDERABAD ZONE<br/>
                SIMULATED OPTIMIZATION APPLIED TO INTERSECTION MODEL»
              </div>
            </div>
          </div>
        )}
        {error && error !== 'no-key' && (
          <div className="tmap-overlay">
            <span style={{color:'var(--np)', fontFamily:'Share Tech Mono, monospace', fontSize:'11px'}}>
              MAP LOAD FAILED — CHECK API KEY
            </span>
          </div>
        )}
      </div>

      {loaded && (
        <div className="tmap-legend tmap-legend-bottom">
          <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#ff4444'}}/> HEAVY</span>
          <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#ffbb33'}}/> MODERATE</span>
          <span className="tmap-leg-item"><span className="tmap-leg-dot" style={{background:'#44cc44'}}/> LIGHT</span>
        </div>
      )}
    </div>
  )
}
