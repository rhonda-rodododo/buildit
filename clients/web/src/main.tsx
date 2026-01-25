import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { getRoutes } from "./routes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { initializeModules } from "@/lib/modules/registry";
import { initializeDatabase } from "@/core/storage/db";
import { useAuthStore, getSavedIdentityPubkey } from "@/stores/authStore";
import { createLogger, criticalLogger } from "@/lib/logger";

const log = createLogger('init');
import "./index.css";
import "./i18n/config";

// Initialize modules and database
// IMPORTANT: Modules must be initialized first to register their schemas
let initializationPromise: Promise<boolean> | null = null;

const INIT_TIMEOUT_MS = 15000; // 15 seconds

async function initializeApp(): Promise<boolean> {
  // Check if DB is already initialized (from previous HMR cycle)
  const { getDB } = await import("@/core/storage/db");
  try {
    getDB();
    log.info("⚠️  Database already initialized from previous session, skipping initialization");
    return true; // Already initialized successfully
  } catch {
    // DB not initialized yet, continue
  }

  // If initialization is already in progress, wait for it to complete
  if (initializationPromise) {
    log.info("⚠️  Initialization already in progress, waiting...");
    return initializationPromise;
  }

  // Start initialization with timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Initialization timed out after ${INIT_TIMEOUT_MS / 1000} seconds. This may indicate a database or module loading issue.`));
    }, INIT_TIMEOUT_MS);
  });

  initializationPromise = Promise.race([doInitialize(), timeoutPromise]);
  return initializationPromise;
}

async function doInitialize(): Promise<boolean> {
  let currentStep = 'starting';

  try {
    log.info("🚀 Starting app initialization...");

    // Step 1: Initialize modules (registers schemas with db, but does NOT load instances yet)
    currentStep = 'initializing modules';
    log.info("  Step 1: Initializing modules...");
    await initializeModules();
    log.info("  Step 1: ✅ Modules initialized");

    // Step 2: Initialize database (opens db with all module schemas)
    currentStep = 'initializing database';
    log.info("  Step 2: Initializing database...");
    await initializeDatabase();
    log.info("  Step 2: ✅ Database initialized");

    // Step 2b: Start offline queue processor (requires database)
    currentStep = 'starting queue processor';
    log.info("  Step 2b: Starting offline queue processor...");
    const { startQueueProcessor } = await import("@/core/offline/queueProcessor");
    await startQueueProcessor();
    log.info("  Step 2b: ✅ Queue processor started");

    // Step 3: Initialize store initializer (subscribes to unlock/lock events)
    currentStep = 'initializing store initializer';
    log.info("  Step 3: Initializing store initializer...");
    const { initializeStoreInitializer } = await import("@/core/storage/StoreInitializer");
    initializeStoreInitializer();
    log.info("  Step 3: ✅ Store initializer ready");

    // Step 4: Now load module instances (requires db to be open)
    currentStep = 'loading module instances';
    log.info("  Step 4: Loading module instances...");
    const moduleStore = (
      await import("@/stores/moduleStore")
    ).useModuleStore.getState();
    await moduleStore.loadModuleInstances();
    log.info("  Step 4: ✅ Module instances loaded");

    // Step 5: Load identities from DB (public info only - private keys stay encrypted)
    currentStep = 'loading identities';
    log.info("  Step 5: Loading identities...");
    const authStore = useAuthStore.getState();
    await authStore.loadIdentities();
    log.info("  Step 5: ✅ Identities loaded");

    // Step 5b: Restore selected identity from localStorage (if any)
    const savedIdentityPubkey = getSavedIdentityPubkey();
    if (savedIdentityPubkey) {
      const savedIdentity = authStore.identities.find(i => i.publicKey === savedIdentityPubkey);
      if (savedIdentity) {
        log.info("  Step 5b: Restoring saved identity selection...");
        useAuthStore.setState({ currentIdentity: savedIdentity });
        log.info("  Step 5b: ✅ Identity selection restored (still locked)");
      }
    }

    // Step 6: Start syncing Nostr events for all groups + messages (if unlocked)
    // Note: Sync will only work if the app is unlocked
    currentStep = 'starting syncs';
    if (authStore.lockState === 'unlocked' && authStore.currentIdentity) {
      log.info("  Step 6: Starting syncs...");
      const { startAllSyncs } = await import("@/core/storage/sync");
      await startAllSyncs();
      log.info("  Step 6: ✅ Syncs started");
    } else {
      log.info("  Step 6: Skipped (not unlocked)");
    }

    log.info("✅ App initialization complete");
    return true;
  } catch (error) {
    // Use criticalLogger for errors since these should show in production
    criticalLogger.error(`❌ Failed to initialize app while ${currentStep}:`, error);
    // Log more details about the error
    if (error instanceof Error) {
      criticalLogger.error("  Error name:", error.name);
      criticalLogger.error("  Error message:", error.message);
      criticalLogger.error("  Error stack:", error.stack);
    }
    initializationPromise = null; // Allow retry on error
    throw new Error(`Initialization failed while ${currentStep}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const RootLayout: React.FC = () => {
  const { t } = useTranslation();
  // Start initialization (non-blocking)
  const [isAppInitialized, setIsAppInitialized] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [router, setRouter] = React.useState(createBrowserRouter(getRoutes()));

  useEffect(() => {
    initializeApp()
      .then((result) => {
        log.info("App initialization result:", result);
        if (result) {
          setIsAppInitialized(true);
        } else {
          setInitError(t("mainApp.initFailed"));
        }
      })
      .catch((error) => {
        criticalLogger.error("Initialization error:", error);
        setInitError(error instanceof Error ? error.message : "An unexpected error occurred.");
      });
  }, []);

  useEffect(() => {
    // Recreate router when app is initialized to load dynamic routes
    // This intentionally triggers a re-render to update the router
    if (isAppInitialized) {
      log.info("Recreating router after app initialization");
      const routes = getRoutes();
      setRouter(createBrowserRouter(routes));
    }
  }, [isAppInitialized]);

  // Show error UI when initialization fails
  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-destructive">{t("mainApp.initError")}</h1>
          <p className="text-muted-foreground">{initError}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            {t("mainApp.retry")}
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
          <p className="text-muted-foreground">{t("mainApp.initializing")}</p>
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
