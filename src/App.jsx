import { useState, useRef, useCallback } from 'react'
import { ThemeProvider } from './context/ThemeContext.jsx'
import LandingPage from './components/LandingPage.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'
import BootScreen from './components/ui/BootScreen.jsx'
import CursorParticles from './components/ui/CursorParticles.jsx'
import BackgroundGrid from './components/ui/BackgroundGrid.jsx'
import SimEngine from './simulation/SimEngine.js'

// Initial blank simulation state shown before sim starts
const BLANK_STATE = {
  running: false, cycleN: 142, sigState: 'NS_GREEN', sigRemSec: 7, sigPct: 1,
  isNS: true, dens: [8,4,6,3], vehCount: 0,
  overrideActive: false, overrideDir: -1, manualDir: -1, manualRemSec: 0,
  violations: [], vioCount: 0, vioByRoad: [0,0,0,0],
  accidents: [], accCount: 0, accInjured: 0, accCleared: 0, accAvgResp: null,
  emgCount: 0, emgByType: {police:0,ambulance:0,fire:0}, emgEntries: [],
  logEntries: [], alerts: [], alertCount: 0,
  envFuel: 0, envCO2: 0, envWait: 0, envFlow: 0,
  health: { cpuLoad:12, memLoad:34, latency:2, wifi:88, sensors:[true,true,true,true] },
  uptimeSec: 0,
  getSig: () => 'red',
}

function AppInner() {
  const [booted,     setBooted]     = useState(false)
  const [launched,   setLaunched]   = useState(false)
  const [mode,       setMode]       = useState('desktop')
  const [activePage, setActivePage] = useState('home')
  const [simState,   setSimState]   = useState(BLANK_STATE)

  // Single SimEngine instance created once
  const engineRef = useRef(null)
  if (!engineRef.current) {
    engineRef.current = new SimEngine((state) => {
      setSimState(state)
    })
  }

  const launch = useCallback((m) => {
    setMode(m)
    setLaunched(true)
  }, [])

  // Expose engine control functions to children
  const engineCtrl = {
    start:               () => engineRef.current.start(),
    pause:               () => engineRef.current.pause(),
    reset:               () => engineRef.current.reset(),
    forceGreen:          (dir) => engineRef.current.forceGreen(dir),
    resetSignals:        () => engineRef.current.resetSignals(),
    triggerEmergencyMode:() => engineRef.current.triggerEmergencyMode(),
    spawnEmergency:      (type, dir) => engineRef.current.spawnEmergency(type, dir),
    engine:              engineRef.current,
  }

  return (
    <>
      {/* Always-on global UI layers */}
      <BackgroundGrid />
      <CursorParticles />

      {/* Boot screen shown once, before landing page */}
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}

      {/* Main app — rendered immediately so engine is ready, but visually shown after boot */}
      {booted && (
        <>
          {!launched
            ? <LandingPage onLaunch={launch} />
            : (
              <DashboardLayout
                mode={mode}
                activePage={activePage}
                setActivePage={setActivePage}
                simState={simState}
                engineCtrl={engineCtrl}
              />
            )
          }
        </>
      )}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}
