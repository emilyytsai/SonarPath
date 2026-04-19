import { useState, useEffect } from 'react'
import './index.css'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import RoutePanel from './components/RoutePanel'
import ReportModal from './components/ReportModal'
import type { ShipType, WhaleSighting, IntersectionAlert, RouteResult } from './types'
import { fetchWhaleHabitats } from './services/noaa'

export default function App() {
  const [shipSpeed, setShipSpeed]   = useState<number>(14)
  const [shipType, setShipType]     = useState<ShipType>('cargo')
  const [sightings, setSightings]   = useState<WhaleSighting[]>([])
  const [alerts, setAlerts]         = useState<IntersectionAlert[]>([])
  const [routes, setRoutes]         = useState<RouteResult[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RouteResult['type'] | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadError, setLoadError]   = useState<string | null>(null)

  useEffect(() => {
    fetchWhaleHabitats()
      .then(data => setSightings(data))
      .catch(e => setLoadError(String(e)))
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Map fills entire screen */}
      <div className="absolute inset-0">
        <MapView
          shipSpeed={shipSpeed}
          shipType={shipType}
          sightings={sightings}
          onAlert={setAlerts}
          onRoutesReady={setRoutes}
        />
      </div>

      {/* Alert ticker */}
      {alerts.length > 0 && (
        <div className="absolute top-0 left-72 right-0 z-20 bg-red-950/60 backdrop-blur-md border-b border-red-700/40 px-4 py-2 flex items-center gap-3">
          <span className="text-red-400 text-xs font-bold uppercase tracking-widest animate-pulse">⚠ Alert</span>
          <span className="text-red-300 text-xs">{alerts[0].message}</span>
          {alerts.length > 1 && (
            <span className="text-red-500 text-xs">+{alerts.length - 1} more</span>
          )}
        </div>
      )}

      {loadError && (
        <div className="absolute top-0 left-72 right-0 z-20 bg-yellow-950/60 backdrop-blur-md border-b border-yellow-700/40 px-4 py-2 text-yellow-300 text-xs">
          ⚠ Could not load sightings data: {loadError}
        </div>
      )}

      {/* Glass sidebar */}
      <div className="absolute top-0 left-0 bottom-0 z-10 w-72">
        <Sidebar
          shipSpeed={shipSpeed}
          shipType={shipType}
          onSpeedChange={setShipSpeed}
          onShipTypeChange={setShipType}
          alerts={alerts}
          sightings={sightings}
          onOpenReport={() => setShowReport(true)}
        />
      </div>

      {/* Glass route panel */}
      <div className="absolute bottom-0 left-72 right-0 z-10">
        <RoutePanel
          routes={routes}
          selected={selectedRoute}
          onSelect={setSelectedRoute}
        />
      </div>

      {showReport && (
        <ReportModal
          shipSpeed={shipSpeed}
          shipType={shipType}
          alerts={alerts}
          sightings={sightings}
          routes={routes}
          selectedRoute={selectedRoute}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}