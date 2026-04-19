import type { RouteResult } from '../types'

interface RoutePanelProps {
  routes: RouteResult[]
  selected: RouteResult['type'] | null
  onSelect: (t: RouteResult['type']) => void
}

const ICONS: Record<RouteResult['type'], string> = {
  direct:    '→',
  suggested: '✔',
  eco:       '♻',
}

export default function RoutePanel({ routes, selected, onSelect }: RoutePanelProps) {
  if (routes.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center" style={{
        background: 'rgba(10, 14, 26, 0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(255, 255, 255, 0.08)',
      }}>
        <p className="text-gray-600 text-xs uppercase tracking-widest animate-pulse">Calculating routes…</p>
      </div>
    )
  }

  const directRoute = routes.find(r => r.type === 'direct')

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '0.5px solid rgba(255, 255, 255, 0.15)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 -4px 20px rgba(0,0,0,0.1)',
      padding: '12px 16px',
    }}>
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Route Comparison</p>
      <div className="grid grid-cols-3 gap-3">
        {routes.map(r => {
          const savings = directRoute && r.type !== 'direct'
            ? { fuel: directRoute.fuelCostUSD - r.fuelCostUSD, co2: directRoute.co2Tons - r.co2Tons }
            : null

          return (
            <button
              key={r.type}
              onClick={() => onSelect(r.type)}
              className="rounded-lg p-3 text-left transition-all"
              style={{
                background: selected === r.type ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${selected === r.type ? r.color : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base" style={{ color: r.color }}>{ICONS[r.type]}</span>
                <span className="text-white text-xs font-semibold uppercase tracking-wider">{r.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-gray-800">Distance</span>
                <span className="text-gray-300 font-mono text-right">{r.distanceNm} nm</span>
                <span className="text-gray-800">Duration</span>
                <span className="text-gray-300 font-mono text-right">{r.durationHrs} h</span>
                <span className="text-gray-800">Fuel cost</span>
                <span className="text-gray-300 font-mono text-right">${r.fuelCostUSD.toLocaleString()}</span>
                <span className="text-gray-800">CO2</span>
                <span className="text-gray-300 font-mono text-right">{r.co2Tons} t</span>
              </div>
              {savings && savings.co2 > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-emerald-400 text-xs">↓ {savings.co2} t CO2 saved</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}