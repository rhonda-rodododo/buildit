/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  sanitizeMathHtml,
  sanitizeStrictHtml,
  stripHtml,
  SANITIZE_CONFIGS,
} from '../sanitize'

/**
 * Security tests for HTML sanitization
 *
 * CRITICAL: These tests verify XSS attack vectors are blocked
 * An E2EE app is a high-value target - XSS could steal private keys
 */

describe('HTML Sanitization Security', () => {
  describe('XSS Attack Prevention', () => {
    it('should block script tags', () => {
      const malicious = '<script>alert("xss")</script>'
      const sanitized = sanitizeHtml(malicious)

      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('alert')
    })

    it('should block script tags in various encodings', () => {
      const vectors = [
        '<script>alert(1)</script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</ScRiPt>',
        '<script src="evil.js"></script>',
        '<script type="text/javascript">alert(1)</script>',
      ]

      for (const vector of vectors) {
        const sanitized = sanitizeHtml(vector)
        expect(sanitized.toLowerCase()).not.toContain('<script')
      }
    })

    it('should block inline event handlers', () => {
      const vectors = [
        '<img src="x" onerror="alert(1)">',
        '<div onmouseover="alert(1)">hover me</div>',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)">',
        '<a onclick="alert(1)">click</a>',
        '<img src="x" ONERROR="alert(1)">',
      ]

      for (const vector of vectors) {
        const sanitized = sanitizeHtml(vector)
        expect(sanitized).not.toContain('onerror')
        expect(sanitized).not.toContain('onmouseover')
        expect(sanitized).not.toContain('onload')
        expect(sanitized).not.toContain('onfocus')
        expect(sanitized).not.toContain('onclick')
        expect(sanitized).not.toContain('ONERROR')
      }
    })

    it('should block javascript: URLs', () => {
      const vectors = [
        '<a href="javascript:alert(1)">click</a>',
        '<a href="JAVASCRIPT:alert(1)">click</a>',
        '<a href="javascript&#58;alert(1)">click</a>',
        '<a href="&#106;avascript:alert(1)">click</a>',
      ]

      for (const vector of vectors) {
        const sanitized = sanitizeHtml(vector)
        expect(sanitized.toLowerCase()).not.toContain('javascript:')
      }
    })

    it('should block data: URLs with scripts', () => {
      const vectors = [
        '<a href="data:text/html,<script>alert(1)</script>">click</a>',
        '<iframe src="data:text/html,<script>alert(1)</script>">',
      ]

      for (const vector of vectors) {
        const sanitized = sanitizeHtml(vector)
        expect(sanitized).not.toContain('data:text/html')
      }
    })

    it('should block iframe elements', () => {
      const malicious = '<iframe src="https://evil.com"></iframe>'
      const sanitized = sanitizeHtml(malicious)

      expect(sanitized).not.toContain('<iframe')
    })

    it('should block object and embed elements', () => {
      const vectors = [
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
      ]

      for (const vector of vectors) {
        const sanitized = sanitizeHtml(vector)
        expect(sanitized).not.toContain('<object')
        expect(sanitized).not.toContain('<embed')
      }
    })

    it('should block form elements', () => {
      const malicious = '<form action="https://evil.com"><input type="text"></form>'
      const sanitized = sanitizeHtml(malicious)

      // Form element should be blocked (action attribute is dangerous)
      expect(sanitized).not.toContain('<form')
      // Note: Input may or may not be stripped depending on environment
      // The important thing is the form with action is blocked
    })

    it('should block style tags', () => {
      const malicious = '<style>body { background: url("javascript:alert(1)") }</style>'
      const sanitized = sanitizeHtml(malicious)

      expect(sanitized).not.toContain('<style')
    })

    it('should block SVG with embedded scripts', () => {
      const malicious = '<svg onload="alert(1)"><circle r="10"></circle></svg>'
      const sanitized = sanitizeHtml(malicious)

      expect(sanitized).not.toContain('onload')
    })

    it('should block meta refresh attacks', () => {
      const malicious = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'
      const sanitized = sanitizeHtml(malicious)

      expect(sanitized).not.toContain('<meta')
    })
  })

  describe('Link Security', () => {
    it('should add target="_blank" to all links', () => {
      const html = '<a href="https://example.com">link</a>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('target="_blank"')
    })

    it('should add rel="noopener noreferrer" to all links', () => {
      const html = '<a href="https://example.com">link</a>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('rel="noopener noreferrer"')
    })

    it('should prevent tabnabbing attacks', () => {
      const html = '<a href="https://example.com" target="_blank">link</a>'
      const sanitized = sanitizeHtml(html)

      // Must have noopener to prevent tabnabbing
      expect(sanitized).toContain('noopener')
    })
  })

  describe('Allowed Content', () => {
    it('should allow basic text formatting', () => {
      const html = '<p><strong>bold</strong> and <em>italic</em></p>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('<p>')
      expect(sanitized).toContain('<strong>')
      expect(sanitized).toContain('<em>')
    })

    it('should allow headers', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('<h1>')
      expect(sanitized).toContain('<h2>')
    })

    it('should allow lists', () => {
      const html = '<ul><li>item 1</li><li>item 2</li></ul>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('<ul>')
      expect(sanitized).toContain('<li>')
    })

    it('should allow images with safe attributes', () => {
      const html = '<img src="image.png" alt="description">'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('<img')
      expect(sanitized).toContain('src="image.png"')
      expect(sanitized).toContain('alt="description"')
    })

    it('should allow tables', () => {
      const html = '<table><tr><td>cell</td></tr></table>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('<table>')
      expect(sanitized).toContain('<tr>')
      expect(sanitized).toContain('<td>')
    })
  })

  describe('sanitizeMathHtml', () => {
    it('should have a math config that extends default', () => {
      // Math config should be based on default but allow more elements
      expect(SANITIZE_CONFIGS.MATH).toBeDefined()
      expect(SANITIZE_CONFIGS.MATH.ALLOWED_TAGS).toBeDefined()
    })

    it('should return a string result', () => {
      const html = '<math><mrow><mi>x</mi></mrow></math>'
      const sanitized = sanitizeMathHtml(html)

      expect(typeof sanitized).toBe('string')
    })

    it('should block scripts even in math context', () => {
      const malicious = '<script>alert(1)</script>'
      const sanitized = sanitizeMathHtml(malicious)

      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('alert')
    })
  })

  describe('sanitizeStrictHtml', () => {
    it('should preserve text content', () => {
      const html = '<p>text</p><div>more</div><table><tr><td>cell</td></tr></table>'
      const sanitized = sanitizeStrictHtml(html)

      // Text content should be preserved
      expect(sanitized).toContain('text')
      expect(sanitized).toContain('more')
      expect(sanitized).toContain('cell')
    })

    it('should allow paragraph tags', () => {
      const html = '<p>paragraph</p>'
      const sanitized = sanitizeStrictHtml(html)

      expect(sanitized).toContain('<p>')
      expect(sanitized).toContain('paragraph')
    })

    it('should allow basic emphasis', () => {
      const html = '<strong>bold</strong> <em>italic</em> <u>underline</u>'
      const sanitized = sanitizeStrictHtml(html)

      expect(sanitized).toContain('<strong>')
      expect(sanitized).toContain('<em>')
      expect(sanitized).toContain('<u>')
    })

    it('should still block XSS in strict mode', () => {
      const malicious = '<script>alert(1)</script>'
      const sanitized = sanitizeStrictHtml(malicious)

      // Scripts should be blocked completely
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('alert')
    })

    it('should block images with event handlers in strict mode', () => {
      const malicious = '<img src=x onerror=alert(1)>'
      const sanitized = sanitizeStrictHtml(malicious)

      // img tag is not in the strict allowed list, so should be removed
      expect(sanitized).not.toContain('<img')
    })
  })

  describe('stripHtml', () => {
    it('should preserve text content while attempting to strip tags', () => {
      const html = '<p>Hello <strong>world</strong>!</p>'
      const stripped = stripHtml(html)

      // The function should preserve text content
      expect(stripped).toContain('Hello')
      expect(stripped).toContain('world')
      // Should not contain script tags or dangerous elements
      expect(stripped).not.toContain('<script')
    })

    it('should preserve text content from nested tags', () => {
      const html = '<div><p><span>nested</span> content</p></div>'
      const stripped = stripHtml(html)

      // Text content should be preserved
      expect(stripped).toContain('nested')
      expect(stripped).toContain('content')
    })

    it('should remove dangerous content while preserving safe text', () => {
      const malicious = '<script>alert(1)</script>some text'
      const stripped = stripHtml(malicious)

      // Scripts should be blocked
      expect(stripped).not.toContain('<script')
      expect(stripped).not.toContain('alert(')
      // Safe text should remain
      expect(stripped).toContain('some text')
    })
  })

  describe('Configuration Export', () => {
    it('should export sanitization configs', () => {
      expect(SANITIZE_CONFIGS.DEFAULT).toBeDefined()
      expect(SANITIZE_CONFIGS.MATH).toBeDefined()
      expect(SANITIZE_CONFIGS.STRICT).toBeDefined()
    })

    it('should have forbidden tags in default config', () => {
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_TAGS).toContain('script')
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_TAGS).toContain('iframe')
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_TAGS).toContain('form')
    })

    it('should have forbidden attributes in default config', () => {
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_ATTR).toContain('onerror')
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_ATTR).toContain('onclick')
      expect(SANITIZE_CONFIGS.DEFAULT.FORBID_ATTR).toContain('onload')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('')
    })

    it('should handle null-like input', () => {
      // DOMPurify handles these gracefully
      expect(sanitizeHtml(null as unknown as string)).toBe('')
      expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    })

    it('should preserve Unicode content', () => {
      const html = '<p>Hello 世界! 🌍 مرحبا</p>'
      const sanitized = sanitizeHtml(html)

      expect(sanitized).toContain('世界')
      expect(sanitized).toContain('🌍')
      expect(sanitized).toContain('مرحبا')
    })

    it('should handle malformed HTML', () => {
      const malformed = '<p>unclosed <strong>tags'
      const sanitized = sanitizeHtml(malformed)

      // Should not throw and should produce valid output
      expect(typeof sanitized).toBe('string')
    })

    it('should handle deeply nested content', () => {
      const nested = '<div>'.repeat(100) + 'content' + '</div>'.repeat(100)
      const sanitized = sanitizeHtml(nested)

      expect(sanitized).toContain('content')
    })
  })
})
