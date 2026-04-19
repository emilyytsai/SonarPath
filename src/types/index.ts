export interface Ship {
  position: [number, number]
  speedKnots: number
  type: 'cargo' | 'tanker' | 'cruise'
}

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