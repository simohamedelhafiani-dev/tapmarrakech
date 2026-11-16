/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',
        forest: '#00DFA5',
        gold: '#00DFA5',
        'gold-light': '#00DFA5',
        cream: '#121212',
        onyx: '#050505',
        surface: '#121212',
        'surface-2': '#1A1A1A',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 70px rgba(0,0,0,0.34)',
        luxury: '0 30px 90px rgba(0,0,0,0.48)',
        gold: '0 0 0 1px rgba(0,223,165,.24), 0 18px 50px rgba(0,223,165,.10)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #00DFA5 0%, #00DFA5 48%, #00A982 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};