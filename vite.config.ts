import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
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
        globIgnores: ['stats.html'],
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
  server: {
    proxy: {
      // Proxy API requests to local Wrangler Pages dev server
      // Run `bun run pages:dev` in a separate terminal to start the Pages dev server
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    modulePreload: {
      // Don't preload md-editor (heavy chunk, only load when wiki editor opened)
      resolveDependencies: (filename, deps) => {
        return deps.filter(dep => !dep.includes('vendor-md-editor'))
      }
    },
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
    // Use projects to define different test environments (replaces deprecated environmentMatchGlobs)
    projects: [
      {
        // happy-dom project: UI tests and integration tests that need DOM/browser APIs
        extends: true, // Inherit resolve.alias and plugins from root config
        test: {
          name: 'happy-dom',
          environment: 'happy-dom',
          include: [
            '**/*.ui.test.{ts,tsx}',
            '**/integration/**/*.test.{ts,tsx}',
          ],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/e2e/**',
            '**/tests/e2e/**',
            '**/*.spec.ts',
            '**/*.spec.tsx',
          ],
          setupFiles: './src/test/setup.ts',
        },
      },
      {
        // node project: Crypto/core tests and unit tests that use WebCrypto
        extends: true, // Inherit resolve.alias and plugins from root config
        test: {
          name: 'node',
          environment: 'node',
          include: [
            '**/__tests__/**/*.test.{ts,tsx}',
            '**/tests/unit/**/*.test.{ts,tsx}',
          ],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/e2e/**',
            '**/tests/e2e/**',
            '**/*.spec.ts',
            '**/*.spec.tsx',
          ],
          setupFiles: './src/test/setup.ts',
        },
      },
      {
        // Default project: All other .test.ts files use happy-dom
        extends: true, // Inherit resolve.alias and plugins from root config
        test: {
          name: 'default',
          environment: 'happy-dom',
          include: ['**/*.test.{js,ts,tsx}'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/e2e/**',
            '**/tests/e2e/**',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            // Exclude tests handled by other projects
            '**/*.ui.test.{ts,tsx}',
            '**/integration/**/*.test.{ts,tsx}',
            '**/__tests__/**/*.test.{ts,tsx}',
            '**/tests/unit/**/*.test.{ts,tsx}',
          ],
          setupFiles: './src/test/setup.ts',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Include specific source directories for coverage
      include: [
        'src/core/**/*.{ts,tsx}',
        'src/stores/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/modules/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/tests/**',
      ],
      // Set to false to append coverage from multiple runs
      // Run: bun run test --coverage (first run cleans)
      // Then: bun run test --coverage --coverage.clean=false (append mode)
      clean: true,
      // Thresholds for coverage (optional, can enable when ready)
      // thresholds: {
      //   lines: 60,
      //   functions: 60,
      //   branches: 60,
      //   statements: 60,
      // },
    },
  },
})
