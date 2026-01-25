/**
 * Theme Toggle Component
 *
 * Allows users to switch between light, dark, and system themes.
 */

import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from 'react-native'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useTheme, type ThemeMode } from '../theme'
import { useTranslation } from '../i18n'

const THEME_OPTIONS: { mode: ThemeMode; icon: string }[] = [
  { mode: 'light', icon: '☀️' },
  { mode: 'dark', icon: '🌙' },
  { mode: 'system', icon: '💻' },
]

interface ThemeToggleProps {
  variant?: 'full' | 'compact'
}

export function ThemeToggle({ variant = 'full' }: ThemeToggleProps) {
  const { t } = useTranslation()
  const { mode, setMode, colors } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const currentOption = THEME_OPTIONS.find((o) => o.mode === mode) || THEME_OPTIONS[2]

  const handleSelect = (newMode: ThemeMode) => {
    setMode(newMode)
    setIsOpen(false)
  }

  const getLabel = (themeMode: ThemeMode): string => {
    switch (themeMode) {
      case 'light':
        return t('common.theme.light')
      case 'dark':
        return t('common.theme.dark')
      case 'system':
        return t('common.theme.system')
    }
  }

  if (variant === 'compact') {
    return (
      <Pressable
        style={[styles.compactButton, { backgroundColor: colors.secondary }]}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.compactIcon}>{currentOption.icon}</Text>
      </Pressable>
    )
  }

  return (
    <>
      <Pressable
        style={[styles.pickerButton, { borderBottomColor: colors.border }]}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.pickerIcon}>{currentOption.icon}</Text>
        <View style={styles.pickerContent}>
          <Text style={[styles.pickerLabel, { color: colors.foreground }]}>
            {t('common.theme.toggle')}
          </Text>
          <Text style={[styles.pickerValue, { color: colors.mutedForeground }]}>
            {getLabel(mode)}
          </Text>
        </View>
        <Text style={[styles.pickerArrow, { color: colors.mutedForeground }]}>›</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('common.theme.toggle')}
            </Text>
            <Pressable style={styles.closeButton} onPress={() => setIsOpen(false)}>
              <Text style={[styles.closeButtonText, { color: colors.mutedForeground }]}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={THEME_OPTIONS}
            keyExtractor={(item) => item.mode}
            renderItem={({ item }) => {
              const isSelected = item.mode === mode
              return (
                <Pressable
                  style={[
                    styles.optionItem,
                    { backgroundColor: isSelected ? colors.primary : colors.secondary },
                  ]}
                  onPress={() => handleSelect(item.mode)}
                >
                  <Text style={styles.optionIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {getLabel(item.mode)}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.checkmark, { color: colors.primaryForeground }]}>✓</Text>
                  )}
                </Pressable>
              )
            }}
            contentContainerStyle={styles.optionList}
          />
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
  },
  pickerIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  pickerContent: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
  },
  pickerValue: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  pickerArrow: {
    fontSize: fontSize.xl,
  },
  compactButton: {
    padding: spacing[2],
    borderRadius: 8,
  },
  compactIcon: {
    fontSize: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.lg,
  },
  optionList: {
    padding: spacing[4],
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[2],
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  optionLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  checkmark: {
    fontSize: fontSize.lg,
  },
})
