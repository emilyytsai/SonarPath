import { useState } from 'react'
import type { ShipType, IntersectionAlert, WhaleSighting } from '../types'
import { getNoiseRadius } from '../services/acoustics'
import { generateCaptainAdvice } from '../services/gemini'

interface SidebarProps {
  shipSpeed: number
  shipType: ShipType
  onSpeedChange: (v: number) => void
  onShipTypeChange: (v: ShipType) => void
  alerts: IntersectionAlert[]
  sightings: WhaleSighting[]
  onOpenReport: () => void
}

const SHIP_LABELS: Record<ShipType, string> = {
  cargo:  'Cargo Vessel',
  tanker: 'Oil Tanker',
  cruise: 'Cruise Ship',
}

export default function Sidebar({
  shipSpeed, shipType, onSpeedChange, onShipTypeChange,
  alerts, sightings, onOpenReport,
}: SidebarProps) {
  const [advice, setAdvice] = useState<string>('')
  const [loadingAdvice, setLoadingAdvice] = useState(false)

  const radiusNm = getNoiseRadius(shipSpeed, shipType)
  const nearbySightings = sightings.filter(s => {
    // approx check — full spatial check is in MapView
    const dlat = Math.abs(s.lat - 37.8044)
    const dlng = Math.abs(s.lng - (-122.4194))
    return dlat < 0.5 && dlng < 0.5
  })

  async function fetchAdvice() {
    setLoadingAdvice(true)
    try {
      const text = await generateCaptainAdvice({
        shipType, speedKnots: shipSpeed, noiseRadiusNm: radiusNm,
        alerts, nearbySightings,
      })
      setAdvice(text)
    } catch (e) {
      setAdvice('AI advisor unavailable. Check VITE_GEMINI_API_KEY.')
      console.error(e)
    } finally {
      setLoadingAdvice(false)
    }
  }

  const severityBg = alerts.length === 0 ? 'bg-emerald-900/40 border-emerald-500/40'
    : alerts.length <= 2              ? 'bg-yellow-900/40 border-yellow-500/40'
    :                                   'bg-red-900/40 border-red-500/40'

  return (
    <aside className="w-72 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="py-4 border-b border-gray-800">
       <img src="/src/assets/logo.svg" alt="SonarPath" style={{ height: '55px', width: '230px' }} />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 flex-1">
        {/* Ship type */}
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-widest mb-2">Vessel Class</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['cargo', 'tanker', 'cruise'] as ShipType[]).map(t => (
              <button
                key={t}
                onClick={() => onShipTypeChange(t)}
                className={`py-2 text-xs rounded border transition-all ${
                  shipType === t
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                {SHIP_LABELS[t].split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Speed slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase tracking-widest">Speed</label>
            <span className="text-cyan-400 font-mono text-sm">{shipSpeed} kn</span>
          </div>
          <input
            type="range" min={3} max={25} step={1} value={shipSpeed}
            onChange={e => onSpeedChange(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-gray-600 text-xs mt-1">
            <span>3 kn</span><span>25 kn</span>
          </div>
        </div>

        {/* Acoustic halo stats */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Acoustic Halo</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono text-white">{radiusNm.toFixed(2)}</span>
            <span className="text-gray-500 text-sm mb-1">nm radius</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (radiusNm / 15) * 100)}%`,
                background: radiusNm < 4 ? '#00d2ff' : radiusNm < 8 ? '#f5a623' : '#ff3c3c',
              }}
            />
          </div>
        </div>

        {/* Alert banner */}
        <div className={`rounded-lg p-3 border text-xs ${severityBg}`}>
          <p className="font-semibold text-white mb-1">
            {alerts.length === 0 ? '✓ All clear' : `⚠ ${alerts.length} intersection${alerts.length > 1 ? 's' : ''}`}
          </p>
          {alerts.slice(0, 3).map((a, i) => (
            <p key={i} className="text-gray-300 leading-relaxed">{a.message}</p>
          ))}
        </div>

        {/* Sightings count */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded p-3 border border-gray-800 text-center">
            <p className="text-2xl font-mono text-purple-400">{sightings.length}</p>
            <p className="text-gray-500 text-xs mt-0.5">Sightings</p>
          </div>
          <div className="bg-gray-900 rounded p-3 border border-gray-800 text-center">
            <p className="text-2xl font-mono text-orange-400">{alerts.length}</p>
            <p className="text-gray-500 text-xs mt-0.5">Alerts</p>
          </div>
        </div>

        {/* AI advice */}
        <div>
          <button
            onClick={() => void fetchAdvice()}
            disabled={loadingAdvice}
            className="w-full py-2.5 text-xs rounded border border-cyan-600/50 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 uppercase tracking-widest"
          >
            {loadingAdvice ? 'Consulting AI…' : '◈ AI Captain Advice'}
          </button>
          {advice && (
            <div className="mt-3 bg-gray-900 rounded p-3 border border-gray-800 text-xs text-gray-300 leading-relaxed">
              {advice}
            </div>
          )}
        </div>

        {/* ESG Report */}
        <button
          onClick={onOpenReport}
          className="mt-auto w-full py-2.5 text-xs rounded border border-emerald-600/50 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors uppercase tracking-widest"
        >
          ↓ Generate ESG Report
        </button>
      </div>
    </aside>
  )
}
