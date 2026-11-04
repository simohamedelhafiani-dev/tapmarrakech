/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#F5F5F5',
        forest: '#121212',
        gold: '#D4AF37',
        'gold-light': '#E7C96B',
        cream: '#121212',
        onyx: '#0B0B0B',
        surface: '#1E1E1E',
        'surface-2': '#262626',
        'luxury-bg': '#121212',
        'luxury-surface': '#1E1E1E',
        'luxury-muted': '#A0A0A0',
        'luxury-ivory': '#F5F5F5',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 70px rgba(0,0,0,0.34)',
        luxury: '0 30px 90px rgba(0,0,0,0.48)',
        gold: '0 0 0 1px rgba(201,164,92,.24), 0 18px 50px rgba(201,164,92,.10)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #E7C96B 48%, #A77D35 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};