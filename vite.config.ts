import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: false,
      filename: './dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    // Brotli compression (better than gzip)
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // Only compress files > 10KB
      algorithm: 'brotliCompress',
      ext: '.br',
      deleteOriginFile: false,
    }),
    // Also create gzip versions for older servers
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
    }),
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
        manualChunks: (id) => {
          // Core vendor libraries
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router-dom/')) {
            return 'vendor-router';
          }

          // Crypto libraries
          if (id.includes('@noble/secp256k1') || id.includes('nostr-tools')) {
            return 'vendor-crypto';
          }

          // UI libraries - split by package for better caching
          if (id.includes('@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // Heavy markdown editor - separate chunk
          if (id.includes('@uiw/react-md-editor')) {
            return 'vendor-md-editor';
          }

          // Table/data visualization libraries
          if (id.includes('@tanstack/react-table') || id.includes('@tanstack/react-virtual')) {
            return 'vendor-table';
          }
          if (id.includes('@hello-pangea/dnd')) {
            return 'vendor-dnd';
          }

          // Date libraries
          if (id.includes('date-fns')) {
            return 'vendor-date';
          }

          // State management and storage
          if (id.includes('zustand') || id.includes('dexie')) {
            return 'vendor-state';
          }

          // Utilities
          if (id.includes('node_modules/') && (
            id.includes('clsx') ||
            id.includes('tailwind-merge') ||
            id.includes('zod') ||
            id.includes('class-variance-authority')
          )) {
            return 'vendor-utils';
          }

          // Module chunks - let them be lazy loaded naturally
          if (id.includes('src/modules/wiki/')) {
            return 'module-wiki';
          }
          if (id.includes('src/modules/events/')) {
            return 'module-events';
          }
          if (id.includes('src/modules/database/')) {
            return 'module-database';
          }
          if (id.includes('src/modules/governance/')) {
            return 'module-governance';
          }
          if (id.includes('src/modules/mutual-aid/')) {
            return 'module-mutual-aid';
          }
          if (id.includes('src/modules/crm/')) {
            return 'module-crm';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500, // Keep at 500KB to catch issues
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
