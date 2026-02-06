/**
 * Accessibility Testing Setup
 *
 * Configures axe-core for automated WCAG 2.1 AA compliance testing.
 * Provides helper functions for component and page-level accessibility assertions.
 *
 * Epic 82: Comprehensive Test Coverage
 */

import type { RenderResult } from '@testing-library/react'

/**
 * WCAG 2.1 AA rules configuration for axe-core.
 * These are the accessibility rules we enforce across all BuildIt components.
 */
export const axeConfig = {
  rules: {
    // WCAG 2.1 Level AA rules
    'color-contrast': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-hidden-body': { enabled: true },
    'aria-hidden-focus': { enabled: true },
    'aria-input-field-name': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'button-name': { enabled: true },
    'document-title': { enabled: true },
    'duplicate-id-aria': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'heading-order': { enabled: true },
    'html-has-lang': { enabled: true },
    'image-alt': { enabled: true },
    'input-button-name': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'meta-viewport': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'tabindex': { enabled: true },
    // Disable rules that don't apply to SPA
    'bypass': { enabled: false }, // Skip navigation links not needed in SPA
    'region': { enabled: false }, // SPA landmarks handled differently
  },
}

/**
 * Common accessibility violations that should never appear in BuildIt.
 * These represent critical issues that would make the app unusable
 * for users who depend on assistive technology.
 */
export const criticalViolations = [
  'aria-hidden-focus', // Focusable element hidden from assistive tech
  'button-name', // Button without accessible name
  'image-alt', // Image without alt text
  'label', // Form input without label
  'link-name', // Link without accessible name
  'color-contrast', // Insufficient color contrast
]

/**
 * Checks if an element has proper focus indicators.
 * Focus indicators are essential for keyboard navigation.
 */
export function hasFocusIndicator(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const focusStyle = window.getComputedStyle(element, ':focus')

  // Check for outline, box-shadow, or border changes on focus
  const hasOutline =
    focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px'
  const hasBoxShadow = focusStyle.boxShadow !== 'none'
  const hasBorderChange =
    focusStyle.borderColor !== computedStyle.borderColor ||
    focusStyle.borderWidth !== computedStyle.borderWidth

  return hasOutline || hasBoxShadow || hasBorderChange
}

/**
 * Gets all focusable elements within a container.
 * Useful for verifying keyboard navigation order.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ')

  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}

/**
 * Verifies that all interactive elements within a container
 * have accessible names (via aria-label, aria-labelledby, or text content).
 */
export function getAllInteractiveElementsWithoutNames(
  container: HTMLElement
): HTMLElement[] {
  const interactiveSelector = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="switch"]',
  ].join(', ')

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(interactiveSelector)
  )

  return elements.filter((el) => {
    const ariaLabel = el.getAttribute('aria-label')
    const ariaLabelledBy = el.getAttribute('aria-labelledby')
    const textContent = el.textContent?.trim()
    const title = el.getAttribute('title')
    const alt = el.getAttribute('alt')

    // Check for associated label element (for form controls)
    const id = el.getAttribute('id')
    const hasAssociatedLabel = id
      ? container.querySelector(`label[for="${id}"]`) !== null
      : false

    return (
      !ariaLabel &&
      !ariaLabelledBy &&
      !textContent &&
      !title &&
      !alt &&
      !hasAssociatedLabel
    )
  })
}

/**
 * Verifies heading level hierarchy within a container.
 * Headings must not skip levels (e.g., h1 -> h3 without h2).
 */
export function getHeadingHierarchyViolations(
  container: HTMLElement
): string[] {
  const headings = Array.from(
    container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  )
  const violations: string[] = []
  let previousLevel = 0

  for (const heading of headings) {
    const level = parseInt(heading.tagName.charAt(1))

    if (previousLevel > 0 && level > previousLevel + 1) {
      violations.push(
        `Heading level skipped: <${heading.tagName.toLowerCase()}> after <h${previousLevel}>. ` +
          `Content: "${heading.textContent?.trim().substring(0, 50)}"`
      )
    }

    previousLevel = level
  }

  return violations
}

/**
 * Verifies that all images have alt attributes.
 * Returns images that are missing alt text.
 */
export function getImagesWithoutAlt(container: HTMLElement): HTMLImageElement[] {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
  return images.filter((img) => {
    const alt = img.getAttribute('alt')
    // alt="" is valid for decorative images
    return alt === null
  })
}

/**
 * Checks color contrast ratio between foreground and background.
 * WCAG 2.1 AA requires:
 * - Normal text: 4.5:1
 * - Large text (18pt or 14pt bold): 3:1
 */
export function getContrastRatio(
  foreground: string,
  background: string
): number {
  const fgLuminance = getRelativeLuminance(parseColor(foreground))
  const bgLuminance = getRelativeLuminance(parseColor(background))

  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Checks if a contrast ratio meets WCAG 2.1 AA requirements.
 */
export function meetsContrastRequirement(
  ratio: number,
  isLargeText: boolean
): boolean {
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5
}

// ============== Internal Helpers ==============

function parseColor(color: string): [number, number, number] {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return [r, g, b]
  }

  // Handle rgb/rgba colors
  const match = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
  )
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
  }

  // Default to black
  return [0, 0, 0]
}

function getRelativeLuminance([r, g, b]: [
  number,
  number,
  number,
]): number {
  const [sR, sG, sB] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB
}
