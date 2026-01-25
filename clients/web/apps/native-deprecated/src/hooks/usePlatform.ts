/**
 * Platform-specific React hooks
 *
 * Provides hooks for:
 * - Keyboard visibility
 * - Screen dimensions
 * - App state
 * - Network status
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Keyboard,
  Dimensions,
  AppState,
  type AppStateStatus,
  type ScaledSize,
} from 'react-native'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { platform } from '../utils/platform'

/**
 * Hook to detect keyboard visibility and height
 */
export function useKeyboard(): {
  keyboardVisible: boolean
  keyboardHeight: number
} {
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showEvent = platform.isIOS ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = platform.isIOS ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true)
      setKeyboardHeight(e.endCoordinates.height)
    })

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false)
      setKeyboardHeight(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  return { keyboardVisible, keyboardHeight }
}

/**
 * Hook to get screen dimensions and orientation
 */
export function useDimensions(): {
  width: number
  height: number
  isLandscape: boolean
  isPortrait: boolean
  scale: number
} {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height, scale } = Dimensions.get('window')
    return { width, height, scale }
  })

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
        scale: window.scale,
      })
    })

    return () => subscription.remove()
  }, [])

  return {
    ...dimensions,
    isLandscape: dimensions.width > dimensions.height,
    isPortrait: dimensions.height >= dimensions.width,
  }
}

/**
 * Hook to track app state (active, background, inactive)
 */
export function useAppState(): {
  appState: AppStateStatus
  isActive: boolean
  isBackground: boolean
  lastBackgroundTime: number | null
} {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const [lastBackgroundTime, setLastBackgroundTime] = useState<number | null>(null)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        setLastBackgroundTime(Date.now())
      }
      setAppState(nextAppState)
    })

    return () => subscription.remove()
  }, [appState])

  return {
    appState,
    isActive: appState === 'active',
    isBackground: appState === 'background',
    lastBackgroundTime,
  }
}

/**
 * Hook to track network connectivity
 */
export function useNetworkStatus(): {
  isConnected: boolean
  isInternetReachable: boolean | null
  connectionType: string | null
  isWifi: boolean
  isCellular: boolean
} {
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null)

  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then(setNetworkState)

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(setNetworkState)

    return () => unsubscribe()
  }, [])

  return {
    isConnected: networkState?.isConnected ?? false,
    isInternetReachable: networkState?.isInternetReachable ?? null,
    connectionType: networkState?.type ?? null,
    isWifi: networkState?.type === 'wifi',
    isCellular: networkState?.type === 'cellular',
  }
}

/**
 * Hook to detect if app was opened from background
 * with a timeout threshold
 */
export function useBackgroundTimeout(
  timeoutMs: number,
  onTimeout: () => void
): void {
  const { isActive, lastBackgroundTime } = useAppState()

  useEffect(() => {
    if (isActive && lastBackgroundTime) {
      const timeSinceBackground = Date.now() - lastBackgroundTime
      if (timeSinceBackground >= timeoutMs) {
        onTimeout()
      }
    }
  }, [isActive, lastBackgroundTime, timeoutMs, onTimeout])
}

/**
 * Hook for responsive breakpoints
 */
export function useResponsive(): {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  breakpoint: 'sm' | 'md' | 'lg' | 'xl'
} {
  const { width } = useDimensions()

  const breakpoint =
    width < 640 ? 'sm' : width < 768 ? 'md' : width < 1024 ? 'lg' : 'xl'

  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    breakpoint,
  }
}

/**
 * Hook to dismiss keyboard on tap outside
 */
export function useDismissKeyboard(): () => void {
  return useCallback(() => {
    Keyboard.dismiss()
  }, [])
}
