import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { getRoutes } from "./routes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { initializeModules } from "@/lib/modules/registry";
import { initializeDatabase } from "@/core/storage/db";
import { useAuthStore } from "@/stores/authStore";
import "./index.css";
import "./i18n/config";

// Initialize modules and database
// IMPORTANT: Modules must be initialized first to register their schemas
let initializationStarted = false;

async function initializeApp() {
  // Check if DB is already initialized (from previous HMR cycle)
  const { getDB } = await import("@/core/storage/db");
  try {
    getDB();
    console.info(
      "⚠️  Database already initialized from previous session, skipping initialization"
    );
    return true; // Already initialized successfully
  } catch {
    // DB not initialized yet, continue
  }

  // Prevent multiple initializations (React StrictMode, HMR, etc.)
  if (initializationStarted) {
    console.info("⚠️  Initialization already in progress, skipping...");
    // Wait a bit and check if initialization completed
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      getDB();
      return true; // Initialization completed by another caller
    } catch {
      return false; // Still not initialized, something went wrong
    }
  }
  initializationStarted = true;

  try {
    console.info("🚀 Starting app initialization...");

    // Step 1: Initialize modules (registers schemas with db, but does NOT load instances yet)
    await initializeModules();

    // Step 2: Initialize database (opens db with all module schemas)
    await initializeDatabase();

    // Step 3: Initialize store initializer (subscribes to unlock/lock events)
    const { initializeStoreInitializer } = await import("@/core/storage/StoreInitializer");
    initializeStoreInitializer();

    // Step 4: Now load module instances (requires db to be open)
    const moduleStore = (
      await import("@/stores/moduleStore")
    ).useModuleStore.getState();
    await moduleStore.loadModuleInstances();

    // Step 5: Load identities from DB (public info only - private keys stay encrypted)
    const authStore = useAuthStore.getState();
    await authStore.loadIdentities();

    // If there's a saved identity preference, select it (but don't unlock)
    // The user will need to enter their password to unlock
    // This is handled by the UI layer now

    // Step 6: Start syncing Nostr events for all groups + messages (if unlocked)
    // Note: Sync will only work if the app is unlocked
    if (authStore.lockState === 'unlocked' && authStore.currentIdentity) {
      const { startAllSyncs } = await import("@/core/storage/sync");
      await startAllSyncs();
    }

    console.info("✅ App initialization complete");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize app:", error);
    initializationStarted = false; // Allow retry on error
    return false;
  }
}

const RootLayout: React.FC = () => {
  // Start initialization (non-blocking)
  const [isAppInitialized, setIsAppInitialized] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [router, setRouter] = React.useState(createBrowserRouter(getRoutes()));

  useEffect(() => {
    initializeApp()
      .then((result) => {
        console.info("App initialization result:", result);
        if (result) {
          setIsAppInitialized(true);
        } else {
          setInitError("Failed to initialize application. Please refresh the page.");
        }
      })
      .catch((error) => {
        console.error("Initialization error:", error);
        setInitError(error instanceof Error ? error.message : "An unexpected error occurred.");
      });
  }, []);

  useEffect(() => {
    // Recreate router when app is initialized to load dynamic routes
    // This intentionally triggers a re-render to update the router
    if (isAppInitialized) {
      console.info("Recreating router after app initialization");
      const routes = getRoutes();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: router must update after initialization
      setRouter(createBrowserRouter(routes));
    }
  }, [isAppInitialized]);

  // Show error UI when initialization fails
  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-destructive">Initialization Error</h1>
          <p className="text-muted-foreground">{initError}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading UI while initializing
  if (!isAppInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider
      defaultTheme="system"
      defaultColorTheme="blue"
      storageKey="buildn-ui-theme"
    >
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootLayout />
  </React.StrictMode>
);
