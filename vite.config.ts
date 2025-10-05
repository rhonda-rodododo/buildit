import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/modules': path.resolve(__dirname, './src/modules'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-dialog', '@radix-ui/react-select'],
          'vendor-crypto': ['@noble/secp256k1', 'nostr-tools'],
          'vendor-utils': ['zustand', 'dexie', 'zod', 'clsx', 'tailwind-merge'],
          // Module chunks (lazy loaded)
          'module-events': ['src/modules/events/index.ts'],
          'module-governance': ['src/modules/governance/index.ts'],
          'module-wiki': ['src/modules/wiki/index.ts'],
          'module-mutual-aid': ['src/modules/mutual-aid/index.ts'],
          'module-database': ['src/modules/database/index.ts'],
          'module-crm': ['src/modules/crm/index.ts'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increase from 500KB default
  },
  test: {
    globals: true,
    environment: 'node', // Node for crypto, jsdom for UI tests (configure per-file if needed)
    environmentMatchGlobs: [
      ['**/*.ui.test.{ts,tsx}', 'jsdom'], // UI tests use jsdom
      ['**/integration/**/*.test.{ts,tsx}', 'jsdom'], // Integration tests need jsdom + IndexedDB
      ['**/__tests__/**', 'node'], // Crypto/core tests use node
    ],
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
})
