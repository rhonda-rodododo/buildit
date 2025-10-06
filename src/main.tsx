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

// Debug: Track main.tsx import
console.log('[MAIN] main.tsx imported at:', new Date().toISOString())

// Initialize modules and database
// IMPORTANT: Modules must be initialized first to register their schemas
let initializationStarted = false;

async function initializeApp() {
  const timestamp = () => `[${new Date().toISOString()}]`;

  // Check if DB is already initialized (from previous HMR cycle)
  const { getDB } = await import('@/core/storage/db');
  let dbAlreadyExists = false;
  try {
    getDB();
    dbAlreadyExists = true;
    console.log(timestamp(), '⚠️  [MAIN] Database already initialized from previous session, skipping initialization');
    return;
  } catch {
    // DB not initialized yet, continue
  }

  // Prevent multiple initializations (React StrictMode, HMR, etc.)
  if (initializationStarted) {
    console.log(timestamp(), '⚠️  Initialization already in progress, skipping...')
    return
  }
  initializationStarted = true

  // Debug: Mark start
  if (typeof window !== 'undefined') {
    (window as any).__INIT_APP_STARTED = Date.now();
  }

  try {
    console.log(timestamp(), '🚀 [MAIN] Starting app initialization...')

    // Step 1: Initialize modules (registers schemas with db, but does NOT load instances yet)
    console.log(timestamp(), '📦 [MAIN] Step 1: Calling initializeModules()...')
    const modulesStart = Date.now();
    await initializeModules()
    const modulesEnd = Date.now();
    console.log(timestamp(), `✅ [MAIN] Step 1 complete: initializeModules() finished (${modulesEnd - modulesStart}ms)`)

    // Step 2: Initialize database (opens db with all module schemas)
    console.log(timestamp(), '🔧 [MAIN] Step 2: Calling initializeDatabase()...')
    const dbStart = Date.now();
    await initializeDatabase()
    const dbEnd = Date.now();
    console.log(timestamp(), `✅ [MAIN] Step 2 complete: initializeDatabase() finished (${dbEnd - dbStart}ms)`)

    // Step 3: Now load module instances (requires db to be open)
    console.log(timestamp(), '📂 Step 3: Loading module instances...')
    const moduleStore = (await import('@/stores/moduleStore')).useModuleStore.getState()
    await moduleStore.loadModuleInstances()
    console.log(timestamp(), '✅ Step 3 complete: Module instances loaded')

    // Step 4: Load current identity's private key from DB (if user was logged in)
    const authStore = useAuthStore.getState()
    if (authStore.currentIdentity) {
      console.log(timestamp(), '🔑 Step 4: Loading identity private key...')
      await authStore.loadCurrentIdentityPrivateKey()

      // Step 5: Start syncing Nostr events for all groups
      console.log(timestamp(), '🔄 Step 5: Starting Nostr sync...')
      const { startAllGroupsSync } = await import('@/core/storage/sync')
      await startAllGroupsSync()
      console.log(timestamp(), '✅ Step 5 complete: Nostr sync started')
    }

    console.log(timestamp(), '✅ App initialization complete')
  } catch (error) {
    console.error(timestamp(), '❌ Failed to initialize app:', error)
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
