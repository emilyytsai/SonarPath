import { useEffect, useRef, useCallback, useState } from 'react'
import EsriMap from '@arcgis/core/Map'
import MapViewArcGIS from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import Polygon from '@arcgis/core/geometry/Polygon'
import Polyline from '@arcgis/core/geometry/Polyline'
import Extent from '@arcgis/core/geometry/Extent'
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol'
import TextSymbol from '@arcgis/core/symbols/TextSymbol'
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer'
import LabelClass from '@arcgis/core/layers/support/LabelClass'
import { seaRoute } from 'searoute-ts'
import type { ShipType, WhaleSighting, RouteResult, IntersectionAlert } from '../types'
import { getNoiseRadius, getHaloColor, getHaloSeverity, estimateTripCosts } from '../services/acoustics'
import { PORTS } from '../data/ports'

// ── Sea routing helpers ───────────────────────────────────────────────────────

function solveSeaSegment(
  start: [number, number],
  end: [number, number],
): [number, number][] {
  const nudges = [0, 0.1, 0.3, 0.5]
  for (const n of nudges) {
    try {
      const result = seaRoute(
        [start[0] - n, start[1]],
        [end[0] - n, end[1]],
      )
      const coords = result?.geometry?.coordinates as [number, number][] | undefined
      if (coords && coords.length >= 2) {
        coords[0] = [...start]
        coords[coords.length - 1] = [...end]
        console.log(`[SonarPath] seaRoute succeeded with nudge=${n}, ${coords.length} pts`)
        return coords
      }
    } catch { /* try next nudge */ }
  }
  console.warn('[SonarPath] seaRoute failed all nudges — straight-line fallback')
  return [[...start], [...end]]
}

function landAwareOffsetPath(
  base: [number, number][],
  lngOffset: number,
  landPolygons: Polygon[],
): [number, number][] {
  const n = base.length
  return base.map(([lng, lat], i) => {
    const t = n > 1 ? i / (n - 1) : 0.5
    const weight = Math.sin(t * Math.PI)
    const fullOffset = lngOffset * weight
    if (landPolygons.length === 0 || fullOffset === 0) return [lng + fullOffset, lat] as [number, number]
    for (const scale of [1, 0.75, 0.5, 0.25, 0]) {
      const testLng = lng + fullOffset * scale
      const pt = new Point({ longitude: testLng, latitude: lat, spatialReference: { wkid: 4326 } })
      if (!landPolygons.some(poly => geometryEngine.intersects(poly, pt))) {
        return [testLng, lat] as [number, number]
      }
    }
    return [lng, lat] as [number, number]
  })
}

function routeIntersectsSanctuaries(coords: [number, number][], sanctuaries: Polygon[]): boolean {
  if (!sanctuaries.length) return false
  const line = new Polyline({ paths: [coords], spatialReference: { wkid: 4326 } })
  return sanctuaries.some(s => geometryEngine.intersects(s, line))
}

// Returns the nearest point on a polyline path to (lng, lat).
function nearestPointOnPath(coords: [number, number][], lng: number, lat: number): [number, number] {
  let best: [number, number] = coords[0]
  let bestDist = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i]
    const [x2, y2] = coords[i + 1]
    const dx = x2 - x1, dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((lng - x1) * dx + (lat - y1) * dy) / lenSq)) : 0
    const nx = x1 + t * dx, ny = y1 + t * dy
    const dist = (lng - nx) ** 2 + (lat - ny) ** 2
    if (dist < bestDist) { bestDist = dist; best = [nx, ny] }
  }
  return best
}

function makeShipSvgUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <path d="M16 4 L21 11 L21 25 L11 25 L11 11 Z" fill="#00d2ff" opacity="0.95"/>
    <path d="M16 4 L11 11 L21 11 Z" fill="#0099cc" opacity="0.9"/>
    <rect x="13" y="13" width="6" height="8" rx="1" fill="#005f8a" opacity="0.9"/>
    <circle cx="16" cy="7" r="1.2" fill="white" opacity="0.85"/>
    <path d="M11 25 L8 29 L24 29 L21 25 Z" fill="#0088bb" opacity="0.75"/>
    <path d="M8 29 Q10 31 12 29" stroke="white" stroke-width="0.7" fill="none" opacity="0.4"/>
    <path d="M20 29 Q22 31 24 29" stroke="white" stroke-width="0.7" fill="none" opacity="0.4"/>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ── Route styles ──────────────────────────────────────────────────────────────
const ROUTE_STYLES: RouteResult[] = [
  { type: 'direct',    label: 'Direct',    distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, baselineFuelCostUSD: 0, co2Tons: 0, color: '#4a9eed', portFeeUSD: 0, greenDiscount: 0 },
  { type: 'suggested', label: 'Suggested', distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, baselineFuelCostUSD: 0, co2Tons: 0, color: '#f5a623', portFeeUSD: 0, greenDiscount: 0 },
  { type: 'eco',       label: 'Eco',       distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, baselineFuelCostUSD: 0, co2Tons: 0, color: '#5cb85c', portFeeUSD: 0, greenDiscount: 0 },
]

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function polylineLength(coords: number[][]): number {
  let dist = 0
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i - 1][0]) * 85
    const dy = (coords[i][1] - coords[i - 1][1]) * 111
    dist += Math.sqrt(dx * dx + dy * dy) * 0.539957
  }
  return Math.round(dist)
}

// ── Whale helpers ─────────────────────────────────────────────────────────────
const confidenceSizes: Record<string, number> = { high: 30, medium: 24, low: 20 }
const WHALE_SPECIES = ['Humpback', 'Blue Whale', 'Gray Whale', 'Sperm Whale', 'Fin Whale', 'Orca']

function makeWhaleSvgUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <ellipse cx="14" cy="17" rx="11" ry="7" fill="#a78bfa" opacity="0.9"/>
    <ellipse cx="14" cy="17" rx="11" ry="7" fill="none" stroke="white" stroke-width="0.8" opacity="0.6"/>
    <ellipse cx="10" cy="15" rx="2" ry="1.5" fill="white" opacity="0.3"/>
    <circle cx="8" cy="15" r="1" fill="white" opacity="0.9"/>
    <path d="M25 14 Q29 10 28 17 Q29 20 25 18 Z" fill="#a78bfa" opacity="0.9"/>
    <path d="M25 14 Q29 10 28 17 Q29 20 25 18 Z" fill="none" stroke="white" stroke-width="0.8" opacity="0.6"/>
    <ellipse cx="11" cy="22" rx="5" ry="2" fill="#7c3aed" opacity="0.4"/>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ── Component ─────────────────────────────────────────────────────────────────
interface MapViewProps {
  shipSpeed: number
  shipType: ShipType
  onAlert: (alerts: IntersectionAlert[]) => void
  onRoutesReady: (routes: RouteResult[]) => void
  startPortKey: string
  endPortKey: string
  selectedRoute: RouteResult['type'] | null
}

export default function MapView({
  shipSpeed, shipType, onAlert, onRoutesReady,
  startPortKey, endPortKey, selectedRoute,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef             = useRef<MapViewArcGIS | null>(null)
  const haloLayerRef        = useRef<GraphicsLayer | null>(null)
  const sightingsLayerRef   = useRef<GraphicsLayer | null>(null)
  const routeLayerRef       = useRef<GraphicsLayer | null>(null)
  const shipLayerRef        = useRef<GraphicsLayer | null>(null)
  const shipMoveLayerRef    = useRef<GraphicsLayer | null>(null)
  const landLayerRef        = useRef<FeatureLayer | null>(null)
  const noaaLayerRef        = useRef<FeatureLayer | null>(null)
  const pulseRef            = useRef<ReturnType<typeof setInterval> | null>(null)

  // Refs used across effects without triggering re-runs
  const corridorSightingsRef  = useRef<WhaleSighting[]>([])
  const landPolygonsRef       = useRef<Polygon[]>([])
  const sanctuaryPolygonsRef  = useRef<Polygon[]>([])
  const sanctuaryAlertsRef    = useRef<IntersectionAlert[]>([])
  const shipTypeRef           = useRef(shipType)
  const shipSpeedRef          = useRef(shipSpeed)
  const selectedRouteRef      = useRef<RouteResult['type'] | null>(selectedRoute)
  const endPortKeyRef         = useRef(endPortKey)
  const startPortRef          = useRef<[number, number] | null>(null)
  const endPortRef            = useRef<[number, number] | null>(null)
  const hasSolvedOnceRef      = useRef(false)
  const isDraggingShipRef     = useRef(false)
  const shipPosRef            = useRef<[number, number] | null>(null)

  // Cached route coordinates — keyed by start/end/type to skip re-solving on speed changes
  const routeCoordsRef = useRef<{
    coords: Record<RouteResult['type'], [number, number][]>
    startKey: string
    endKey: string
    typeKey: ShipType
  } | null>(null)

  // Stable function ref for use inside map drag closure
  const updateShipPosRef = useRef<(pos: [number, number] | null) => void>(() => {})

  // Keep refs current every render
  shipTypeRef.current      = shipType
  shipSpeedRef.current     = shipSpeed
  selectedRouteRef.current = selectedRoute
  endPortKeyRef.current    = endPortKey
  if (startPortKey) startPortRef.current = PORTS[startPortKey]?.coords ?? null
  if (endPortKey)   endPortRef.current   = PORTS[endPortKey]?.coords   ?? null

  const [corridorSightings, setCorridorSightings] = useState<WhaleSighting[]>([])
  const [shipPos, setShipPos] = useState<[number, number] | null>(null)

  // ── Render whale sightings ────────────────────────────────────────────────
  const renderSightings = useCallback((layer: GraphicsLayer, data: WhaleSighting[]) => {
    layer.removeAll()
    data.forEach(s => {
      layer.add(new Graphic({
        geometry: new Point({ longitude: s.lng, latitude: s.lat, spatialReference: { wkid: 4326 } }),
        symbol: new PictureMarkerSymbol({
          url: makeWhaleSvgUrl(),
          width: confidenceSizes[s.confidence] ?? 16,
          height: confidenceSizes[s.confidence] ?? 16,
        }),
      }))
      layer.add(new Graphic({
        geometry: new Point({ longitude: s.lng, latitude: s.lat + 0.06, spatialReference: { wkid: 4326 } }),
        symbol: new TextSymbol({
          text: s.species,
          color: [200, 160, 255, 0.9],
          font: { size: 9, family: 'monospace' },
          haloColor: [10, 14, 26, 0.8],
          haloSize: 1.5,
        }),
      }))
    })
  }, [])

  // ── Acoustic halo ─────────────────────────────────────────────────────────
  const updateHalo = useCallback((
    layer: GraphicsLayer,
    speed: number,
    type: ShipType,
    data: WhaleSighting[],
    shipPosition: [number, number],
  ) => {
    if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null }
    layer.removeAll()

    const radiusNm = getNoiseRadius(speed, type)
    const severity = getHaloSeverity(radiusNm)
    const [r, g, b, a] = getHaloColor(severity)

    const shipPt = new Point({ longitude: shipPosition[0], latitude: shipPosition[1], spatialReference: { wkid: 4326 } })
    const halo   = geometryEngine.geodesicBuffer(shipPt, radiusNm, 'nautical-miles') as Polygon
    if (!halo) return

    for (let i = 3; i >= 1; i--) {
      const ring = geometryEngine.geodesicBuffer(shipPt, radiusNm * (1 + i * 0.2), 'nautical-miles') as Polygon
      if (ring) layer.add(new Graphic({ geometry: ring, symbol: new SimpleFillSymbol({ color: [r, g, b, a * 0.08 * i], outline: { color: [r, g, b, 0.15], width: 0.5 } }) }))
    }
    layer.add(new Graphic({ geometry: halo, symbol: new SimpleFillSymbol({ color: [r, g, b, a], outline: { color: [r, g, b, 0.8], width: 2 } }) }))
    layer.add(new Graphic({ geometry: halo, symbol: new SimpleFillSymbol({ color: [r, g, b, 0], outline: { color: [r, g, b, 1], width: 3 } }) }))

    let phase = 0
    pulseRef.current = setInterval(() => {
      phase += 0.06
      const pulse = (Math.sin(phase) + 1) / 2
      layer.graphics.toArray().forEach((graphic, idx) => {
        if (idx < 3) graphic.symbol = new SimpleFillSymbol({ color: [r, g, b, a * 0.08 * (3 - idx) + pulse * 0.1], outline: { color: [r, g, b, 0.1 + pulse * 0.2], width: 0.5 } })
        if (idx === 4) graphic.symbol = new SimpleFillSymbol({ color: [r, g, b, 0], outline: { color: [r, g, b, 0.4 + pulse * 0.1], width: 2 + pulse * 2 } })
      })
    }, 25)

    const alerts: IntersectionAlert[] = []
    data.forEach(s => {
      const sightPt = new Point({ longitude: s.lng, latitude: s.lat, spatialReference: { wkid: 4326 } })
      if (geometryEngine.intersects(halo, sightPt))
        alerts.push({
          type: 'whale',
          species: s.species,
          message: `Acoustic halo intersects ${s.species} sighting (${s.confidence} confidence) — reduce speed to 10 kts or less`,
        })
    })
    onAlert([...sanctuaryAlertsRef.current, ...alerts])
  }, [onAlert])

  // ── Water-only whale generation (async, queries land layer) ───────────────
  const generateWaterWhales = useCallback(async (
    start: [number, number],
    end: [number, number],
  ): Promise<WhaleSighting[]> => {
    const routeCoords = solveSeaSegment(start, end)

    const segLengths: number[] = []
    let totalLen = 0
    for (let i = 1; i < routeCoords.length; i++) {
      const dx = routeCoords[i][0] - routeCoords[i - 1][0]
      const dy = routeCoords[i][1] - routeCoords[i - 1][1]
      const len = Math.sqrt(dx * dx + dy * dy)
      segLengths.push(len)
      totalLen += len
    }

    const sampleOnRoute = (): [number, number] => {
      let t = Math.random() * totalLen
      for (let i = 0; i < segLengths.length; i++) {
        if (t <= segLengths[i] || i === segLengths.length - 1) {
          const frac = segLengths[i] > 0 ? t / segLengths[i] : 0
          return [
            routeCoords[i][0] + frac * (routeCoords[i + 1][0] - routeCoords[i][0]),
            routeCoords[i][1] + frac * (routeCoords[i + 1][1] - routeCoords[i][1]),
          ]
        }
        t -= segLengths[i]
      }
      return [...routeCoords[routeCoords.length - 1]] as [number, number]
    }

    const lngs = routeCoords.map(c => c[0])
    const lats  = routeCoords.map(c => c[1])
    const bboxLngMin = Math.min(...lngs) - 2.5
    const bboxLngMax = Math.max(...lngs) + 1.5
    const bboxLatMin = Math.min(...lats) - 1.5
    const bboxLatMax = Math.max(...lats) + 1.5

    let landPolygons: Polygon[] = []
    const landLayer = landLayerRef.current
    if (landLayer) {
      try {
        const result = await landLayer.queryFeatures({
          geometry: new Extent({ xmin: bboxLngMin, ymin: bboxLatMin, xmax: bboxLngMax, ymax: bboxLatMax, spatialReference: { wkid: 4326 } }),
          spatialRelationship: 'intersects',
          returnGeometry: true,
          outFields: [],
        })
        landPolygons = result.features.map(f => f.geometry as Polygon)
        landPolygonsRef.current = landPolygons
      } catch (e) {
        console.warn('[SonarPath] land query failed — skipping land check:', e)
      }
    }

    const noaaLayer = noaaLayerRef.current
    if (noaaLayer) {
      try {
        const result = await noaaLayer.queryFeatures({
          geometry: new Extent({ xmin: bboxLngMin, ymin: bboxLatMin, xmax: bboxLngMax, ymax: bboxLatMax, spatialReference: { wkid: 4326 } }),
          spatialRelationship: 'intersects',
          returnGeometry: true,
          outFields: [],
        })
        sanctuaryPolygonsRef.current = result.features.map(f => f.geometry as Polygon)
        console.log(`[SonarPath] queried ${sanctuaryPolygonsRef.current.length} sanctuary polygon(s)`)
      } catch (e) {
        console.warn('[SonarPath] NOAA sanctuary query failed:', e)
      }
    }

    const isOnLand = (lng: number, lat: number): boolean => {
      if (landPolygons.length === 0) return false
      const pt = new Point({ longitude: lng, latitude: lat, spatialReference: { wkid: 4326 } })
      return landPolygons.some(poly => geometryEngine.intersects(poly, pt))
    }

    const weightedConfidence = (): WhaleSighting['confidence'] => {
      const r = Math.random()
      return r < 0.15 ? 'high' : r < 0.55 ? 'medium' : 'low'
    }

    const today = new Date().toISOString().split('T')[0]
    const whales: WhaleSighting[] = []
    let uid = 0
    const tryAdd = (lng: number, lat: number) => {
      if (!isOnLand(lng, lat)) {
        whales.push({
          id: `whale-${Date.now()}-${uid++}`,
          species: WHALE_SPECIES[Math.floor(Math.random() * WHALE_SPECIES.length)],
          lat, lng, date: today,
          confidence: weightedConfidence(),
        })
        return true
      }
      return false
    }

    const corridorTarget = 5 + Math.floor(Math.random() * 4)
    let a = 0
    while (whales.length < corridorTarget && a++ < corridorTarget * 20) {
      const [baseLng, baseLat] = sampleOnRoute()
      tryAdd(baseLng + (Math.random() - 0.5) * 0.6, baseLat + (Math.random() - 0.5) * 0.5)
    }

    const numClusters = 2 + Math.floor(Math.random() * 2)
    for (let c = 0; c < numClusters; c++) {
      let center: [number, number] | null = null
      for (let t = 0; t < 40 && !center; t++) {
        const [bLng, bLat] = sampleOnRoute()
        const offLng = (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 1.2)
        const offLat = (Math.random() - 0.5) * 1.2
        if (!isOnLand(bLng + offLng, bLat + offLat)) center = [bLng + offLng, bLat + offLat]
      }
      if (!center) continue
      const clusterSize = 2 + Math.floor(Math.random() * 4)
      let ca = 0, added = 0
      while (added < clusterSize && ca++ < clusterSize * 25) {
        const r = 0.1 + Math.random() * 0.5
        const angle = Math.random() * Math.PI * 2
        if (tryAdd(center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r)) added++
      }
    }

    const loneTarget = 2 + Math.floor(Math.random() * 3)
    let la = 0, loneAdded = 0
    while (loneAdded < loneTarget && la++ < loneTarget * 40) {
      const lng = bboxLngMin + Math.random() * (bboxLngMax - bboxLngMin)
      const lat = bboxLatMin + Math.random() * (bboxLatMax - bboxLatMin)
      if (tryAdd(lng, lat)) loneAdded++
    }

    return whales
  }, [])

  // ── Update moving ship graphic ────────────────────────────────────────────
  const updateShipPos = useCallback((pos: [number, number] | null) => {
    shipPosRef.current = pos
    setShipPos(pos)
    const layer = shipMoveLayerRef.current
    if (!layer) return
    layer.removeAll()
    if (pos) {
      layer.add(new Graphic({
        geometry: new Point({ longitude: pos[0], latitude: pos[1], spatialReference: { wkid: 4326 } }),
        symbol: new PictureMarkerSymbol({ url: makeShipSvgUrl(), width: 30, height: 30 }),
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  updateShipPosRef.current = updateShipPos

  // ── Route solver ──────────────────────────────────────────────────────────
  const solveRoutes = useCallback((
    layer: GraphicsLayer,
    type: ShipType,
    start: [number, number],
    end: [number, number],
    speed: number,
  ) => {
    const startKey   = `${start[0]},${start[1]}`
    const endKey     = `${end[0]},${end[1]}`
    const cached     = routeCoordsRef.current
    const pathsMatch = cached?.startKey === startKey && cached?.endKey === endKey && cached?.typeKey === type

    let directCoords: [number, number][]
    let suggestedCoords: [number, number][]
    let ecoCoords: [number, number][]

    if (pathsMatch && cached) {
      directCoords    = cached.coords.direct
      suggestedCoords = cached.coords.suggested
      ecoCoords       = cached.coords.eco
    } else {
      // Full path recompute
      const landPolys      = landPolygonsRef.current
      const sanctuaryPolys = sanctuaryPolygonsRef.current

      directCoords = solveSeaSegment(start, end)

      const findAvoidingPath = (startOffset: number): [number, number][] => {
        for (let o = startOffset; Math.abs(o) <= 4.0; o -= 0.4) {
          const coords = landAwareOffsetPath(directCoords, o, landPolys)
          if (!routeIntersectsSanctuaries(coords, sanctuaryPolys)) return coords
        }
        return landAwareOffsetPath(directCoords, startOffset, landPolys)
      }

      suggestedCoords = findAvoidingPath(-0.8)
      ecoCoords       = findAvoidingPath(-1.6)

      const allCoords: [number, number][][] = [directCoords, suggestedCoords, ecoCoords]

      // Sanctuary alerts
      const newSanctuaryAlerts: IntersectionAlert[] = []
      allCoords.forEach((coords, idx) => {
        if (routeIntersectsSanctuaries(coords, sanctuaryPolys)) {
          newSanctuaryAlerts.push({
            type: 'sanctuary',
            species: '',
            message: `${ROUTE_STYLES[idx].label} route passes through a NOAA Marine Sanctuary — reduce to 10 kts when transiting`,
          })
        }
      })
      sanctuaryAlertsRef.current = newSanctuaryAlerts

      // Draw route graphics
      layer.removeAll()
      allCoords.forEach((coords, idx) => {
        const style = ROUTE_STYLES[idx]
        const [rgb0, rgb1, rgb2] = hexToRgb(style.color)
        layer.add(new Graphic({
          geometry: new Polyline({ paths: [coords], spatialReference: { wkid: 4326 } }),
          symbol: new SimpleLineSymbol({
            color: [rgb0, rgb1, rgb2, 0.85],
            width: idx === 2 ? 3 : 2.5,
            style: idx === 0 ? 'solid' : idx === 1 ? 'short-dash' : 'dot',
          }),
        }))
      })

      routeCoordsRef.current = {
        coords: { direct: directCoords, suggested: suggestedCoords, eco: ecoCoords },
        startKey, endKey, typeKey: type,
      }
    }

    // Always recompute costs — speed may have changed without path change
    const destPort      = PORTS[endPortKeyRef.current ?? '']
    const portFeeUSD    = destPort?.portFeeUSD    ?? 0
    const greenDiscount = destPort?.isGreen       ? 0.2 : 0

    const allRouteCoords: [number, number][][] = [directCoords!, suggestedCoords!, ecoCoords!]
    const results: RouteResult[] = allRouteCoords.map((coords, idx) => {
      const style    = ROUTE_STYLES[idx]
      const distNm   = polylineLength(coords)
      const costs    = estimateTripCosts(distNm, type, speed)
      const baseline = estimateTripCosts(distNm, type, 14)
      return {
        ...style,
        distanceNm: distNm,
        durationHrs: Math.round((distNm / speed) * 10) / 10,
        ...costs,
        baselineFuelCostUSD: baseline.fuelCostUSD,
        portFeeUSD,
        greenDiscount,
      }
    })

    onRoutesReady(results)
  }, [onRoutesReady])

  // ── Map initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const haloLayer      = new GraphicsLayer({ title: 'Acoustic Halo' })
    const sightLayer     = new GraphicsLayer({ title: 'Whale Sightings' })
    const routeLayer     = new GraphicsLayer({ title: 'Routes' })
    const shipLayer      = new GraphicsLayer({ title: 'Vessel' })
    const shipMoveLayer  = new GraphicsLayer({ title: 'Ship' })
    const overlayLayer   = new GraphicsLayer({ title: 'Shader' })
    const landLayer      = new FeatureLayer({
      url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0',
      visible: false,
      outFields: [],
    })

    const noaaLayer = new FeatureLayer({
      url: 'https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/NMS_Boundaries_02032022/FeatureServer/0',
      title: 'NOAA Marine Sanctuaries',
      outFields: ['NMS_Name', 'NMS_Abbrv'],
      renderer: new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color: [210, 60, 60, 0.15],
          outline: new SimpleLineSymbol({ color: [200, 70, 70, 0.7], width: 1.5, style: 'solid' }),
        }),
      }),
      labelingInfo: [new LabelClass({
        labelExpressionInfo: { expression: '$feature.NMS_Name' },
        symbol: new TextSymbol({
          color: [220, 110, 110, 1],
          font: { size: 9, family: 'monospace', weight: 'bold' },
          haloColor: [10, 14, 26, 0.95],
          haloSize: 2,
        }),
        minScale: 12000000,
      })],
    })

    haloLayerRef.current      = haloLayer
    sightingsLayerRef.current = sightLayer
    routeLayerRef.current     = routeLayer
    shipLayerRef.current      = shipLayer
    shipMoveLayerRef.current  = shipMoveLayer
    landLayerRef.current      = landLayer
    noaaLayerRef.current      = noaaLayer

    const map = new EsriMap({
      basemap: 'oceans',
      layers: [landLayer, overlayLayer, noaaLayer, routeLayer, haloLayer, sightLayer, shipLayer, shipMoveLayer],
    })

    const view = new MapViewArcGIS({
      container: containerRef.current,
      map,
      center: [-121, 40],
      zoom: 5,
      background: { color: [109, 129, 152, 1] },
      ui: { components: [] },
    })

    view.constraints = {
      minZoom: 3,
      rotationEnabled: false,
      geometry: new Extent({ xmin: -179, ymin: -75, xmax: 179, ymax: 75, spatialReference: { wkid: 4326 } }),
    }

    overlayLayer.add(new Graphic({
      geometry: new Extent({ xmin: -180, ymin: -90, xmax: 180, ymax: 90, spatialReference: { wkid: 4326 } }),
      symbol: new SimpleFillSymbol({ color: [8, 8, 23, 0.70], outline: { width: 0 } }),
    }))

    // Ship drag — snap vessel to nearest point on selected route
    const dragHandle = view.on('drag', event => {
      const ship = shipPosRef.current

      if (event.action === 'start') {
        isDraggingShipRef.current = false
        if (!ship) return
        const screenPos = view.toScreen(new Point({ longitude: ship[0], latitude: ship[1], spatialReference: { wkid: 4326 } }))
        if (!screenPos) return
        const dist = Math.sqrt((event.x - screenPos.x) ** 2 + (event.y - screenPos.y) ** 2)
        if (dist < 32) isDraggingShipRef.current = true
      }

      if (!isDraggingShipRef.current) return
      event.stopPropagation()

      if (event.action === 'update') {
        const routeType = selectedRouteRef.current
        const cached    = routeCoordsRef.current
        if (!routeType || !cached) return
        const routeCoords = cached.coords[routeType]
        if (!routeCoords) return
        const mapPt = view.toMap({ x: event.x, y: event.y })
        if (!mapPt || mapPt.longitude == null || mapPt.latitude == null) return
        const snapped = nearestPointOnPath(routeCoords, mapPt.longitude as number, mapPt.latitude as number)
        updateShipPosRef.current(snapped)
      }

      if (event.action === 'end') isDraggingShipRef.current = false
    })

    viewRef.current = view
    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current)
      dragHandle.remove()
      view.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Port markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = shipLayerRef.current
    if (!layer) return
    layer.removeAll()
    if (!startPortKey || !endPortKey) return

    const start = PORTS[startPortKey]?.coords
    const end   = PORTS[endPortKey]?.coords
    if (!start || !end) return

    layer.add(new Graphic({
      geometry: new Point({ longitude: start[0], latitude: start[1], spatialReference: { wkid: 4326 } }),
      symbol: new SimpleMarkerSymbol({ style: 'triangle', color: [0, 210, 255, 1], size: 14, angle: 180, outline: { color: [255, 255, 255, 0.9], width: 1.5 } }),
    }))
    layer.add(new Graphic({
      geometry: new Point({ longitude: end[0], latitude: end[1], spatialReference: { wkid: 4326 } }),
      symbol: new SimpleMarkerSymbol({ style: 'circle', color: [255, 80, 80, 1], size: 12, outline: { color: [255, 255, 255, 0.9], width: 1.5 } }),
    }))
  }, [startPortKey, endPortKey])

  // ── EFFECT A: Port change → generate whales → solve routes ───────────────
  useEffect(() => {
    if (!startPortKey || !endPortKey) {
      setCorridorSightings([])
      corridorSightingsRef.current = []
      routeLayerRef.current?.removeAll()
      sightingsLayerRef.current?.removeAll()
      haloLayerRef.current?.removeAll()
      if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null }
      hasSolvedOnceRef.current = false
      sanctuaryAlertsRef.current = []
      routeCoordsRef.current = null
      updateShipPosRef.current(null)
      onAlert([])
      onRoutesReady([])
      return
    }

    const start = PORTS[startPortKey].coords
    const end   = PORTS[endPortKey].coords
    let cancelled = false

    void generateWaterWhales(start, end).then(whales => {
      if (cancelled) return
      setCorridorSightings(whales)
      corridorSightingsRef.current = whales
      hasSolvedOnceRef.current = true
      if (routeLayerRef.current) {
        solveRoutes(routeLayerRef.current, shipTypeRef.current, start, end, shipSpeedRef.current)
      }
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPortKey, endPortKey])

  // ── EFFECT B: Ship type change → re-solve routes ──────────────────────────
  useEffect(() => {
    if (!hasSolvedOnceRef.current) return
    const start = startPortRef.current
    const end   = endPortRef.current
    if (!start || !end || !routeLayerRef.current) return
    solveRoutes(routeLayerRef.current, shipType, start, end, shipSpeedRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipType])

  // ── EFFECT C: Speed change → refresh costs (paths unchanged) ─────────────
  useEffect(() => {
    if (!hasSolvedOnceRef.current) return
    const start = startPortRef.current
    const end   = endPortRef.current
    if (!start || !end || !routeLayerRef.current) return
    solveRoutes(routeLayerRef.current, shipTypeRef.current, start, end, shipSpeed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipSpeed])

  // ── Re-render sightings when corridor whales update ───────────────────────
  useEffect(() => {
    if (!sightingsLayerRef.current) return
    renderSightings(sightingsLayerRef.current, corridorSightings)
  }, [corridorSightings, renderSightings])

  // ── Initialize ship on selected route ─────────────────────────────────────
  useEffect(() => {
    if (!selectedRoute || !startPortKey) {
      updateShipPos(null)
      return
    }
    const start = PORTS[startPortKey]?.coords
    if (!start) return
    updateShipPos([...start] as [number, number])
  }, [selectedRoute, startPortKey, updateShipPos])

  // ── Halo follows ship position ────────────────────────────────────────────
  useEffect(() => {
    if (!haloLayerRef.current || !startPortKey) return
    const pos = shipPos ?? PORTS[startPortKey]?.coords
    if (!pos) return
    updateHalo(haloLayerRef.current, shipSpeed, shipType, corridorSightings, pos)
  }, [shipSpeed, shipType, corridorSightings, startPortKey, shipPos, updateHalo])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
