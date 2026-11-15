/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',
        forest: '#00FFC3',
        gold: '#00FFC3',
        'gold-light': '#75FFE0',
        cream: '#1A1A1A',
        onyx: '#0A0A0A',
        surface: '#1A1A1A',
        'surface-2': '#202020',
        emerald: '#00FFC3',
        'emerald-soft': '#75FFE0',
        graphite: '#1A1A1A',
        silver: '#B0B0B0',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 48px rgba(0,0,0,0.38)',
        luxury: '0 28px 80px rgba(0,0,0,0.52)',
        gold: '0 0 0 1px rgba(0,255,195,.22), 0 18px 50px rgba(0,255,195,.10)',
        emerald: '0 0 0 1px rgba(0,255,195,.24), 0 18px 50px rgba(0,255,195,.12)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #75FFE0 0%, #00FFC3 52%, #00B88D 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #75FFE0 0%, #00FFC3 52%, #00B88D 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.018))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};
