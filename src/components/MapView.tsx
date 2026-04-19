import { useEffect, useRef } from 'react'
import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Extent from '@arcgis/core/geometry/Extent'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol'
import type { Extent as EsriExtent } from '@arcgis/core/geometry/Extent'

export default function MapViewComponent() {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const map = new Map({
      basemap: 'oceans'
    })

    const view = new MapView({
      container: mapRef.current,
      map: map,
      center: [-140, 30],
      zoom: 4
    })

    view.constraints = {
      minZoom: 3,
      rotationEnabled: false,
      geometry: {
        type: "extent",
        xmin: -179,
        ymin: -75,
        xmax: 179,
        ymax: 75,
        spatialReference: { wkid: 4326 }
      } as unknown as EsriExtent
    }

    const overlayLayer = new GraphicsLayer()
    map.add(overlayLayer)

    const worldExtent = new Extent({
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    })

    const shader = new Graphic({
      geometry: worldExtent,
      symbol: new SimpleFillSymbol({
        color: [0, 5, 25, 0.4],
        outline: { width: 0 }
      })
    })

    overlayLayer.add(shader)

    return () => {
      view.destroy()
    }
  }, [])

  return (
    <div ref={mapRef} style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }} />
  )
}