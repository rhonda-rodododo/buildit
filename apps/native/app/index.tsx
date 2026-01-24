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
import { useThemeColors } from '../src/theme'
import { LanguagePicker, ThemeToggle } from '../src/components'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const colors = useThemeColors()
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
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.logo, { color: colors.foreground }]}>{t('app.name')}</Text>
      </View>
    )
  }

  // User logged in - will redirect (show nothing to prevent flash)
  if (identity) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.logo, { color: colors.foreground }]}>{t('app.name')}</Text>
      </View>
    )
  }

  // User not logged in - show onboarding
  return (
    <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
      {/* Top right controls */}
      <View style={[styles.topControls, { top: insets.top + spacing[2] }]}>
        <ThemeToggle variant="compact" />
        <LanguagePicker variant="compact" />
      </View>

      <View style={styles.onboardContent}>
        <Text style={[styles.logo, { color: colors.foreground }]}>{t('app.name')}</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          {t('app.tagline')}
        </Text>

        <View style={styles.buttonGroup}>
          <Link href="/login" asChild>
            <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                {t('auth.createIdentity')}
              </Text>
            </Pressable>
          </Link>

          <Link href="/import" asChild>
            <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                {t('auth.importKey')}
              </Text>
            </Pressable>
          </Link>
        </View>

        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
          {t('auth.login.securityNote')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing[6],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topControls: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 10,
    flexDirection: 'row',
    gap: spacing[2],
  },
  onboardContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logo: {
    fontSize: fontSize['4xl'],
    fontWeight: String(fontWeight.bold) as '700',
    marginBottom: spacing[2],
  },
  tagline: {
    fontSize: fontSize.lg,
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
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
  },
  footnote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
})
