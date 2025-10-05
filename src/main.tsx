import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from '@/components/theme-provider'
import { initializeModules } from '@/lib/modules/registry'
import { initializeDatabase } from '@/core/storage/db'
import './index.css'
import './i18n/config'

// Initialize database and modules
async function initializeApp() {
  try {
    await initializeDatabase()
    await initializeModules()
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
}

// Start initialization (non-blocking)
initializeApp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" defaultColorTheme="blue" storageKey="buildn-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
