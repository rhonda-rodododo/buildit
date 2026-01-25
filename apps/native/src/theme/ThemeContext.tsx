/**
 * Theme Context for React Native
 *
 * Provides dark/light theme support using design tokens.
 * Persists theme preference using SecureStorage.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'
import { lightTheme, darkTheme, type ThemeColors } from './colors'
import { getSecureItem, setSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  /** Current resolved theme (light or dark) */
  theme: 'light' | 'dark'
  /** Current theme mode setting */
  mode: ThemeMode
  /** Theme colors */
  colors: ThemeColors
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void
  /** Toggle between light and dark */
  toggle: () => void
  /** Whether theme has been loaded from storage */
  isLoaded: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')
  // Start as loaded immediately - load preferences in background
  const [isLoaded, setIsLoaded] = useState(true)

  // Determine actual theme based on mode
  const resolvedTheme: 'light' | 'dark' =
    mode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : mode

  const colors = resolvedTheme === 'dark' ? darkTheme : lightTheme

  // Load saved theme preference in background
  useEffect(() => {
    let mounted = true

    async function loadTheme() {
      try {
        const saved = await getSecureItem(STORAGE_KEYS.THEME)
        if (mounted && saved && ['light', 'dark', 'system'].includes(saved)) {
          setModeState(saved as ThemeMode)
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error)
      }
    }
    loadTheme()

    return () => { mounted = false }
  }, [])

  // Save theme preference when it changes
  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode)
    try {
      await setSecureItem(STORAGE_KEYS.THEME, newMode)
    } catch (error) {
      console.warn('Failed to save theme preference:', error)
    }
  }, [])

  // Toggle between light and dark
  const toggle = useCallback(() => {
    const newMode = resolvedTheme === 'dark' ? 'light' : 'dark'
    setMode(newMode)
  }, [resolvedTheme, setMode])

  const value: ThemeContextValue = {
    theme: resolvedTheme,
    mode,
    colors,
    setMode,
    toggle,
    isLoaded,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Hook to access just the theme colors
 */
export function useThemeColors(): ThemeColors {
  const { colors } = useTheme()
  return colors
}
