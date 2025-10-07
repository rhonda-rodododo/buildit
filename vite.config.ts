import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'BuildIt Network - a social action network',
        short_name: 'BuildIt',
        description: 'Privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, unions, and community organizers',
        theme_color: '#3b82f6', // blue-500
        background_color: '#0f172a', // slate-900
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['social', 'productivity', 'utilities'],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
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
    environment: 'happy-dom', // Use happy-dom for better test compatibility
    environmentMatchGlobs: [
      ['**/*.ui.test.{ts,tsx}', 'happy-dom'], // UI tests use happy-dom
      ['**/integration/**/*.test.{ts,tsx}', 'happy-dom'], // Integration tests need happy-dom + IndexedDB
      ['**/__tests__/**', 'node'], // Crypto/core tests use node
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**', // Exclude playwright e2e tests
      '**/*.e2e.{ts,tsx}',
      '**/*.spec.{ts,tsx}', // Exclude *.spec.ts files (playwright convention)
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
