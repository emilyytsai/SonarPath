import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import IdentityManager from '@arcgis/core/identity/IdentityManager'
import './index.css'
import App from './App.tsx'

// Wipe any cached credentials and permanently short-circuit getCredential so
// the ArcGIS SDK never opens a login dialog, regardless of service error codes.
IdentityManager.destroyCredentials()
IdentityManager.getCredential = () => Promise.reject(new Error('auth disabled'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)