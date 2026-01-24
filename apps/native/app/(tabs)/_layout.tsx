/**
 * Tab Navigation Layout
 *
 * Bottom tab bar navigation for the main app screens:
 * - Home (dashboard)
 * - Messages (DMs)
 * - Groups
 * - Settings
 */

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Slot, useRouter, usePathname } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeColors } from '../../src/theme'
import { useTranslation } from '../../src/i18n'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

interface TabItemProps {
  label: string
  icon: string
  href: string
  isActive: boolean
  onPress: () => void
  activeColor: string
  inactiveColor: string
}

function TabItem({ label, icon, isActive, onPress, activeColor, inactiveColor }: TabItemProps) {
  return (
    <Pressable style={styles.tabItem} onPress={onPress}>
      <Text style={[styles.tabIcon, { opacity: isActive ? 1 : 0.5 }]}>{icon}</Text>
      <Text
        style={[
          styles.tabLabel,
          { color: isActive ? activeColor : inactiveColor },
          isActive && styles.tabLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default function TabsLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const { t } = useTranslation()

  const tabs = [
    { label: t('nav.feed'), icon: '🏠', href: '/(tabs)/home' },
    { label: t('nav.messages'), icon: '💬', href: '/(tabs)/messages' },
    { label: t('nav.groups'), icon: '👥', href: '/(tabs)/groups' },
    { label: t('nav.settings'), icon: '⚙️', href: '/(tabs)/settings' },
  ]

  const getIsActive = (href: string) => {
    const normalizedHref = href.replace('/(tabs)', '')
    return pathname === normalizedHref || pathname.startsWith(normalizedHref + '/')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing[2]),
          },
        ]}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.href}
            label={tab.label}
            icon={tab.icon}
            href={tab.href}
            isActive={getIsActive(tab.href)}
            activeColor={colors.foreground}
            inactiveColor={colors.mutedForeground}
            onPress={() => (router.push as (href: string) => void)(tab.href)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: spacing[2],
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: fontSize.xs,
  },
  tabLabelActive: {
    fontWeight: String(fontWeight.medium) as '500',
  },
})
