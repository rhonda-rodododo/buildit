/**
 * Session Timeout and Auto-Lock
 *
 * Automatically locks the application after a period of inactivity
 * to protect against unauthorized access on unattended devices.
 */

import { useAuthStore } from '@/stores/authStore'

interface SessionConfig {
  inactivityTimeoutMs: number // Time before auto-lock
  warningTimeMs: number // Show warning before lock
  checkIntervalMs: number // How often to check for inactivity
}

type ActivityEvent = 'mousemove' | 'mousedown' | 'keydown' | 'scroll' | 'touchstart' | 'click'

class SessionManager {
  private config: SessionConfig = {
    inactivityTimeoutMs: 30 * 60 * 1000, // 30 minutes default
    warningTimeMs: 2 * 60 * 1000, // 2 minute warning
    checkIntervalMs: 10 * 1000, // Check every 10 seconds
  }

  private lastActivityTime: number = Date.now()
  private checkInterval: number | null = null
  private activityEvents: ActivityEvent[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
  private onWarning: (() => void) | null = null
  private onLock: (() => void) | null = null
  private warningShown: boolean = false

  /**
   * Initialize session timeout monitoring
   */
  init(config?: Partial<SessionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Record initial activity
    this.recordActivity()

    // Listen for user activity
    this.activityEvents.forEach(event => {
      document.addEventListener(event, this.handleActivity, { passive: true })
    })

    // Start checking for inactivity
    this.startMonitoring()

    // Listen for visibility change (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    console.log('🔒 Session timeout monitoring initialized', {
      timeout: `${this.config.inactivityTimeoutMs / 60000} minutes`,
      warning: `${this.config.warningTimeMs / 60000} minutes`,
    })
  }

  /**
   * Stop session timeout monitoring
   */
  destroy() {
    // Remove event listeners
    this.activityEvents.forEach(event => {
      document.removeEventListener(event, this.handleActivity)
    })

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    // Stop monitoring
    this.stopMonitoring()

    console.log('🔒 Session timeout monitoring destroyed')
  }

  /**
   * Handle user activity
   */
  private handleActivity = () => {
    this.recordActivity()
    this.warningShown = false
  }

  /**
   * Record activity timestamp
   */
  private recordActivity() {
    this.lastActivityTime = Date.now()
  }

  /**
   * Start monitoring for inactivity
   */
  private startMonitoring() {
    if (this.checkInterval !== null) return

    this.checkInterval = window.setInterval(() => {
      this.checkInactivity()
    }, this.config.checkIntervalMs)
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring() {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Check for inactivity and trigger warnings/lock
   */
  private checkInactivity() {
    const now = Date.now()
    const inactiveDuration = now - this.lastActivityTime

    // Check if user is logged in
    const { currentIdentity } = useAuthStore.getState()
    if (!currentIdentity) {
      // No user logged in - don't lock
      return
    }

    // Check if should show warning
    const timeUntilLock = this.config.inactivityTimeoutMs - inactiveDuration
    if (timeUntilLock <= this.config.warningTimeMs && timeUntilLock > 0 && !this.warningShown) {
      this.showWarning()
      this.warningShown = true
      return
    }

    // Check if should lock
    if (inactiveDuration >= this.config.inactivityTimeoutMs) {
      this.lock()
    }
  }

  /**
   * Show warning before lock
   */
  private showWarning() {
    if (this.onWarning) {
      this.onWarning()
    }

    console.warn('⚠️ Session will lock due to inactivity', {
      timeRemaining: `${this.config.warningTimeMs / 1000} seconds`,
    })
  }

  /**
   * Lock the session
   */
  private lock() {
    const { currentIdentity, logout } = useAuthStore.getState()

    if (!currentIdentity) return

    console.log('🔒 Session locked due to inactivity')

    // Clear sensitive data from memory
    logout()

    // Trigger custom lock handler
    if (this.onLock) {
      this.onLock()
    }

    // Reset warning state
    this.warningShown = false

    // Record activity to prevent immediate re-lock
    this.recordActivity()
  }

  /**
   * Handle visibility change (tab switching)
   */
  private handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab hidden - don't update activity (continue countdown)
      return
    } else {
      // Tab visible - record activity
      this.recordActivity()
      this.warningShown = false
    }
  }

  /**
   * Manually lock the session
   */
  lockNow() {
    this.lock()
  }

  /**
   * Set custom warning handler
   */
  setOnWarning(handler: () => void) {
    this.onWarning = handler
  }

  /**
   * Set custom lock handler
   */
  setOnLock(handler: () => void) {
    this.onLock = handler
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SessionConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get time until lock (ms)
   */
  getTimeUntilLock(): number {
    const now = Date.now()
    const inactiveDuration = now - this.lastActivityTime
    const timeRemaining = this.config.inactivityTimeoutMs - inactiveDuration
    return Math.max(0, timeRemaining)
  }

  /**
   * Get if warning should be shown
   */
  shouldShowWarning(): boolean {
    return this.getTimeUntilLock() <= this.config.warningTimeMs && this.getTimeUntilLock() > 0
  }

  /**
   * Extend session (reset inactivity timer)
   */
  extendSession() {
    this.recordActivity()
    this.warningShown = false
  }
}

// Singleton instance
export const sessionManager = new SessionManager()

/**
 * React hook for session timeout
 */
export function useSessionTimeout() {
  const lockNow = () => sessionManager.lockNow()
  const extendSession = () => sessionManager.extendSession()
  const getTimeUntilLock = () => sessionManager.getTimeUntilLock()
  const shouldShowWarning = () => sessionManager.shouldShowWarning()

  return {
    lockNow,
    extendSession,
    getTimeUntilLock,
    shouldShowWarning,
  }
}

// Auto-initialize on module load (can be configured via environment)
// @ts-ignore - import.meta.env is injected by Vite
const autoLockEnabled = (import.meta.env?.VITE_AUTO_LOCK_ENABLED ?? 'true') !== 'false' // Default: enabled
// @ts-ignore - import.meta.env is injected by Vite
const autoLockTimeout = parseInt(import.meta.env?.VITE_AUTO_LOCK_TIMEOUT ?? '1800000') // Default: 30 minutes

if (autoLockEnabled && typeof window !== 'undefined') {
  sessionManager.init({
    inactivityTimeoutMs: autoLockTimeout,
  })
}
