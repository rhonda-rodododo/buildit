import { defineConfig } from '@tanstack/start/config';

export default defineConfig({
  server: {
    preset: 'cloudflare-pages',
  },
  react: {
    babel: {
      plugins: [],
    },
  },
});
