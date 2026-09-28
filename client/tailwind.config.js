/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        ink: {
          DEFAULT: '#0F172A',
          soft: '#475569',
          mute: '#94A3B8',
        },
        brand: {
          50: '#EEF4FF',
          100: '#DCE7FF',
          200: '#BED2FF',
          300: '#92B3FF',
          400: '#618BFF',
          500: '#3B63F6',
          600: '#2547EB',
          700: '#1D36D8',
          800: '#1E2FAE',
          900: '#1E2D89',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.18)',
        card: '0 1px 3px rgba(15,23,42,0.05), 0 12px 32px -16px rgba(15,23,42,0.20)',
        glow: '0 18px 40px -18px rgba(59,99,246,0.55)',
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(1200px 600px at 8% -10%, #DCE7FF 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #EDE9FE 0%, transparent 50%), radial-gradient(800px 600px at 50% 110%, #E0F2FE 0%, transparent 55%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.7)', opacity: 0.65 },
          '100%': { transform: 'scale(2.4)', opacity: 0 },
        },
        'slide-up': { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'fade-in': 'fade-in .25s ease-out both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up': 'slide-up .3s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
