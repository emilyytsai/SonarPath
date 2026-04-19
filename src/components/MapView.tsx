import { useEffect, useRef, useCallback } from 'react'
import EsriMap from '@arcgis/core/Map'
import MapViewArcGIS from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
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
import * as route from '@arcgis/core/rest/route'
import RouteParameters from '@arcgis/core/rest/support/RouteParameters'
import FeatureSet from '@arcgis/core/rest/support/FeatureSet'
import type { ShipType, WhaleSighting, RouteResult, IntersectionAlert } from '../types'
import { getNoiseRadius, getHaloColor, getHaloSeverity, estimateTripCosts } from '../services/acoustics'

const ROUTE_SERVICE_URL =
  'https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World'

// SF Bay → LA Port
const ORIGIN: [number, number] = [-122.4194, 37.8044]
const DESTINATION: [number, number] = [-118.2174, 33.7546]

// Fallback polylines if route service is unavailable
const FALLBACK_ROUTES: Record<string, number[][]> = {
  direct: [
    [-122.42, 37.80], [-122.30, 37.20], [-122.10, 36.60],
    [-121.80, 35.90], [-121.20, 35.20], [-120.50, 34.60],
    [-119.60, 34.10], [-118.80, 33.90], [-118.22, 33.75],
  ],
  suggested: [
    [-122.42, 37.80], [-122.60, 37.10], [-122.70, 36.40],
    [-122.50, 35.70], [-121.90, 35.00], [-121.20, 34.40],
    [-120.20, 33.95], [-119.20, 33.78], [-118.22, 33.75],
  ],
  eco: [
    [-122.42, 37.80], [-123.10, 37.00], [-123.40, 36.20],
    [-123.10, 35.40], [-122.40, 34.70], [-121.40, 34.10],
    [-120.10, 33.85], [-118.90, 33.75], [-118.22, 33.75],
  ],
}

const ROUTE_STYLES: RouteResult[] = [
  { type: 'direct',    label: 'Direct',    distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, co2Tons: 0, color: '#4a9eed' },
  { type: 'suggested', label: 'Suggested', distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, co2Tons: 0, color: '#f5a623' },
  { type: 'eco',       label: 'Eco',       distanceNm: 0, durationHrs: 0, fuelCostUSD: 0, co2Tons: 0, color: '#5cb85c' },
]

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function polylineLength(coords: number[][]): number {
  let dist = 0
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i - 1][0]) * 85  // rough km per degree lng
    const dy = (coords[i][1] - coords[i - 1][1]) * 111
    dist += Math.sqrt(dx * dx + dy * dy) * 0.539957 // km → nm
  }
  return Math.round(dist)
}

// Whale SVG icon sized by confidence
const confidenceSizes: Record<string, number> = {
  high:   30,
  medium: 24,
  low:    20,
}

function makeWhaleSvgUrl(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <ellipse cx="14" cy="17" rx="11" ry="7" fill="#a78bfa" opacity="0.9"/>
      <ellipse cx="14" cy="17" rx="11" ry="7" fill="none" stroke="white" stroke-width="0.8" opacity="0.6"/>
      <ellipse cx="10" cy="15" rx="2" ry="1.5" fill="white" opacity="0.3"/>
      <circle cx="8" cy="15" r="1" fill="white" opacity="0.9"/>
      <path d="M25 14 Q29 10 28 17 Q29 20 25 18 Z" fill="#a78bfa" opacity="0.9"/>
      <path d="M25 14 Q29 10 28 17 Q29 20 25 18 Z" fill="none" stroke="white" stroke-width="0.8" opacity="0.6"/>
      <ellipse cx="11" cy="22" rx="5" ry="2" fill="#7c3aed" opacity="0.4"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

interface MapViewProps {
  shipSpeed: number
  shipType: ShipType
  sightings: WhaleSighting[]
  onAlert: (alerts: IntersectionAlert[]) => void
  onRoutesReady: (routes: RouteResult[]) => void
}

export default function MapView({ shipSpeed, shipType, sightings, onAlert, onRoutesReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapViewArcGIS | null>(null)
  const haloLayerRef = useRef<GraphicsLayer | null>(null)
  const sightingsLayerRef = useRef<GraphicsLayer | null>(null)
  const routeLayerRef = useRef<GraphicsLayer | null>(null)
  const shipLayerRef = useRef<GraphicsLayer | null>(null)
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Render whale sightings ────────────────────────────────────────────────
  const renderSightings = useCallback((layer: GraphicsLayer, data: WhaleSighting[]) => {
    layer.removeAll()
    data.forEach(s => {
      const pt = new Point({ longitude: s.lng, latitude: s.lat, spatialReference: { wkid: 4326 } })
      const size = confidenceSizes[s.confidence] ?? 16

      // Whale icon marker
      layer.add(new Graphic({
        geometry: pt,
        symbol: new PictureMarkerSymbol({
          url: makeWhaleSvgUrl(),
          width: size,
          height: size,
        }),
        attributes: { species: s.species, confidence: s.confidence },
      }))

      // Species label
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

  // ── Draw acoustic halo ─────────────────────────────────────────────────────
  // geodesicBuffer is designed for geographic SR (4326) and accepts linear units directly.
  const updateHalo = useCallback((layer: GraphicsLayer, speed: number, type: ShipType, data: WhaleSighting[]) => {
    // Clear existing pulse interval before redrawing
    if (pulseRef.current) {
      clearInterval(pulseRef.current)
      pulseRef.current = null
    }

    layer.removeAll()
    const radiusNm = getNoiseRadius(speed, type)
    const severity = getHaloSeverity(radiusNm)
    const [r, g, b, a] = getHaloColor(severity)

    const shipPt = new Point({ longitude: ORIGIN[0], latitude: ORIGIN[1], spatialReference: { wkid: 4326 } })
    const halo = geometryEngine.geodesicBuffer(shipPt, radiusNm, 'nautical-miles') as Polygon
    if (!halo) return

    // Outer glow rings — indices 0, 1, 2
    for (let i = 3; i >= 1; i--) {
      const ring = geometryEngine.geodesicBuffer(shipPt, radiusNm * (1 + i * 0.2), 'nautical-miles') as Polygon
      if (ring) {
        layer.add(new Graphic({
          geometry: ring,
          symbol: new SimpleFillSymbol({
            color: [r, g, b, a * 0.08 * i],
            outline: { color: [r, g, b, 0.15], width: 0.5 },
          }),
        }))
      }
    }

    // Main halo — index 3
    layer.add(new Graphic({
      geometry: halo,
      symbol: new SimpleFillSymbol({
        color: [r, g, b, a],
        outline: { color: [r, g, b, 0.8], width: 2 },
      }),
    }))

    // Glowing border ring — index 4 (bright outline that pulses)
    layer.add(new Graphic({
      geometry: halo,
      symbol: new SimpleFillSymbol({
        color: [r, g, b, 0],
        outline: { color: [r, g, b, 1], width: 3 },
      }),
    }))

    // Pulse animation — oscillate opacity of outer rings and glowing border
    let phase = 0
    pulseRef.current = setInterval(() => {
      phase += 0.06
      const pulse = (Math.sin(phase) + 1) / 2 // oscillates 0 → 1 → 0

      const graphics = layer.graphics.toArray()

      graphics.forEach((graphic, idx) => {
        // Pulse outer glow rings (indices 0-2)
        if (idx < 3) {
          const baseAlpha = a * 0.08 * (3 - idx)
          graphic.symbol = new SimpleFillSymbol({
            color: [r, g, b, baseAlpha + pulse * 0.1],
            outline: { color: [r, g, b, 0.1 + pulse * 0.2], width: 0.5 },
          })
        }

        // Pulse the glowing border ring (index 4)
        if (idx === 4) {
          graphic.symbol = new SimpleFillSymbol({
            color: [r, g, b, 0],
            outline: { color: [r, g, b, 0.4 + pulse * 0.10], width: 2 + pulse * 2 },
          })
        }
      })
    }, 25)

    // Intersection checks — halo and sighting points share the same SR (4326)
    const alerts: IntersectionAlert[] = []
    data.forEach(s => {
      const sightPt = new Point({ longitude: s.lng, latitude: s.lat, spatialReference: { wkid: 4326 } })
      if (geometryEngine.intersects(halo, sightPt)) {
        alerts.push({ type: 'whale' as const, species: s.species, message: `Acoustic halo intersects ${s.species} sighting (${s.confidence} confidence)` })
      }
    })
    onAlert(alerts)
  }, [onAlert])

  // ── Solve routes via ArcGIS Route Service ────────────────────────────────
  // All three calls are made to the route service. With no API key in play
  // the service returns 499 → IdentityManager.getCredential rejects silently
  // → catch fires → FALLBACK_ROUTES supply the three distinct coastal paths.
  //
  // Route intent encoded in the API parameters (takes effect if the service
  // ever becomes accessible):
  //   Direct   : origin → destination, no barriers
  //   Suggested: origin → offshore midpoint → destination (forces longer arc)
  //   Eco      : origin → destination, pointBarriers at all whale sightings
  const solveRoutes = useCallback(async (layer: GraphicsLayer, data: WhaleSighting[], type: ShipType) => {
    const originPt = new Point({ longitude: ORIGIN[0],      latitude: ORIGIN[1],      spatialReference: { wkid: 4326 } })
    const destPt   = new Point({ longitude: DESTINATION[0], latitude: DESTINATION[1], spatialReference: { wkid: 4326 } })
    const midPt    = new Point({ longitude: -121.5,         latitude: 35.5,           spatialReference: { wkid: 4326 } })

    const makeStops = (...pts: Point[]) =>
      new FeatureSet({ features: pts.map(p => new Graphic({ geometry: p })) })

    const whaleBarriers = new FeatureSet({
      features: data.map(s => new Graphic({
        geometry: new Point({ longitude: s.lng, latitude: s.lat, spatialReference: { wkid: 4326 } }),
      })),
    })

    const routeDefs = [
      { key: 'direct'    as const, params: new RouteParameters({ stops: makeStops(originPt, destPt),          returnRoutes: true, returnDirections: false }) },
      { key: 'suggested' as const, params: new RouteParameters({ stops: makeStops(originPt, midPt, destPt),   returnRoutes: true, returnDirections: false }) },
      { key: 'eco'       as const, params: new RouteParameters({ stops: makeStops(originPt, destPt), pointBarriers: whaleBarriers, returnRoutes: true, returnDirections: false }) },
    ]

    layer.removeAll()
    const results: RouteResult[] = []

    await Promise.allSettled(
      routeDefs.map(async (def, idx) => {
        const style = ROUTE_STYLES[idx]
        let coords: number[][]

        try {
          const solved = await route.solve(ROUTE_SERVICE_URL, def.params)
          const rGeom = solved.routeResults[0]?.route?.geometry as Polyline | undefined
          coords = (rGeom?.paths?.[0] as number[][] | undefined) ?? FALLBACK_ROUTES[def.key]
        } catch {
          coords = FALLBACK_ROUTES[def.key]
        }

        const [rgb0, rgb1, rgb2] = hexToRgb(style.color)
        layer.add(new Graphic({
          geometry: new Polyline({ paths: [coords], spatialReference: { wkid: 4326 } }),
          symbol: new SimpleLineSymbol({
            color: [rgb0, rgb1, rgb2, 0.85],
            width: idx === 2 ? 3 : 2.5,
            style: idx === 0 ? 'solid' : idx === 1 ? 'short-dash' : 'dot',
          }),
        }))

        const distNm = polylineLength(coords)
        const costs  = estimateTripCosts(distNm, type)
        results[idx] = {
          ...style,
          distanceNm: distNm,
          durationHrs: Math.round((distNm / 14) * 10) / 10,
          ...costs,
        }
      })
    )

    onRoutesReady(results.filter(Boolean))
  }, [onRoutesReady])

  // ── Map initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const haloLayer    = new GraphicsLayer({ title: 'Acoustic Halo' })
    const sightLayer   = new GraphicsLayer({ title: 'Whale Sightings' })
    const routeLayer   = new GraphicsLayer({ title: 'Routes' })
    const shipLayer    = new GraphicsLayer({ title: 'Vessel' })
    const overlayLayer = new GraphicsLayer({ title: 'Shader' })

    haloLayerRef.current      = haloLayer
    sightingsLayerRef.current = sightLayer
    routeLayerRef.current     = routeLayer
    shipLayerRef.current      = shipLayer

    const map = new EsriMap({
      basemap: 'oceans',
      layers: [overlayLayer, routeLayer, haloLayer, sightLayer, shipLayer],
    })

    const view = new MapViewArcGIS({
      container: containerRef.current,
      map,
      center: [-120.8, 35.8],
      zoom: 6,
      background: { color: [109, 129, 152, 1] },
      ui: { components: [] },
    })

    view.constraints = {
      minZoom: 3,
      rotationEnabled: false,
      geometry: new Extent({
        xmin: -179,
        ymin: -75,
        xmax: 179,
        ymax: 75,
        spatialReference: { wkid: 4326 }
      })
    }

    const worldExtent = new Extent({
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    })

    overlayLayer.add(new Graphic({
      geometry: worldExtent,
      symbol: new SimpleFillSymbol({
        color: [8, 8, 23, 0.55],
        outline: { width: 0 }
      })
    }))

    viewRef.current = view

    // Ship marker at origin
    shipLayer.add(new Graphic({
      geometry: new Point({ longitude: ORIGIN[0], latitude: ORIGIN[1], spatialReference: { wkid: 4326 } }),
      symbol: new SimpleMarkerSymbol({
        style: 'triangle',
        color: [0, 210, 255, 1],
        size: 14,
        outline: { color: [255, 255, 255, 0.9], width: 1.5 },
        angle: 180,
      }),
    }))

    // Destination marker
    shipLayer.add(new Graphic({
      geometry: new Point({ longitude: DESTINATION[0], latitude: DESTINATION[1], spatialReference: { wkid: 4326 } }),
      symbol: new SimpleMarkerSymbol({
        style: 'circle',
        color: [255, 80, 80, 1],
        size: 12,
        outline: { color: [255, 255, 255, 0.9], width: 1.5 },
      }),
    }))

    return () => {
      // Clean up pulse interval and map view on unmount
      if (pulseRef.current) clearInterval(pulseRef.current)
      view.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-render sightings when data changes ─────────────────────────────────
  useEffect(() => {
    if (!sightingsLayerRef.current) return
    renderSightings(sightingsLayerRef.current, sightings)
  }, [sightings, renderSightings])

  // ── Re-draw halo when speed / type / sightings change ────────────────────
  useEffect(() => {
    if (!haloLayerRef.current) return
    updateHalo(haloLayerRef.current, shipSpeed, shipType, sightings)
  }, [shipSpeed, shipType, sightings, updateHalo])

  // ── Solve routes once sightings are loaded (eco route needs barrier data) ──
  useEffect(() => {
    if (!routeLayerRef.current || sightings.length === 0) return
    void solveRoutes(routeLayerRef.current, sightings, shipType)
  }, [sightings, shipType, solveRoutes])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}