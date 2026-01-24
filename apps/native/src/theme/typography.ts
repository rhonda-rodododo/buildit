/**
 * Typography Utilities for React Native
 *
 * Converts design-tokens typography to React Native TextStyle objects.
 * Provides pre-composed text styles for consistent typography.
 */

import { StyleSheet, Platform, type TextStyle } from 'react-native'
import {
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  fontFamily,
  textStyles as tokenTextStyles,
} from '@buildit/design-tokens'

/**
 * Get the appropriate font family for the platform
 */
export function getFontFamily(variant: 'sans' | 'mono' = 'sans'): string {
  // Cast to readonly string array to work with .includes() and .join()
  const families = fontFamily[variant] as readonly string[]

  // On iOS/Android, use system font or Inter if available
  if (Platform.OS === 'ios') {
    return families.includes('Inter') ? 'Inter' : 'System'
  }
  if (Platform.OS === 'android') {
    return families.includes('Inter') ? 'Inter' : 'Roboto'
  }
  // On web, use the full stack
  return families.join(', ')
}

/**
 * Convert token text style to React Native TextStyle
 */
function toTextStyle(style: {
  fontSize: number
  lineHeight: number
  fontWeight: number
  letterSpacing: number
}): TextStyle {
  return {
    fontSize: style.fontSize,
    lineHeight: style.fontSize * style.lineHeight,
    fontWeight: String(style.fontWeight) as TextStyle['fontWeight'],
    letterSpacing: style.letterSpacing,
  }
}

/**
 * Pre-composed text styles for React Native
 * Ready to use with Text components
 */
export const textStyles = StyleSheet.create({
  // Headings
  h1: toTextStyle(tokenTextStyles.h1),
  h2: toTextStyle(tokenTextStyles.h2),
  h3: toTextStyle(tokenTextStyles.h3),
  h4: toTextStyle(tokenTextStyles.h4),

  // Body text
  body: toTextStyle(tokenTextStyles.body),
  bodySmall: toTextStyle(tokenTextStyles.bodySmall),
  bodyLarge: toTextStyle(tokenTextStyles.bodyLarge),

  // UI text
  label: toTextStyle(tokenTextStyles.label),
  caption: toTextStyle(tokenTextStyles.caption),
  button: toTextStyle(tokenTextStyles.button),

  // Code
  code: {
    ...toTextStyle(tokenTextStyles.code),
    fontFamily: getFontFamily('mono'),
  },
})

// Re-export raw values for custom combinations
export { fontSize, lineHeight, fontWeight, letterSpacing, fontFamily }
