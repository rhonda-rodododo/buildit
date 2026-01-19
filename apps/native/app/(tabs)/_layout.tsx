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
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

interface TabItemProps {
  label: string
  icon: string
  href: string
  isActive: boolean
  onPress: () => void
}

function TabItem({ label, icon, isActive, onPress }: TabItemProps) {
  return (
    <Pressable style={styles.tabItem} onPress={onPress}>
      <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  )
}

export default function TabsLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  const tabs = [
    { label: 'Home', icon: '🏠', href: '/(tabs)/home' },
    { label: 'Messages', icon: '💬', href: '/(tabs)/messages' },
    { label: 'Groups', icon: '👥', href: '/(tabs)/groups' },
    { label: 'Settings', icon: '⚙️', href: '/(tabs)/settings' },
  ]

  const getIsActive = (href: string) => {
    const normalizedHref = href.replace('/(tabs)', '')
    return pathname === normalizedHref || pathname.startsWith(normalizedHref + '/')
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.href}
            label={tab.label}
            icon={tab.icon}
            href={tab.href}
            isActive={getIsActive(tab.href)}
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
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
  },
  tabLabelActive: {
    color: '#0a0a0a',
    fontWeight: String(fontWeight.medium) as '500',
  },
})
