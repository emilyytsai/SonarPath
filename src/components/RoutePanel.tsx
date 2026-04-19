import type { RouteResult } from '../types'

interface RoutePanelProps {
  routes: RouteResult[]
  selected: RouteResult['type'] | null
  onSelect: (t: RouteResult['type']) => void
}

const ICONS: Record<RouteResult['type'], string> = {
  direct:    '→',
  suggested: '↗',
  eco:       '♻',
}

export default function RoutePanel({ routes, selected, onSelect }: RoutePanelProps) {
  if (routes.length === 0) {
    return (
      <div className="h-36 bg-gray-950 border-t border-gray-800 flex items-center justify-center">
        <p className="text-gray-600 text-xs uppercase tracking-widest animate-pulse">Calculating routes…</p>
      </div>
    )
  }

  const directRoute = routes.find(r => r.type === 'direct')

  return (
    <div className="bg-gray-950 border-t border-gray-800 px-4 py-3">
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
              className={`rounded-lg p-3 border text-left transition-all ${
                selected === r.type
                  ? 'border-opacity-80 bg-white/5'
                  : 'border-gray-800 hover:border-gray-600'
              }`}
              style={{ borderColor: selected === r.type ? r.color : undefined }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base" style={{ color: r.color }}>{ICONS[r.type]}</span>
                <span className="text-white text-xs font-semibold uppercase tracking-wider">{r.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-gray-500">Distance</span>
                <span className="text-gray-300 font-mono text-right">{r.distanceNm} nm</span>
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-300 font-mono text-right">{r.durationHrs} h</span>
                <span className="text-gray-500">Fuel cost</span>
                <span className="text-gray-300 font-mono text-right">${r.fuelCostUSD.toLocaleString()}</span>
                <span className="text-gray-500">CO₂</span>
                <span className="text-gray-300 font-mono text-right">{r.co2Tons} t</span>
              </div>
              {savings && savings.co2 > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <span className="text-emerald-400 text-xs">↓ {savings.co2} t CO₂ saved</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
