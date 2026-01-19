import { one } from 'one/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    one({
      web: {
        defaultRenderMode: 'spa',
      },
      native: {
        // Use metro for stability (recommended by One)
        // Set to 'vite' for experimental faster builds
        bundler: 'metro',
      },
    }),
  ],
})
