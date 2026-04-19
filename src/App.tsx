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
    <div className="flex h-screen bg-[#0a0e1a] text-white overflow-hidden">
      <Sidebar
        shipSpeed={shipSpeed}
        shipType={shipType}
        onSpeedChange={setShipSpeed}
        onShipTypeChange={setShipType}
        alerts={alerts}
        sightings={sightings}
        onOpenReport={() => setShowReport(true)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Alert ticker */}
        {alerts.length > 0 && (
          <div className="shrink-0 bg-red-950/80 border-b border-red-700/50 px-4 py-2 flex items-center gap-3">
            <span className="text-red-400 text-xs font-bold uppercase tracking-widest animate-pulse">⚠ Alert</span>
            <span className="text-red-300 text-xs">{alerts[0].message}</span>
            {alerts.length > 1 && (
              <span className="text-red-500 text-xs">+{alerts.length - 1} more</span>
            )}
          </div>
        )}

        {loadError && (
          <div className="shrink-0 bg-yellow-950/80 border-b border-yellow-700/50 px-4 py-2 text-yellow-300 text-xs">
            ⚠ Could not load sightings data: {loadError}
          </div>
        )}

        {/* Map */}
        <div className="flex-1 min-h-0">
          <MapView
            shipSpeed={shipSpeed}
            shipType={shipType}
            sightings={sightings}
            onAlert={setAlerts}
            onRoutesReady={setRoutes}
          />
        </div>

        {/* Route comparison panel */}
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
