/**
 * Home Screen / Onboarding
 *
 * Entry point - shows onboarding if not logged in.
 * Logged in users are redirected to the tabs view.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Link, useRouter } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/stores'
import { useTranslation } from '../src/i18n'
import { LanguagePicker } from '../src/components'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const { identity, isInitialized } = useAuthStore()

  // Redirect to tabs when logged in
  useEffect(() => {
    if (isInitialized && identity) {
      (router.replace as (href: string) => void)('/(tabs)/home')
    }
  }, [isInitialized, identity, router])

  // Show loading while checking auth
  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.logo}>{t('app.name')}</Text>
      </View>
    )
  }

  // User logged in - will redirect (show nothing to prevent flash)
  if (identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.logo}>{t('app.name')}</Text>
      </View>
    )
  }

  // User not logged in - show onboarding
  return (
    <View style={[styles.container, styles.centered]}>
      {/* Language picker in top right */}
      <View style={[styles.languagePickerContainer, { top: insets.top + spacing[2] }]}>
        <LanguagePicker variant="compact" />
      </View>

      <View style={styles.onboardContent}>
        <Text style={styles.logo}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>

        <View style={styles.buttonGroup}>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('auth.createIdentity')}</Text>
            </Pressable>
          </Link>

          <Link href="/import" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t('auth.importKey')}</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={styles.footnote}>
          {t('auth.login.securityNote')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: spacing[6],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  languagePickerContainer: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 10,
  },
  onboardContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logo: {
    fontSize: fontSize['4xl'],
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  tagline: {
    fontSize: fontSize.lg,
    color: '#737373',
    textAlign: 'center',
    marginBottom: spacing[10],
    lineHeight: 26,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fafafa',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0a0a0a',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
  },
  footnote: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    textAlign: 'center',
  },
})
