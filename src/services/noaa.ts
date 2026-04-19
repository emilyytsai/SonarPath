import type { WhaleSighting } from '../types'

export async function fetchWhaleHabitats(): Promise<WhaleSighting[]> {
  const res = await fetch('/whale_sightings.json')
  if (!res.ok) throw new Error(`Failed to fetch whale sightings: ${res.status}`)
  return res.json() as Promise<WhaleSighting[]>
}
