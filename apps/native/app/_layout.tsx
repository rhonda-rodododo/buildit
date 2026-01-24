/**
 * Root Layout for BuildIt Native App
 *
 * This wraps all routes in the app with providers and global styles.
 */

import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Slot } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from '../src/providers'
import { ThemeProvider, useTheme } from '../src/theme'
import i18n, { initializeI18n } from '../src/i18n'

function AppContent() {
  const { theme, colors, isLoaded } = useTheme()
  const [isI18nReady, setIsI18nReady] = useState(false)

  useEffect(() => {
    // Initialize i18n with saved language preference
    initializeI18n()
      .then(() => setIsI18nReady(true))
      .catch((error) => {
        console.error('Failed to initialize i18n:', error)
        setIsI18nReady(true) // Continue with default language
      })
  }, [])

  // Show loading while providers initialize
  if (!isI18nReady || !isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
