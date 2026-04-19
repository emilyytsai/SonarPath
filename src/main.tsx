import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import esriConfig from '@arcgis/core/config'
import IdentityManager from '@arcgis/core/identity/IdentityManager'
import './index.css'
import App from './App.tsx'

esriConfig.apiKey = import.meta.env.VITE_ARCGIS_KEY

IdentityManager.registerToken({
  server: 'https://route-api.arcgis.com',
  token: import.meta.env.VITE_ARCGIS_KEY
})

IdentityManager.registerToken({
  server: 'https://www.arcgis.com',
  token: import.meta.env.VITE_ARCGIS_KEY
})

IdentityManager.registerToken({
  server: 'https://services.arcgis.com',
  token: import.meta.env.VITE_ARCGIS_KEY
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)