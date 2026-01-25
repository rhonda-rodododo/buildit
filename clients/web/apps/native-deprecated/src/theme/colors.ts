/**
 * Color Utilities for React Native
 *
 * Converts OKLCH colors from design tokens to RGB hex strings.
 * OKLCH provides perceptually uniform colors across themes.
 */

import { lightColors, darkColors, type OklchColor } from '@buildit/design-tokens'

/**
 * Convert OKLCH to linear sRGB
 * Based on CSS Color Level 4 spec
 */
function oklchToRgb(color: OklchColor): { r: number; g: number; b: number } {
  const { l, c, h, a } = color

  // Convert polar to rectangular
  const hRad = (h * Math.PI) / 180
  const a_ = c * Math.cos(hRad)
  const b_ = c * Math.sin(hRad)

  // OKLAB to linear sRGB matrix
  // First convert OKLAB to LMS
  const l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_
  const m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_
  const s_ = l - 0.0894841775 * a_ - 1.291485548 * b_

  // Cube the values
  const lCubed = l_ * l_ * l_
  const mCubed = m_ * m_ * m_
  const sCubed = s_ * s_ * s_

  // LMS to linear sRGB matrix
  const r = 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed
  const g = -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed
  const b = -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed

  // Convert linear sRGB to sRGB (gamma correction)
  const gammaCorrect = (x: number): number => {
    if (x <= 0.0031308) {
      return 12.92 * x
    }
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055
  }

  return {
    r: Math.round(Math.max(0, Math.min(1, gammaCorrect(r))) * 255),
    g: Math.round(Math.max(0, Math.min(1, gammaCorrect(g))) * 255),
    b: Math.round(Math.max(0, Math.min(1, gammaCorrect(b))) * 255),
  }
}

/**
 * Convert OKLCH color to hex string
 */
export function oklchToHex(color: OklchColor): string {
  const { r, g, b } = oklchToRgb(color)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Convert OKLCH color to rgba string (with alpha)
 */
export function oklchToRgba(color: OklchColor): string {
  const { r, g, b } = oklchToRgb(color)
  const a = color.a !== undefined ? color.a : 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * Pre-converted light theme colors for React Native
 */
export const lightTheme = {
  background: oklchToHex(lightColors.background),
  foreground: oklchToHex(lightColors.foreground),
  card: oklchToHex(lightColors.card),
  cardForeground: oklchToHex(lightColors.cardForeground),
  primary: oklchToHex(lightColors.primary),
  primaryForeground: oklchToHex(lightColors.primaryForeground),
  secondary: oklchToHex(lightColors.secondary),
  secondaryForeground: oklchToHex(lightColors.secondaryForeground),
  muted: oklchToHex(lightColors.muted),
  mutedForeground: oklchToHex(lightColors.mutedForeground),
  accent: oklchToHex(lightColors.accent),
  accentForeground: oklchToHex(lightColors.accentForeground),
  destructive: oklchToHex(lightColors.destructive),
  border: oklchToHex(lightColors.border),
  input: oklchToHex(lightColors.input),
  ring: oklchToHex(lightColors.ring),
} as const

/**
 * Pre-converted dark theme colors for React Native
 */
export const darkTheme = {
  background: oklchToHex(darkColors.background),
  foreground: oklchToHex(darkColors.foreground),
  card: oklchToHex(darkColors.card),
  cardForeground: oklchToHex(darkColors.cardForeground),
  primary: oklchToHex(darkColors.primary),
  primaryForeground: oklchToHex(darkColors.primaryForeground),
  secondary: oklchToRgba(darkColors.secondary),
  secondaryForeground: oklchToHex(darkColors.secondaryForeground),
  muted: oklchToHex(darkColors.muted),
  mutedForeground: oklchToHex(darkColors.mutedForeground),
  accent: oklchToHex(darkColors.accent),
  accentForeground: oklchToHex(darkColors.accentForeground),
  destructive: oklchToHex(darkColors.destructive),
  border: oklchToRgba(darkColors.border),
  input: oklchToRgba(darkColors.input),
  ring: oklchToHex(darkColors.ring),
} as const

export type ThemeColors = typeof lightTheme
