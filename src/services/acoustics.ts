import type { ShipType } from '../types'

const TYPE_MULTIPLIERS: Record<ShipType, number> = {
  cargo: 1.0,
  tanker: 1.3,
  cruise: 0.8,
}

// R = (1 + max(0, (Speed - 10) * 0.5)) * Multiplier  (nautical miles)
export function getNoiseRadius(speedKnots: number, shipType: ShipType): number {
  const multiplier = TYPE_MULTIPLIERS[shipType]
  return (1 + Math.max(0, (speedKnots - 10) * 0.5)) * multiplier
}

export function getHaloSeverity(radiusNm: number): 'safe' | 'warning' | 'danger' {
  if (radiusNm < 4) return 'safe'
  if (radiusNm < 8) return 'warning'
  return 'danger'
}

export function getHaloColor(severity: 'safe' | 'warning' | 'danger'): [number, number, number, number] {
  switch (severity) {
    case 'safe':    return [0, 210, 255, 0.18]
    case 'warning': return [255, 200, 0, 0.22]
    case 'danger':  return [255, 60, 60, 0.28]
  }
}

// Estimate fuel consumption tons/nm by ship type
const FUEL_RATE: Record<ShipType, number> = { cargo: 0.50, tanker: 0.75, cruise: 0.30 }
const FUEL_PRICE_USD_PER_TON = 620
const CO2_PER_FUEL_TON = 3.17

export function estimateTripCosts(distanceNm: number, shipType: ShipType) {
  const fuelTons = distanceNm * FUEL_RATE[shipType]
  return {
    fuelCostUSD: Math.round(fuelTons * FUEL_PRICE_USD_PER_TON),
    co2Tons: Math.round(fuelTons * CO2_PER_FUEL_TON * 10) / 10,
  }
}
