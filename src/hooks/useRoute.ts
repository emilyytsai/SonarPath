import { useState } from 'react'
import type { RouteResult } from '../types'

export function useRoute() {
  const [routes, setRoutes] = useState<RouteResult[]>([])
  const [selected, setSelected] = useState<RouteResult['type'] | null>(null)
  return { routes, setRoutes, selected, setSelected }
}
