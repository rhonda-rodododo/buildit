/**
 * Language Picker Component
 *
 * Allows users to select their preferred language.
 * Displays native language names for better accessibility.
 */

import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Alert,
  Platform,
} from 'react-native'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import {
  useTranslation,
  languages,
  changeLanguage,
  getCurrentLanguage,
  isRTLRestartNeeded,
  type LanguageCode,
} from '../i18n'

interface LanguagePickerProps {
  variant?: 'full' | 'compact'
}

export function LanguagePicker({ variant = 'full' }: LanguagePickerProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const currentLanguage = getCurrentLanguage()

  const handleLanguageSelect = async (code: LanguageCode) => {
    setIsOpen(false)

    // Check if switching to/from RTL requires restart
    const currentIsRTL = currentLanguage.dir === 'rtl'
    const newLang = languages.find((l) => l.code === code)
    const newIsRTL = newLang?.dir === 'rtl'

    if (Platform.OS !== 'web' && currentIsRTL !== newIsRTL) {
      // Warn user that restart is needed for RTL change
      Alert.alert(
        'Restart Required',
        'Changing between left-to-right and right-to-left languages requires restarting the app. The language will change after you restart.',
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('common.continue'),
            onPress: async () => {
              await changeLanguage(code)
            },
          },
        ]
      )
      return
    }

    await changeLanguage(code)
  }

  const renderLanguageItem = ({
    item,
  }: {
    item: (typeof languages)[number]
  }) => {
    const isSelected = item.code === currentLanguage.code

    return (
      <Pressable
        style={[styles.languageItem, isSelected && styles.languageItemSelected]}
        onPress={() => handleLanguageSelect(item.code as LanguageCode)}
      >
        <View style={styles.languageInfo}>
          <Text style={[styles.languageName, isSelected && styles.languageNameSelected]}>
            {item.nativeName}
          </Text>
          <Text style={styles.languageEnglish}>{item.name}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
    )
  }

  if (variant === 'compact') {
    return (
      <Pressable style={styles.compactButton} onPress={() => setIsOpen(true)}>
        <Text style={styles.compactButtonText}>{currentLanguage.nativeName}</Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>
    )
  }

  return (
    <>
      <Pressable style={styles.pickerButton} onPress={() => setIsOpen(true)}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerLabel}>{t('common.language.switch')}</Text>
          <Text style={styles.pickerValue}>{currentLanguage.nativeName}</Text>
        </View>
        <Text style={styles.pickerArrow}>›</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('common.language.switch')}</Text>
            <Pressable style={styles.closeButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={languages}
            keyExtractor={(item) => item.code}
            renderItem={renderLanguageItem}
            contentContainerStyle={styles.languageList}
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
    borderBottomColor: '#f5f5f5',
  },
  pickerContent: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  pickerValue: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginTop: 2,
  },
  pickerArrow: {
    fontSize: fontSize.xl,
    color: '#a3a3a3',
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 8,
    gap: spacing[1],
  },
  compactButtonText: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  chevron: {
    fontSize: 8,
    color: '#737373',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.lg,
    color: '#737373',
  },
  languageList: {
    padding: spacing[4],
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[2],
    backgroundColor: '#fafafa',
  },
  languageItemSelected: {
    backgroundColor: '#0a0a0a',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  languageNameSelected: {
    color: '#ffffff',
  },
  languageEnglish: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  checkmark: {
    fontSize: fontSize.lg,
    color: '#ffffff',
    marginLeft: spacing[2],
  },
})
