/**
 * ESLint configuration for ad-hoc static analysis
 * NOT used in CI pipeline - just for manual checks like finding untranslated strings
 *
 * Usage:
 *   bun run lint:i18n     # Check for untranslated strings in src/
 */

import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.config.*',
      '**/*.test.*',
      '**/__tests__/**',
      'src/tests/**',
    ],
  },
  {
    files: ['src/**/*.{jsx,tsx}'],
    plugins: {
      i18next,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Only rule: find untranslated literal strings in JSX
      'i18next/no-literal-string': ['warn', {
        markupOnly: true,
        ignoreAttribute: [
          // HTML/React attributes that don't need translation
          'className', 'class', 'id', 'key', 'ref', 'style', 'type', 'name',
          'value', 'defaultValue', 'href', 'src', 'data-*', 'role', 'tabIndex',
          'autoComplete', 'autoFocus', 'disabled', 'readOnly', 'required',
          'checked', 'selected', 'max', 'min', 'step', 'pattern', 'size',
          'maxLength', 'minLength', 'rows', 'cols', 'accept', 'method', 'action',
          'target', 'rel', 'download', 'loading', 'crossOrigin',
          // SVG attributes
          'd', 'viewBox', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap',
          'strokeLinejoin', 'transform', 'cx', 'cy', 'r', 'rx', 'ry',
          'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points',
          // UI component props (shadcn, radix, etc.)
          'variant', 'size', 'align', 'side', 'sideOffset', 'alignOffset',
          'asChild', 'forceMount', 'loop', 'modal', 'open', 'defaultOpen',
          'orientation', 'dir', 'collapsible',
        ],
        ignore: [
          // Technical patterns
          '^[A-Z][A-Z_0-9]+$',  // CONSTANTS
          '^\\d',               // Numbers
          '^\\s*$',             // Whitespace
          '^https?://',         // URLs
          '^\\./',              // Paths
          '^#[0-9a-fA-F]',      // Hex colors
          '^@',                 // Mentions
          // App-specific
          '^BuildIt',
          '^BuildN',
          '^Nostr',
          '^npub',
          '^nsec',
          '^NIP-',
        ],
      }],
    },
  },
);
