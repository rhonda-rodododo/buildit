/**
 * @buildit/design-tokens - Typography
 *
 * Platform-agnostic typography scale.
 *
 * Font sizes use a modular scale (1.25 ratio).
 * Line heights are optimized for readability.
 */

/**
 * Font family stacks
 */
export const fontFamily = {
  sans: [
    'Inter',
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
  mono: [
    'JetBrains Mono',
    'ui-monospace',
    'SFMono-Regular',
    'SF Mono',
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace',
  ],
} as const

/**
 * Font size scale (in pixels)
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
} as const

/**
 * Line height scale
 */
export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const

/**
 * Font weight scale
 */
export const fontWeight = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const

/**
 * Letter spacing scale (in pixels)
 */
export const letterSpacing = {
  tighter: -0.8,
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
  widest: 1.6,
} as const

/**
 * Pre-composed text styles
 *
 * Ready-to-use typography combinations for common use cases.
 */
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSize['4xl'],
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight.snug,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  h4: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.snug,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },

  // Body text
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodyLarge: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.relaxed,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },

  // UI text
  label: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  button: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },

  // Code
  code: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.relaxed,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const

export type FontSizeKey = keyof typeof fontSize
export type FontWeightKey = keyof typeof fontWeight
export type TextStyleKey = keyof typeof textStyles
