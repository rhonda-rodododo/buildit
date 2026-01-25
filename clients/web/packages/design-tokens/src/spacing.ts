/**
 * @buildit/design-tokens - Spacing
 *
 * Platform-agnostic spacing scale and layout values.
 *
 * Values are in logical pixels - work the same on web (px) and native.
 */

/**
 * Base spacing unit (4px)
 */
export const SPACING_UNIT = 4

/**
 * Spacing scale (Tailwind-compatible names)
 */
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
} as const

/**
 * Semantic spacing
 */
export const semanticSpacing = {
  /** Minimum touch target size (WCAG/Apple HIG) */
  touchTarget: 44,

  /** Page padding (mobile) */
  pagePaddingMobile: 16,

  /** Page padding (desktop) */
  pagePaddingDesktop: 24,

  /** Card padding */
  cardPadding: 16,

  /** Section gap */
  sectionGap: 32,

  /** List item gap */
  listItemGap: 8,

  /** Icon gap (space between icon and text) */
  iconGap: 8,

  /** Button padding X */
  buttonPaddingX: 16,

  /** Button padding Y */
  buttonPaddingY: 8,

  /** Input padding X */
  inputPaddingX: 12,

  /** Input padding Y */
  inputPaddingY: 8,
} as const

/**
 * Border radius values
 */
export const radius = {
  none: 0,
  sm: 6, // --radius - 4px
  md: 8, // --radius - 2px
  DEFAULT: 10, // --radius (0.625rem)
  lg: 10, // --radius
  xl: 14, // --radius + 4px
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const

/**
 * Z-index scale
 */
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const

export type SpacingKey = keyof typeof spacing
export type RadiusKey = keyof typeof radius
