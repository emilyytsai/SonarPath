export interface Ship {
  position: [number, number]
  speedKnots: number
  type: ShipType
}

export type ShipType = 'cargo' | 'tanker' | 'cruise'

export interface Route {
  coordinates: [number, number][]
  type: 'standard' | 'sanctuary'
}

export interface NoiseZone {
  id: string
  center: [number, number]
  radiusNauticalMiles: number
  severity: 'warning' | 'danger'
}

export interface WhaleSighting {
  id: string
  species: string
  lat: number
  lng: number
  date: string
  confidence: 'high' | 'medium' | 'low'
}

export interface RouteResult {
  type: 'direct' | 'suggested' | 'eco'
  label: string
  distanceNm: number
  durationHrs: number
  fuelCostUSD: number
  co2Tons: number
  color: string
}

export interface IntersectionAlert {
  type: 'whale' | 'sanctuary'
  message: string
  species?: string
}
