/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        surface: '#141417',
        surface2: '#1c1c20',
        line: '#26262b',
        ink: '#f4f4f5',
        muted: '#a1a1aa',
        faint: '#71717a',
        brand: { DEFAULT: '#1d6fe0', hover: '#2a7bea', soft: '#0d2547', ink: '#5b9cf5' },
        danger: { DEFAULT: '#ef4444', soft: '#2a0f12' },
        ok: '#22c55e',
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl2: '1.25rem' },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'drawer-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(-12px) scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'heart-pop': { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up 280ms cubic-bezier(0.23,1,0.32,1) both',
        'fade-in': 'fade-in 200ms ease-out both',
        'sheet-up': 'sheet-up 360ms cubic-bezier(0.32,0.72,0,1) both',
        'drawer-in': 'drawer-in 320ms cubic-bezier(0.32,0.72,0,1) both',
        'toast-in': 'toast-in 260ms cubic-bezier(0.23,1,0.32,1) both',
        'heart-pop': 'heart-pop 320ms cubic-bezier(0.23,1,0.32,1)',
      },
    },
  },
  plugins: [],
}
