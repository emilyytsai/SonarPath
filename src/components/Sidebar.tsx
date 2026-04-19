import { useState } from 'react'
import type { ShipType, IntersectionAlert, WhaleSighting } from '../types'
import { getNoiseRadius } from '../services/acoustics'
import { generateCaptainAdvice } from '../services/gemini'
import { PORTS } from '../data/ports'

interface SidebarProps {
  shipSpeed: number
  shipType: ShipType
  onSpeedChange: (v: number) => void
  onShipTypeChange: (v: ShipType) => void
  alerts: IntersectionAlert[]
  sightings: WhaleSighting[]
  onOpenReport: () => void
  startPortKey: string
  endPortKey: string
  onStartPortChange: (key: string) => void
  onEndPortChange: (key: string) => void
}

const SHIP_LABELS: Record<ShipType, string> = {
  cargo:  'Cargo Vessel',
  tanker: 'Oil Tanker',
  cruise: 'Cruise Ship',
}

export default function Sidebar({
  shipSpeed, shipType, onSpeedChange, onShipTypeChange,
  alerts, sightings, onOpenReport,
  startPortKey, endPortKey, onStartPortChange, onEndPortChange,
}: SidebarProps) {
  const [advice, setAdvice] = useState<string>('')
  const [loadingAdvice, setLoadingAdvice] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

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

  const severityBg = alerts.length === 0 ? 'border-emerald-500/40 bg-emerald-500/10'
    : alerts.length <= 2              ? 'border-yellow-500/40 bg-yellow-500/10'
    :                                   'border-red-500/40 bg-red-500/10'

  return (
    <aside className="w-72 shrink-0 flex flex-col h-full overflow-y-auto" style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '0.5px solid rgba(255, 255, 255, 0.15)',
      boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.08), 2px 0 20px rgba(0,0,0,0.1)',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      {/* Header */}
      <div className="pl-3 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <img src="/logo.svg" alt="SonarPath" style={{ width: '100%', maxWidth: '250px', height: 'auto' }} />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 flex-1">

        {/* Port selection */}
        <div className="flex flex-col gap-3">

          {/* Departure Port */}
          <div>
            <label className="block text-gray-200 text-xs uppercase tracking-widest mb-1.5">Departure Port</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setStartOpen(!startOpen); setEndOpen(false) }}
                style={{
                  width: '100%',
                  background: 'rgba(0, 191, 255, 0.04)',
                  border: '0.5px solid rgba(0, 191, 255, 0.25)',
                  borderRadius: startOpen ? '8px 8px 0 0' : '8px',
                  color: startPortKey ? '#e2e8f0' : '#64748b',
                  fontSize: '11px',
                  padding: '8px 32px 8px 12px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  fontFamily: 'ui-monospace, monospace',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {startPortKey ? PORTS[startPortKey]?.name : '— Select —'}
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,191,255,0.5)', fontSize: '10px' }}>
                  {startOpen ? '▴' : '▾'}
                </span>
              </button>
              {startOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'rgba(10, 14, 30, 0.95)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(0, 191, 255, 0.25)',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  zIndex: 100,
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}>
                  <div
                    onClick={() => { onStartPortChange(''); setStartOpen(false) }}
                    style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}
                  >
                    — Select —
                  </div>
                  {Object.entries(PORTS).map(([key, p]) => (
                    <div
                      key={key}
                      onClick={() => { onStartPortChange(key); setStartOpen(false) }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: startPortKey === key ? '#00bfff' : '#e2e8f0',
                        background: startPortKey === key ? 'rgba(0,191,255,0.08)' : 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'ui-monospace, monospace',
                        letterSpacing: '0.05em',
                        borderTop: '0.5px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,191,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = startPortKey === key ? 'rgba(0,191,255,0.08)' : 'transparent')}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Arrival Port */}
          <div>
            <label className="block text-gray-200 text-xs uppercase tracking-widest mb-1.5">Arrival Port</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setEndOpen(!endOpen); setStartOpen(false) }}
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.04)',
                  border: '0.5px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: endOpen ? '8px 8px 0 0' : '8px',
                  color: endPortKey ? '#e2e8f0' : '#64748b',
                  fontSize: '11px',
                  padding: '8px 32px 8px 12px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  fontFamily: 'ui-monospace, monospace',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {endPortKey ? PORTS[endPortKey]?.name : '— Select —'}
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(239,68,68,0.5)', fontSize: '10px' }}>
                  {endOpen ? '▴' : '▾'}
                </span>
              </button>
              {endOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'rgba(10, 14, 30, 0.95)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(239, 68, 68, 0.25)',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  zIndex: 100,
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}>
                  <div
                    onClick={() => { onEndPortChange(''); setEndOpen(false) }}
                    style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}
                  >
                    — Select —
                  </div>
                  {Object.entries(PORTS).map(([key, p]) => (
                    <div
                      key={key}
                      onClick={() => { onEndPortChange(key); setEndOpen(false) }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: endPortKey === key ? '#ef4444' : '#e2e8f0',
                        background: endPortKey === key ? 'rgba(239,68,68,0.08)' : 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'ui-monospace, monospace',
                        letterSpacing: '0.05em',
                        borderTop: '0.5px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = endPortKey === key ? 'rgba(239,68,68,0.08)' : 'transparent')}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {(!startPortKey || !endPortKey) && (
          <p className="text-xs text-gray-500 text-center italic">
            Select both ports to generate routes and sightings.
          </p>
        )}

        {/* Ship type */}
        <div>
          <label className="block text-gray-200 text-xs uppercase tracking-widest mb-2">Ship Type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['cargo', 'tanker', 'cruise'] as ShipType[]).map(t => (
              <button
                key={t}
                onClick={() => onShipTypeChange(t)}
                className={`py-2 text-xs rounded border transition-all ${
                  shipType === t
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
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
            <label className="text-gray-200 text-xs uppercase tracking-widest">Speed</label>
            <span className="text-cyan-400 font-mono text-sm">{shipSpeed} kn</span>
          </div>
          <input
            type="range" min={3} max={25} step={1} value={shipSpeed}
            onChange={e => onSpeedChange(Number(e.target.value))}
            className="w-full"
            style={{
              '--val': `${((shipSpeed - 3) / (25 - 3)) * 100}%`
            } as React.CSSProperties}
          />
          <div className="flex justify-between text-gray-400 text-xs mt-1">
            <span>3 kn</span><span>25 kn</span>
          </div>
        </div>

        {/* Noise footprint stats */}
        <div className="glow-border rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
          <p className="text-gray-200 text-xs uppercase tracking-widest mb-3">Noise Footprint</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono text-white">{radiusNm.toFixed(2)}</span>
            <span className="text-gray-300 text-sm mb-1">nm radius</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (radiusNm / 15) * 100)}%`,
                background: radiusNm < 4 ? '#00d2ff' : radiusNm < 8 ? '#f5a623' : '#ff3c3c',
              }}
            />
          </div>
        </div>

        {/* Alert banner */}
        <div className={`glow-border rounded-lg p-3 border text-xs ${severityBg}`}>
          <p className="font-semibold text-white mb-1">
            {alerts.length === 0 ? '✓ All clear' : `⚠ ${alerts.length} intersection${alerts.length > 1 ? 's' : ''}`}
          </p>
          {alerts.slice(0, 3).map((a, i) => (
            <p key={i} className="text-gray-300 leading-relaxed">{a.message}</p>
          ))}
        </div>

        {/* Sightings count */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glow-border2 rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
            <p className="text-2xl font-mono text-purple-400">{sightings.length}</p>
            <p className="text-gray-200 text-xs mt-0.5">Sightings</p>
          </div>
          <div className="glow-border3 rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
            <p className="text-2xl font-mono text-orange-400">{alerts.length}</p>
            <p className="text-gray-200 text-xs mt-0.5">Alerts</p>
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
            <div className="mt-3 rounded p-3 text-xs text-gray-300 leading-relaxed" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
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