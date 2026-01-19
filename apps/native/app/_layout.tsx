/**
 * Root Layout for BuildIt Native App
 *
 * This wraps all routes in the app with providers and global styles.
 */

import { Slot } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../src/providers'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
