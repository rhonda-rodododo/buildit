/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // BuildIt brand colors from design tokens
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        background: {
          DEFAULT: '#ffffff',
          dark: '#0a0a0a',
        },
        foreground: {
          DEFAULT: '#0a0a0a',
          dark: '#fafafa',
        },
        muted: {
          DEFAULT: '#f5f5f5',
          dark: '#262626',
          foreground: '#737373',
        },
      },
    },
  },
  plugins: [],
};
