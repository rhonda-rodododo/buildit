/**
 * @buildit/design-tokens - Colors
 *
 * Platform-agnostic color definitions.
 *
 * Web: Use CSS variables (--background, --primary, etc.)
 * Native: Use these values directly with color conversion
 *
 * Colors are defined in OKLCH for perceptual uniformity.
 * Native apps should convert to RGB/HEX as needed.
 */

/**
 * OKLCH color value
 */
export interface OklchColor {
  l: number // Lightness (0-1)
  c: number // Chroma (0-0.4 typical)
  h: number // Hue (0-360)
  a?: number // Alpha (0-1)
}

/**
 * Convert OKLCH to CSS string
 */
export function oklchToCss(color: OklchColor): string {
  if (color.a !== undefined && color.a < 1) {
    return `oklch(${color.l} ${color.c} ${color.h} / ${color.a * 100}%)`
  }
  return `oklch(${color.l} ${color.c} ${color.h})`
}

/**
 * Semantic color tokens - Light theme
 */
export const lightColors = {
  background: { l: 1, c: 0, h: 0 },
  foreground: { l: 0.145, c: 0, h: 0 },
  card: { l: 1, c: 0, h: 0 },
  cardForeground: { l: 0.145, c: 0, h: 0 },
  popover: { l: 1, c: 0, h: 0 },
  popoverForeground: { l: 0.145, c: 0, h: 0 },
  primary: { l: 0.205, c: 0, h: 0 },
  primaryForeground: { l: 0.985, c: 0, h: 0 },
  secondary: { l: 0.97, c: 0, h: 0 },
  secondaryForeground: { l: 0.205, c: 0, h: 0 },
  muted: { l: 0.97, c: 0, h: 0 },
  mutedForeground: { l: 0.46, c: 0, h: 0 },
  accent: { l: 0.97, c: 0, h: 0 },
  accentForeground: { l: 0.205, c: 0, h: 0 },
  destructive: { l: 0.577, c: 0.245, h: 27.325 },
  border: { l: 0.922, c: 0, h: 0 },
  input: { l: 0.922, c: 0, h: 0 },
  ring: { l: 0.708, c: 0, h: 0 },
} as const satisfies Record<string, OklchColor>

/**
 * Semantic color tokens - Dark theme
 */
export const darkColors = {
  background: { l: 0.145, c: 0, h: 0 },
  foreground: { l: 0.985, c: 0, h: 0 },
  card: { l: 0.205, c: 0, h: 0 },
  cardForeground: { l: 0.985, c: 0, h: 0 },
  popover: { l: 0.205, c: 0, h: 0 },
  popoverForeground: { l: 0.985, c: 0, h: 0 },
  primary: { l: 0.922, c: 0, h: 0 },
  primaryForeground: { l: 0.205, c: 0, h: 0 },
  secondary: { l: 0.269, c: 0, h: 0 },
  secondaryForeground: { l: 0.985, c: 0, h: 0 },
  muted: { l: 0.269, c: 0, h: 0 },
  mutedForeground: { l: 0.708, c: 0, h: 0 },
  accent: { l: 0.269, c: 0, h: 0 },
  accentForeground: { l: 0.985, c: 0, h: 0 },
  destructive: { l: 0.704, c: 0.191, h: 22.216 },
  border: { l: 1, c: 0, h: 0, a: 0.1 },
  input: { l: 1, c: 0, h: 0, a: 0.15 },
  ring: { l: 0.556, c: 0, h: 0 },
} as const satisfies Record<string, OklchColor>

/**
 * Chart colors (for data visualization)
 */
export const chartColors = {
  light: {
    chart1: { l: 0.646, c: 0.222, h: 41.116 },
    chart2: { l: 0.6, c: 0.118, h: 184.704 },
    chart3: { l: 0.398, c: 0.07, h: 227.392 },
    chart4: { l: 0.828, c: 0.189, h: 84.429 },
    chart5: { l: 0.769, c: 0.188, h: 70.08 },
  },
  dark: {
    chart1: { l: 0.488, c: 0.243, h: 264.376 },
    chart2: { l: 0.696, c: 0.17, h: 162.48 },
    chart3: { l: 0.769, c: 0.188, h: 70.08 },
    chart4: { l: 0.627, c: 0.265, h: 303.9 },
    chart5: { l: 0.645, c: 0.246, h: 16.439 },
  },
} as const

/**
 * Theme accent colors (for theme selection)
 */
export const accentThemes = {
  default: { l: 0.205, c: 0, h: 0 },
  blue: { l: 0.546, c: 0.245, h: 262.881 },
  green: { l: 0.696, c: 0.17, h: 162.48 },
  red: { l: 0.577, c: 0.245, h: 27.325 },
  rose: { l: 0.645, c: 0.246, h: 16.439 },
  violet: { l: 0.606, c: 0.25, h: 292.717 },
  yellow: { l: 0.795, c: 0.184, h: 86.047 },
} as const

export type ColorToken = keyof typeof lightColors
export type ThemeName = keyof typeof accentThemes
