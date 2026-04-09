/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep space dark palette
        void: {
          DEFAULT: '#070A12',
          50: '#0B0F1A',
          100: '#0F1424',
          200: '#141A2E',
          300: '#1A2138',
          400: '#212A45',
          500: '#2A3555',
        },
        // Neon accents
        neon: {
          cyan: '#00F0FF',
          blue: '#3B82F6',
          purple: '#A855F7',
          pink: '#EC4899',
        },
        // Semantic
        background: '#070A12',
        foreground: '#E2E8F0',
        card: {
          DEFAULT: 'rgba(15, 20, 36, 0.6)',
          foreground: '#E2E8F0',
        },
        primary: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#1A2138',
          foreground: '#94A3B8',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 240, 255, 0.15), 0 0 60px rgba(0, 240, 255, 0.05)',
        'neon-blue': '0 0 20px rgba(59, 130, 246, 0.2), 0 0 60px rgba(59, 130, 246, 0.05)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.15), 0 0 60px rgba(168, 85, 247, 0.05)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan': 'scan 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)' },
          '50%': { opacity: '1', boxShadow: '0 0 40px rgba(0, 240, 255, 0.4)' },
        },
        'scan': {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { transform: 'translateY(4px)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
