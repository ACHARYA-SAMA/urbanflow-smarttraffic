import Header from './Header.jsx'
import useVoiceNarration from '../hooks/useVoiceNarration.js'
import Sidebar from './Sidebar.jsx'
import BottomNav from './BottomNav.jsx'
import TrafficCanvas from './TrafficCanvas.jsx'
import HologramAI from './ai/HologramAI.jsx'
import TrafficMap from './map/TrafficMap.jsx'
import HomePage from './pages/HomePage.jsx'
import SimPage from './pages/SimPage.jsx'
import AIPage from './pages/AIPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ViolationsPage from './pages/ViolationsPage.jsx'
import EmergencyPage from './pages/EmergencyPage.jsx'
import AccidentsPage from './pages/AccidentsPage.jsx'
import SurveyPage from './pages/SurveyPage.jsx'
import HealthPage from './pages/HealthPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import PredictionPage from './pages/PredictionPage.jsx'
import EnvironmentPage from './pages/EnvironmentPage.jsx'
import NetworkPage from './pages/NetworkPage.jsx'

const PAGE_MAP = {
  home: HomePage, sim: SimPage, ai: AIPage, analytics: AnalyticsPage,
  violations: ViolationsPage, emergency: EmergencyPage, accidents: AccidentsPage,
  survey: SurveyPage, health: HealthPage, alerts: AlertsPage,
  prediction: PredictionPage, environment: EnvironmentPage, network: NetworkPage,
}

export default function DashboardLayout({ mode, activePage, setActivePage, simState, engineCtrl }) {
  const appClass = `app force-${mode}`
  const ActivePage = PAGE_MAP[activePage] || HomePage
  const isSimPage  = activePage === 'sim'

  // Derive latest narration message: phase-switch log takes priority over alerts
  const latestMessage = simState.logEntries?.[0]
    ? `Road ${simState.logEntries[0].rn} signal optimized. ${simState.logEntries[0].load} vehicles processed.`
    : simState.alerts?.[0]?.body ?? null

  const { voiceEnabled, toggleVoice } = useVoiceNarration(latestMessage)

  // Banner for emergency override
  const showBanner = simState.overrideActive
  const manShow    = simState.manualDir >= 0

  return (
    <div className={appClass} id="app">
      {showBanner && (
        <div className="override-banner show">
          🚨 EMERGENCY OVERRIDE — <span>{simState.overrideDir >= 0 ? 'ROAD ' + 'ABCD'[simState.overrideDir] : ''}</span>
        </div>
      )}
      {manShow && (
        <div className="override-banner show" style={{background:'rgba(255,234,0,0.1)',borderColor:'var(--ny)'}}>
          👮 MANUAL OVERRIDE — ROAD {'ABCD'[simState.manualDir]} — {simState.manualRemSec}s
        </div>
      )}

      <Header simState={simState} onGoTo={setActivePage} voiceEnabled={voiceEnabled} onToggle={toggleVoice} />
      <Sidebar activePage={activePage} onGoTo={setActivePage} simState={simState} />

      <main className="main" id="main-area">
        {/* TrafficCanvas is always mounted (keeps RAF loop alive) but only visible on sim page */}
        <div className={`page${isSimPage ? ' active' : ''}`} id="page-sim">
          <TrafficCanvas engine={engineCtrl.engine} simState={simState} />
          <SimPage simState={simState} engineCtrl={engineCtrl} embeddedCanvas />
        </div>

        {/* Home page gets the map panel injected */}
        <div className={`page${activePage === 'home' ? ' active' : ''}`} id="page-home">
          <HomePage simState={simState} engineCtrl={engineCtrl} onGoTo={setActivePage} />
          <TrafficMap />
        </div>

        {/* All other pages */}
        {Object.entries(PAGE_MAP).map(([id, Comp]) => {
          if (id === 'sim' || id === 'home') return null
          return (
            <div key={id} className={`page${activePage===id?' active':''}`} id={`page-${id}`}>
              <Comp simState={simState} engineCtrl={engineCtrl} onGoTo={setActivePage} />
            </div>
          )
        })}
      </main>

      <BottomNav activePage={activePage} onGoTo={setActivePage} />

      {/* Floating AI Hologram — replaces old AIAssistant */}
      <HologramAI simState={simState} />
    </div>
  )
}
