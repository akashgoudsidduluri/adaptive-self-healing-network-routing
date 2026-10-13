/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#045137',
          hover: '#033d2a',
          dark: '#022e20',
          subtle: '#EBF5F1',
          border: '#BFE0D4',
          light: '#F2F8F5',
        },
        packet: {
          DEFAULT: '#FF5E1F',
          subtle: '#FFF3ED',
          border: '#FFD4C2',
        },
        ink: {
          950: '#0F172A',
          900: '#111827',
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
          50: '#F9FAFB',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Consolas', 'monospace'],
      },
      maxWidth: {
        'content': '1200px',
      },
      borderRadius: {
        'pill': '9999px',
        DEFAULT: '4px',
        'md': '6px',
        'lg': '8px',
      },
      letterSpacing: {
        'technical': '0.06em',
      }
    },
  },
  plugins: [],
}
