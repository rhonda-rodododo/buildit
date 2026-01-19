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
        // Mobile-optimized precaching: skip large chunks for faster initial load
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB max
        // Skip waiting to update immediately
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache navigation requests with network-first for fresh content
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 3, // Fast fallback to cache on slow networks
            }
          },
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
          },
          {
            // Cache images with cache-first for performance
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache API responses with stale-while-revalidate
            urlPattern: /\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Disabled in dev - causes InvalidStateError with HMR
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
  optimizeDeps: {
    include: [
      '@noble/hashes',
      '@noble/hashes/utils',
      '@noble/hashes/sha256',
      '@noble/secp256k1',
      '@scure/bip39',
    ],
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
        // Use Vite's automatic code splitting
        // Manual chunks can cause circular dependency issues with React
        // Vite will automatically split large chunks and lazy-load them
        manualChunks: undefined,
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
        // node project: Crypto tests that specifically need Node's WebCrypto
        extends: true, // Inherit resolve.alias and plugins from root config
        test: {
          name: 'node',
          environment: 'node',
          include: [
            '**/core/crypto/__tests__/**/*.test.{ts,tsx}',
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
            '**/core/crypto/__tests__/**/*.test.{ts,tsx}',
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
