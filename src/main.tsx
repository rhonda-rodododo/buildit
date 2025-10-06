import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { initializeModules } from '@/lib/modules/registry'
import { initializeDatabase } from '@/core/storage/db'
import { useAuthStore } from '@/stores/authStore'
import './index.css'
import './i18n/config'

// Initialize modules and database
// IMPORTANT: Modules must be initialized first to register their schemas
let initializationStarted = false;

async function initializeApp() {
  // Prevent multiple initializations (React StrictMode, HMR, etc.)
  if (initializationStarted) {
    console.log('⚠️  Initialization already in progress, skipping...')
    return
  }
  initializationStarted = true

  try {
    console.log('🚀 Starting app initialization...')

    // Step 1: Initialize modules (registers schemas with db, but does NOT load instances yet)
    await initializeModules()

    // Step 2: Initialize database (opens db with all module schemas)
    await initializeDatabase()

    // Step 3: Now load module instances (requires db to be open)
    const moduleStore = (await import('@/stores/moduleStore')).useModuleStore.getState()
    await moduleStore.loadModuleInstances()

    // Step 4: Load current identity's private key from DB (if user was logged in)
    const authStore = useAuthStore.getState()
    if (authStore.currentIdentity) {
      await authStore.loadCurrentIdentityPrivateKey()

      // Step 5: Start syncing Nostr events for all groups
      const { startAllGroupsSync } = await import('@/core/storage/sync')
      await startAllGroupsSync()
    }

    console.log('✅ App initialization complete')
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    initializationStarted = false // Allow retry on error
  }
}

// Start initialization (non-blocking)
initializeApp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" defaultColorTheme="blue" storageKey="buildn-ui-theme">
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
)
