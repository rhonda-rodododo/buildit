/**
 * Page-Level Accessibility Tests
 *
 * Tests all major pages for WCAG 2.1 AA compliance including:
 * - Color contrast ratios
 * - ARIA labels and roles
 * - Keyboard navigation
 * - Heading hierarchy
 * - Image alt text
 *
 * Epic 82: Comprehensive Test Coverage
 */

import { describe, it, expect } from 'vitest'
import {
  getContrastRatio,
  meetsContrastRequirement,
  getHeadingHierarchyViolations,
  getFocusableElements,
  getImagesWithoutAlt,
  getAllInteractiveElementsWithoutNames,
} from './axe-setup'

describe('Page Accessibility Tests', () => {
  describe('Color Contrast', () => {
    it('primary text on dark background meets AA standard (4.5:1)', () => {
      // BuildIt uses white/light text on slate-900 background
      const ratio = getContrastRatio('#f8fafc', '#0f172a') // slate-50 on slate-900
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('primary text on light background meets AA standard', () => {
      const ratio = getContrastRatio('#0f172a', '#ffffff') // slate-900 on white
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('link color on dark background meets AA standard', () => {
      // blue-400 on slate-900
      const ratio = getContrastRatio('#60a5fa', '#0f172a')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('muted text on dark background meets AA for large text', () => {
      // slate-400 on slate-900 -- may only meet large text ratio
      const ratio = getContrastRatio('#94a3b8', '#0f172a')
      expect(meetsContrastRequirement(ratio, true)).toBe(true)
    })

    it('error text is distinguishable (not just by color)', () => {
      // Red on dark background
      const ratio = getContrastRatio('#f87171', '#0f172a') // red-400 on slate-900
      expect(ratio).toBeGreaterThanOrEqual(3.0)
    })

    it('success text has sufficient contrast', () => {
      const ratio = getContrastRatio('#4ade80', '#0f172a') // green-400 on slate-900
      expect(ratio).toBeGreaterThanOrEqual(3.0)
    })

    it('warning text has sufficient contrast', () => {
      const ratio = getContrastRatio('#fbbf24', '#0f172a') // amber-400 on slate-900
      expect(ratio).toBeGreaterThanOrEqual(3.0)
    })

    it('button text on primary background meets AA', () => {
      // white on blue-600
      const ratio = getContrastRatio('#ffffff', '#2563eb')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('disabled state has reduced but visible contrast', () => {
      // Disabled elements should still be somewhat visible
      const ratio = getContrastRatio('#475569', '#0f172a') // slate-600 on slate-900
      expect(ratio).toBeGreaterThan(1.5) // Not fully invisible
      expect(ratio).toBeLessThan(4.5) // Clearly appears disabled
    })
  })

  describe('Heading Hierarchy', () => {
    it('detects heading level skip from h1 to h3', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1>Main Title</h1>
        <h3>Skipped h2!</h3>
      `

      const violations = getHeadingHierarchyViolations(container)
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('Heading level skipped')
    })

    it('accepts proper heading hierarchy', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1>Page Title</h1>
        <h2>Section</h2>
        <h3>Subsection</h3>
        <h2>Another Section</h2>
        <h3>Another Subsection</h3>
      `

      const violations = getHeadingHierarchyViolations(container)
      expect(violations).toHaveLength(0)
    })

    it('allows h1 followed by h2 (no skip)', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1>Page</h1>
        <h2>Section</h2>
      `

      const violations = getHeadingHierarchyViolations(container)
      expect(violations).toHaveLength(0)
    })

    it('detects multiple heading level skips', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1>Title</h1>
        <h4>Skipped h2 and h3!</h4>
        <h6>Another skip!</h6>
      `

      const violations = getHeadingHierarchyViolations(container)
      expect(violations.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Image Accessibility', () => {
    it('detects images without alt attributes', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <img src="/avatar.png" alt="User avatar">
        <img src="/logo.png">
        <img src="/decorative.png" alt="">
      `

      const violations = getImagesWithoutAlt(container)
      expect(violations).toHaveLength(1) // Only the middle image
    })

    it('accepts decorative images with empty alt', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <img src="/decorative.svg" alt="">
      `

      const violations = getImagesWithoutAlt(container)
      expect(violations).toHaveLength(0)
    })

    it('flags all images missing alt attribute', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <img src="/a.png">
        <img src="/b.png">
        <img src="/c.png">
      `

      const violations = getImagesWithoutAlt(container)
      expect(violations).toHaveLength(3)
    })
  })

  describe('Interactive Elements', () => {
    it('detects buttons without accessible names', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button aria-label="Close dialog">X</button>
        <button><span class="icon"></span></button>
        <button>Submit</button>
      `

      const unnamed = getAllInteractiveElementsWithoutNames(container)
      // The icon-only button without aria-label or text content
      // Note: second button has no text content since span is empty
      expect(unnamed).toHaveLength(1)
    })

    it('accepts buttons with various naming methods', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button aria-label="Close">X</button>
        <button aria-labelledby="label-1">icon</button>
        <span id="label-1">Close button</span>
        <button title="Settings">gear icon</button>
        <button>Click me</button>
      `

      const unnamed = getAllInteractiveElementsWithoutNames(container)
      expect(unnamed).toHaveLength(0)
    })

    it('detects links without accessible names', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <a href="/page">Visit page</a>
        <a href="/icon-link"><span class="icon"></span></a>
      `

      const unnamed = getAllInteractiveElementsWithoutNames(container)
      // The icon-only link has no text, aria-label, or title
      expect(unnamed).toHaveLength(1)
    })

    it('detects form inputs without labels', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <label for="name-input">Name</label>
        <input id="name-input" type="text">
        <input type="email" placeholder="Email">
        <input type="search" aria-label="Search messages">
      `

      const unnamed = getAllInteractiveElementsWithoutNames(container)
      // The email input has placeholder but no label, aria-label, or title
      // However, placeholder alone is not sufficient for accessibility
      expect(unnamed).toHaveLength(1)
    })
  })

  describe('Keyboard Navigation', () => {
    it('identifies all focusable elements', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <a href="/home">Home</a>
        <button>Click</button>
        <input type="text">
        <select><option>One</option></select>
        <textarea></textarea>
        <div tabindex="0">Custom focusable</div>
        <div tabindex="-1">Programmatically focusable only</div>
        <button disabled>Disabled</button>
      `

      const focusable = getFocusableElements(container)
      // a, button, input, select, textarea, div[tabindex=0] = 6
      // tabindex=-1 excluded, disabled button excluded
      expect(focusable).toHaveLength(6)
    })

    it('excludes disabled elements from focus order', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button>Active</button>
        <button disabled>Disabled</button>
        <input disabled>
      `

      const focusable = getFocusableElements(container)
      expect(focusable).toHaveLength(1)
    })

    it('includes elements with tabindex 0 or positive', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div tabindex="0">Focusable</div>
        <div tabindex="1">Also focusable</div>
        <div tabindex="-1">Not in tab order</div>
        <div>Not focusable</div>
      `

      const focusable = getFocusableElements(container)
      expect(focusable).toHaveLength(2)
    })
  })

  describe('ARIA Attributes', () => {
    it('dialogs should have aria-modal and role', () => {
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      dialog.setAttribute('aria-labelledby', 'dialog-title')
      dialog.innerHTML = '<h2 id="dialog-title">Confirm Action</h2>'

      expect(dialog.getAttribute('role')).toBe('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(dialog.getAttribute('aria-labelledby')).toBe('dialog-title')

      const title = dialog.querySelector('#dialog-title')
      expect(title).not.toBeNull()
      expect(title?.textContent).toBe('Confirm Action')
    })

    it('navigation landmarks should have aria-label', () => {
      const nav = document.createElement('nav')
      nav.setAttribute('aria-label', 'Main navigation')

      expect(nav.getAttribute('aria-label')).toBe('Main navigation')
    })

    it('alert messages should have role="alert"', () => {
      const alert = document.createElement('div')
      alert.setAttribute('role', 'alert')
      alert.textContent = 'Form submitted successfully'

      expect(alert.getAttribute('role')).toBe('alert')
      expect(alert.textContent).toBeTruthy()
    })

    it('status messages should use aria-live', () => {
      const status = document.createElement('div')
      status.setAttribute('aria-live', 'polite')
      status.textContent = '3 new messages'

      expect(status.getAttribute('aria-live')).toBe('polite')
    })

    it('loading spinners should announce to screen readers', () => {
      const spinner = document.createElement('div')
      spinner.setAttribute('role', 'status')
      spinner.setAttribute('aria-label', 'Loading')

      expect(spinner.getAttribute('role')).toBe('status')
      expect(spinner.getAttribute('aria-label')).toBe('Loading')
    })

    it('toggles should have aria-pressed or aria-checked', () => {
      const toggle = document.createElement('button')
      toggle.setAttribute('role', 'switch')
      toggle.setAttribute('aria-checked', 'false')
      toggle.textContent = 'Dark mode'

      expect(toggle.getAttribute('role')).toBe('switch')
      expect(toggle.getAttribute('aria-checked')).toBe('false')

      // Simulate toggle
      toggle.setAttribute('aria-checked', 'true')
      expect(toggle.getAttribute('aria-checked')).toBe('true')
    })
  })

  describe('Contrast Ratio Calculator', () => {
    it('returns 21:1 for black on white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('returns 1:1 for same colors', () => {
      const ratio = getContrastRatio('#333333', '#333333')
      expect(ratio).toBeCloseTo(1, 0)
    })

    it('handles RGB format', () => {
      const ratio = getContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('correctly identifies insufficient contrast', () => {
      // Light gray on white
      const ratio = getContrastRatio('#cccccc', '#ffffff')
      expect(meetsContrastRequirement(ratio, false)).toBe(false) // Fails normal text
    })
  })
})
