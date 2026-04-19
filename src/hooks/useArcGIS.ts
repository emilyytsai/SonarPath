import { useRef } from 'react'
import type MapView from '@arcgis/core/views/MapView'

export function useArcGIS() {
  const viewRef = useRef<MapView | null>(null)
  return { viewRef }
}
