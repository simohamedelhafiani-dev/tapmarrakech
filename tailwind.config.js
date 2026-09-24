/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        forest: 'var(--ink)',
        gold: 'var(--gold)',
        'gold-dim': 'var(--gold-dim)',
        cream: 'var(--ink)',
        paper: 'var(--paper)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 28px rgba(0,0,0,0.16)',
      },
    },
  },
  plugins: [],
};
