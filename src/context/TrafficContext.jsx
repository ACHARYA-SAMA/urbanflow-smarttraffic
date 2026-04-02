import { createContext, useContext, useReducer, useCallback } from 'react'

// ── Initial state ──────────────────────────────────────
const INIT = {
  // Signal / density
  sigState:  'NS_GREEN',
  sigs:      ['green','red','green','red'],
  dens:      [8,4,6,3],
  cycleN:    0,
  vehCount:  0,
  timerRem:  7,
  timerRoad: 'Road A & C',
  overrideActive: false,
  overrideDir:    -1,
  overrideType:   null,
  manualDir:      -1,

  // Logs & feeds (arrays, capped at 10–15)
  logs:       [],
  violations: [],
  vioCount:   0,
  vioByRoad:  [0,0,0,0],
  accidents:  [],
  accCount:   0,
  accInjured: 0,
  accCleared: 0,
  accAvgResp: null,
  emergencies: [],
  emgCount:    0,
  emgByType:   { police:0, ambulance:0, fire:0 },
  alerts:     [],
  alertCount: 0,

  // Environment
  envFuel: 0, envCO2: 0, envWait: 0, envFlow: 0,

  // Health (updated periodically)
  cpu: 12, mem: 34, lat: 2, wifi: 88,
  healthTick: 0,
  components: [
    { id:'esp32', name:'ESP32 Controller',   status:'online', label:'ONLINE' },
    { id:'sa',    name:'Sensor A (Road A)',   status:'online', label:'ACTIVE' },
    { id:'sb',    name:'Sensor B (Road B)',   status:'online', label:'ACTIVE' },
    { id:'sc',    name:'Sensor C (Road C)',   status:'online', label:'ACTIVE' },
    { id:'sd',    name:'Sensor D (Road D)',   status:'online', label:'ACTIVE' },
    { id:'sig',   name:'Signal Controller',  status:'online', label:'RUNNING' },
    { id:'cam',   name:'Camera Module',      status:'online', label:'ACTIVE' },
    { id:'ai',    name:'AI Engine',          status:'online', label:'PROCESSING' },
    { id:'net',   name:'Network Module',     status:'online', label:'CONNECTED' },
    { id:'pw',    name:'Power Supply',       status:'online', label:'STABLE' },
  ],
}

// ── Reducer ────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'UPDATE_STATE': {
      const s = action.payload
      return { ...state,
        sigState: s.sigState, sigs: s.sigs, dens: s.dens, cycleN: s.cycleN,
        vehCount: s.vehCount, timerRem: s.timerRem, timerRoad: s.timerRoad,
        overrideActive: s.overrideActive, overrideDir: s.overrideDir,
        overrideType: s.overrideType, manualDir: s.manualDir,
      }
    }

    case 'ADD_LOG': {
      const e = action.payload
      const logs = [e, ...state.logs].slice(0, 10)
      return { ...state, logs }
    }

    case 'ADD_VIOLATION': {
      const e = action.payload
      const violations = [e, ...state.violations].slice(0, 15)
      return { ...state, violations,
        vioCount:  e.vioCount,
        vioByRoad: e.vioByRoad,
      }
    }

    case 'ADD_ACCIDENT': {
      const a = action.payload
      return { ...state,
        accidents:  a.accidents,
        accCount:   a.accCount,
        accInjured: a.accInjured,
        accCleared: a.accCleared,
        accAvgResp: a.avgResp,
      }
    }

    case 'ADD_EMERGENCY': {
      const e = action.payload
      const emergencies = [e, ...state.emergencies].slice(0, 8)
      return { ...state, emergencies,
        emgCount:  e.emgCount,
        emgByType: e.emgByType,
      }
    }

    case 'ADD_ALERT': {
      const e = { ...action.payload, time: new Date().toLocaleTimeString(), id: Date.now() }
      const alerts = [e, ...state.alerts].slice(0, 30)
      return { ...state, alerts, alertCount: state.alertCount + 1 }
    }

    case 'UPDATE_ENV': {
      const { fuel, co2, wait, flow } = action.payload
      return { ...state, envFuel: fuel, envCO2: co2, envWait: wait, envFlow: flow }
    }

    case 'TICK_HEALTH': {
      const t = state.healthTick + 1
      const cpu  = Math.round(8  + Math.sin(t*.1)*6  + Math.random()*4)
      const mem  = Math.round(32 + Math.sin(t*.05)*8 + Math.random()*3)
      const lat  = Math.round(1  + Math.random()*3)
      const wifi = Math.round(82 + Math.sin(t*.08)*8)
      // Random component flicker
      let components = state.components
      if (t % 120 === 0 && Math.random() > 0.85) {
        const si = Math.floor(Math.random() * 4) + 1 // sensors 1-4
        components = state.components.map((c, i) =>
          i === si ? { ...c, status:'warn', label:'CALIBRATING' } : c
        )
        setTimeout(() => {}, 2500) // cleared via RESTORE_SENSOR action
      }
      return { ...state, cpu, mem, lat, wifi, healthTick: t, components }
    }

    case 'RESTORE_SENSOR': {
      const components = state.components.map((c, i) =>
        i === action.idx ? { ...c, status:'online', label:'ACTIVE' } : c
      )
      return { ...state, components }
    }

    case 'RESET':
      return { ...INIT, components: state.components }

    default: return state
  }
}

// ── Context ────────────────────────────────────────────
const TrafficContext = createContext(null)

export function TrafficProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT)

  const addAlert = useCallback((alert) => dispatch({ type:'ADD_ALERT', payload: alert }), [])

  return (
    <TrafficContext.Provider value={{ state, dispatch, addAlert }}>
      {children}
    </TrafficContext.Provider>
  )
}

export function useTraffic() {
  return useContext(TrafficContext)
}
