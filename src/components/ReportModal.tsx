import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import type { ShipType, IntersectionAlert, WhaleSighting, RouteResult } from '../types'
import { getNoiseRadius } from '../services/acoustics'
import { generateESGReport } from '../services/gemini'

interface ReportModalProps {
  shipSpeed: number
  shipType: ShipType
  alerts: IntersectionAlert[]
  sightings: WhaleSighting[]
  routes: RouteResult[]
  selectedRoute: RouteResult['type'] | null
  onClose: () => void
}

export default function ReportModal({
  shipSpeed, shipType, alerts, sightings, routes, selectedRoute, onClose,
}: ReportModalProps) {
  const [reportText, setReportText] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const radiusNm = getNoiseRadius(shipSpeed, shipType)
  const activeRoute = routes.find(r => r.type === (selectedRoute ?? 'eco')) ?? routes[0]
  const directRoute = routes.find(r => r.type === 'direct')

  const fuelSaved = directRoute && activeRoute ? directRoute.fuelCostUSD - activeRoute.fuelCostUSD : 0
  const co2Saved  = directRoute && activeRoute ? Math.round((directRoute.co2Tons - activeRoute.co2Tons) * 10) / 10 : 0

  useEffect(() => {
    async function load() {
      if (!activeRoute) {
        setReportText('No route data available.')
        setLoading(false)
        return
      }
      try {
        const text = await generateESGReport({
          shipType, speedKnots: shipSpeed, noiseRadiusNm: radiusNm,
          alerts, nearbySightings: sightings,
          selectedRoute: activeRoute.label,
          distanceNm: activeRoute.distanceNm,
          fuelSavedTons: Math.round(fuelSaved / 620),
          co2SavedTons: co2Saved,
        })
        setReportText(text)
      } catch {
        setReportText(`ESG COMPLIANCE REPORT
Generated: ${new Date().toISOString()}

EXECUTIVE SUMMARY
Vessel operating at ${shipSpeed} knots with noise footprint radius of ${radiusNm.toFixed(2)} nautical miles. Route: ${activeRoute?.label ?? 'N/A'}.

ENVIRONMENTAL IMPACT
- Active whale sighting alerts: ${alerts.length}
- Total sightings in area: ${sightings.length}
- Estimated CO2 savings: ${co2Saved} tons vs direct route

REGULATORY COMPLIANCE
Operating under IMO Resolution MEPC.1/Circ.674 guidelines for noise pollution reduction. Vessel speed and routing adjusted to minimize cetacean acoustic impact.

RECOMMENDATIONS
${alerts.length > 0 ? '• Reduce speed to below 10 knots to decrease halo radius\n• Consider eco-route to avoid sighting zones' : '• Continue current routing — no immediate interventions required'}

(AI report generation unavailable — check VITE_GEMINI_API_KEY)`)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function downloadPDF() {
    const doc = new jsPDF()
    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setTextColor(0, 210, 255)
    doc.setFontSize(16)
    doc.text('SonarPath — ESG Compliance Report', 15, 20)
    doc.setTextColor(150, 160, 180)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 28)
    doc.setTextColor(220, 230, 240)
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(reportText, 180)
    doc.text(lines as string[], 15, 38)
    doc.save(`sonarpath-esg-${Date.now()}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-xl w-[680px] max-h-[80vh] flex flex-col" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255, 255, 255, 0.15)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold text-sm uppercase tracking-widest">ESG Compliance Report</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {shipType} • {shipSpeed} kn • {activeRoute?.label ?? '—'} route
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-0 border-b border-white/10">
          {[
            { label: 'Halo Radius', value: `${radiusNm.toFixed(2)} nm` },
            { label: 'Alerts',      value: `${alerts.length}` },
            { label: 'CO₂ Saved',   value: `${co2Saved} t` },
            { label: 'Fuel Saved',  value: `$${fuelSaved.toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label} className="px-5 py-3 border-r last:border-r-0 border-white/10 text-center">
              <p className="text-lg font-mono text-cyan-400">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Report text */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-cyan-400 text-xs animate-pulse uppercase tracking-widest">Generating AI report…</p>
            </div>
          ) : (
            <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{reportText}</pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={downloadPDF}
            disabled={loading}
            className="flex-1 py-2.5 text-xs rounded border border-emerald-600/50 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 uppercase tracking-widest"
          >
            ↓ Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-xs rounded border border-white/10 text-gray-400 hover:border-gray-500 hover:text-white transition-colors uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
