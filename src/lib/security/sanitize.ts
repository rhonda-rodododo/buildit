/**
 * HTML Sanitization utilities using DOMPurify
 *
 * SECURITY: All user-generated HTML content MUST be sanitized before rendering
 * with dangerouslySetInnerHTML to prevent XSS attacks.
 *
 * This is critical for an E2EE app where a malicious payload could steal private keys.
 */

import DOMPurify, { Config } from 'dompurify'

/**
 * Default DOMPurify configuration for general HTML content
 * Allows common formatting elements but blocks dangerous ones
 */
const DEFAULT_CONFIG: Config = {
  // Allow common HTML elements
  ALLOWED_TAGS: [
    // Text formatting
    'p', 'br', 'span', 'div',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
    'sub', 'sup', 'mark', 'small', 'big',
    // Headers
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Links and media
    'a', 'img', 'video', 'audio', 'source', 'picture',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    // Block elements
    'blockquote', 'pre', 'code', 'hr',
    // Semantic elements
    'article', 'section', 'header', 'footer', 'nav', 'aside', 'main', 'figure', 'figcaption',
    // Inline elements
    'abbr', 'cite', 'q', 'time', 'address',
    // Interactive
    'details', 'summary',
  ],
  // Allow common attributes
  ALLOWED_ATTR: [
    // Global attributes
    'id', 'class', 'style', 'title', 'lang', 'dir',
    // Links
    'href', 'target', 'rel',
    // Media
    'src', 'alt', 'width', 'height', 'loading', 'decoding',
    'controls', 'autoplay', 'loop', 'muted', 'poster', 'preload',
    // Tables
    'colspan', 'rowspan', 'scope', 'headers',
    // Data attributes (for styling hooks)
    'data-*',
    // Time
    'datetime',
    // Details
    'open',
  ],
  // Security: Force safe link attributes
  ADD_ATTR: ['target', 'rel'],
  // Allow data URIs for images (needed for inline images)
  ADD_DATA_URI_TAGS: ['img'],
  // Force all links to open in new tab with noopener
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
}

/**
 * Configuration for math/code content that needs KaTeX/syntax highlighting HTML
 * More permissive but still blocks scripts
 */
const MATH_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  // KaTeX generates semantic HTML
  ALLOWED_TAGS: [
    ...DEFAULT_CONFIG.ALLOWED_TAGS!,
    'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac',
    'mroot', 'msqrt', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'mtext',
    'annotation', 'svg', 'path', 'g', 'line', 'rect', 'circle', 'ellipse',
  ],
  ALLOWED_ATTR: [
    ...DEFAULT_CONFIG.ALLOWED_ATTR!,
    // SVG attributes for KaTeX
    'd', 'viewBox', 'fill', 'stroke', 'stroke-width', 'transform',
    'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    // MathML attributes
    'mathvariant', 'displaystyle', 'scriptlevel',
  ],
}

/**
 * Strict configuration for plain text with minimal formatting
 */
const STRICT_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
}

/**
 * Sanitize HTML content for safe rendering
 *
 * @param dirty - Untrusted HTML string
 * @param config - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 * ```
 */
export function sanitizeHtml(dirty: string, config: Config = DEFAULT_CONFIG): string {
  return DOMPurify.sanitize(dirty, { ...config, RETURN_TRUSTED_TYPE: false }) as string
}

/**
 * Sanitize HTML content for math/code rendering (KaTeX, syntax highlighting)
 * More permissive to allow math markup but still blocks scripts
 */
export function sanitizeMathHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ...MATH_CONFIG, RETURN_TRUSTED_TYPE: false }) as string
}

/**
 * Sanitize HTML with strict settings (minimal formatting)
 * Use for user-generated content in sensitive contexts
 */
export function sanitizeStrictHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ...STRICT_CONFIG, RETURN_TRUSTED_TYPE: false }) as string
}

/**
 * Strip all HTML tags and return plain text
 * Useful for text-only contexts or search indexing
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Hook to add rel="noopener noreferrer" to all links
 * This prevents tabnabbing attacks from user-generated links
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

// Export configurations for advanced usage
export const SANITIZE_CONFIGS = {
  DEFAULT: DEFAULT_CONFIG,
  MATH: MATH_CONFIG,
  STRICT: STRICT_CONFIG,
} as const
