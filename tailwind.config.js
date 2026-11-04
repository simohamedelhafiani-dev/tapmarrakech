/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#F5F5F5',
        forest: '#121212',
        gold: '#D4AF37',
        'gold-light': '#D4AF37',
        cream: '#121212',
        onyx: '#121212',
        surface: '#1E1E1E',
        'surface-2': '#1E1E1E',
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
        soft: '0 24px 70px rgba(18,18,18,.34)',
        luxury: '0 30px 90px rgba(18,18,18,.48)',
        gold: '0 0 0 1px rgba(212,175,55,.22), 0 18px 50px rgba(18,18,18,.22)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #D4AF37 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(245,245,245,.08), rgba(245,245,245,.025))',
      },
      borderRadius: { luxury: '28px' },
    },
  },
  plugins: [],
};
