import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ShipType, IntersectionAlert, WhaleSighting } from '../types'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string)

export interface CaptainContext {
  shipType: ShipType
  speedKnots: number
  noiseRadiusNm: number
  alerts: IntersectionAlert[]
  nearbySightings: WhaleSighting[]
}

export async function generateCaptainAdvice(ctx: CaptainContext): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const alertText = ctx.alerts.length > 0
    ? ctx.alerts.map(a => a.message).join('; ')
    : 'None'

  const sightingText = ctx.nearbySightings.length > 0
    ? ctx.nearbySightings.map(s => `${s.species} (${s.confidence} confidence)`).join(', ')
    : 'None detected'

  const prompt = `You are a maritime environmental compliance officer advising a ship captain.

Ship Profile:
- Type: ${ctx.shipType}
- Speed: ${ctx.speedKnots} knots
- Acoustic halo radius: ${ctx.noiseRadiusNm.toFixed(2)} nautical miles

Active alerts: ${alertText}
Whale species within halo: ${sightingText}

Give 2-3 sentences of direct, actionable advice on speed reduction, route deviation, or IMO/NOAA regulatory obligations. Be specific and professional.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

export async function generateESGReport(ctx: CaptainContext & {
  selectedRoute: string
  distanceNm: number
  fuelSavedTons: number
  co2SavedTons: number
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Generate a concise ESG compliance report for a maritime voyage.

Vessel: ${ctx.shipType} class ship
Route taken: ${ctx.selectedRoute}
Distance: ${ctx.distanceNm} nautical miles
Speed: ${ctx.speedKnots} knots (acoustic halo: ${ctx.noiseRadiusNm.toFixed(2)} nm radius)
Whale encounters avoided: ${ctx.nearbySightings.length}
Fuel saved vs direct route: ${ctx.fuelSavedTons} tons
CO2 avoided: ${ctx.co2SavedTons} tons

Write a professional ESG report with sections: Executive Summary, Environmental Impact, Regulatory Compliance, and Recommendations. Use plain text with clear section headers. Keep it under 400 words.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}
