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
import i18n, { initializeI18n } from '../src/i18n'

export default function RootLayout() {
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

  // Show loading while i18n initializes
  if (!isI18nReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0a0a0a" />
      </View>
    )
  }

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
})
