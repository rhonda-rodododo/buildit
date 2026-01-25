/**
 * Auth Provider
 *
 * Initializes the auth store on app load and provides loading state.
 */

import { useEffect, type ReactNode } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { spacing, fontSize } from '@buildit/design-tokens'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isInitialized, isLoading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Show loading screen while initializing
  if (!isInitialized || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0a0a0a" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    )
  }

  return <>{children}</>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    gap: spacing[4],
  },
  text: {
    fontSize: fontSize.base,
    color: '#737373',
  },
})
