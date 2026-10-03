/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#EDE9DF',
        forest: '#C9A45C',
        gold: '#C9A45C',
        'gold-light': '#E1C27A',
        cream: '#111111',
        onyx: '#050505',
        surface: '#111111',
        'surface-2': '#242424',
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
        'gold-gradient': 'linear-gradient(135deg, #C9A45C 0%, #E1C27A 48%, #A77D35 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};