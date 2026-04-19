import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import esriConfig from '@arcgis/core/config'
import './index.css'
import App from './App.tsx'

esriConfig.apiKey = import.meta.env.VITE_ARCGIS_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)