/**
 * Platform-specific utilities for iOS and Android
 *
 * Provides cross-platform abstractions for:
 * - Haptic feedback
 * - Platform detection
 * - Safe area handling
 * - Keyboard behavior
 */

import { Platform, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'

/**
 * Platform detection utilities
 */
export const platform = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
  version: Platform.Version,

  /**
   * Run platform-specific code
   */
  select: Platform.select,
}

/**
 * Haptic feedback utilities
 *
 * iOS: Uses native haptic engine
 * Android: Uses vibration patterns
 */
export const haptics = {
  /**
   * Light impact feedback (for selections, toggles)
   */
  async light(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } else if (platform.isAndroid) {
      Vibration.vibrate(10)
    }
  },

  /**
   * Medium impact feedback (for confirmations)
   */
  async medium(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } else if (platform.isAndroid) {
      Vibration.vibrate(20)
    }
  },

  /**
   * Heavy impact feedback (for errors, important actions)
   */
  async heavy(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    } else if (platform.isAndroid) {
      Vibration.vibrate(30)
    }
  },

  /**
   * Selection change feedback
   */
  async selection(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.selectionAsync()
    } else if (platform.isAndroid) {
      Vibration.vibrate(5)
    }
  },

  /**
   * Success notification feedback
   */
  async success(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else if (platform.isAndroid) {
      Vibration.vibrate([0, 50, 100, 50])
    }
  },

  /**
   * Warning notification feedback
   */
  async warning(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    } else if (platform.isAndroid) {
      Vibration.vibrate([0, 100, 50, 100])
    }
  },

  /**
   * Error notification feedback
   */
  async error(): Promise<void> {
    if (platform.isIOS) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } else if (platform.isAndroid) {
      Vibration.vibrate([0, 100, 100, 100, 100, 100])
    }
  },
}

/**
 * Platform-specific styling constants
 */
export const platformStyles = {
  /**
   * Default shadow style
   */
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),

  /**
   * Card shadow
   */
  cardShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),

  /**
   * Header height including status bar
   */
  headerHeight: Platform.select({
    ios: 44,
    android: 56,
    default: 56,
  }),

  /**
   * Tab bar height
   */
  tabBarHeight: Platform.select({
    ios: 49,
    android: 56,
    default: 56,
  }),

  /**
   * Border radius for buttons
   */
  buttonRadius: Platform.select({
    ios: 8,
    android: 4,
    default: 8,
  }),

  /**
   * Border radius for cards
   */
  cardRadius: Platform.select({
    ios: 12,
    android: 8,
    default: 12,
  }),

  /**
   * Font family
   */
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),

  /**
   * Monospace font family
   */
  monoFontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
}

/**
 * Keyboard behavior settings
 */
export const keyboardSettings = {
  /**
   * Keyboard avoiding view behavior
   */
  behavior: Platform.select<'padding' | 'height' | 'position'>({
    ios: 'padding',
    android: 'height',
    default: 'padding',
  }),

  /**
   * Keyboard vertical offset (for headers)
   */
  verticalOffset: Platform.select({
    ios: 0,
    android: 0,
    default: 0,
  }),

  /**
   * Return key type for form submission
   */
  returnKeyType: Platform.select<'done' | 'go' | 'next' | 'send'>({
    ios: 'done',
    android: 'go',
    default: 'done',
  }),
}

/**
 * Platform-specific animation durations
 */
export const animationDurations = {
  fast: Platform.select({
    ios: 200,
    android: 150,
    default: 200,
  }),

  normal: Platform.select({
    ios: 300,
    android: 225,
    default: 300,
  }),

  slow: Platform.select({
    ios: 450,
    android: 375,
    default: 450,
  }),
}

/**
 * Platform-specific hit slop for touch targets
 */
export const hitSlop = {
  small: { top: 8, right: 8, bottom: 8, left: 8 },
  medium: { top: 12, right: 12, bottom: 12, left: 12 },
  large: { top: 16, right: 16, bottom: 16, left: 16 },
}

/**
 * Minimum touch target size (accessibility)
 */
export const minTouchTarget = Platform.select({
  ios: 44,
  android: 48,
  default: 44,
})

/**
 * Check if running on a tablet
 */
export function isTablet(): boolean {
  // This is a simplified check - in production, use expo-device
  if (Platform.OS === 'ios') {
    return Platform.isPad ?? false
  }
  // Android tablet detection would need expo-device
  return false
}
