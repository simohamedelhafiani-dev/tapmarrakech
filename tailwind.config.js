/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#E5E7EB',
        forest: '#3B82F6',
        blue: '#3B82F6',
        'blue-light': '#60A5FA',
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
        blue: '0 0 0 1px rgba(59,130,246,.24), 0 18px 50px rgba(59,130,246,.10)',
      },
      backgroundImage: {
        'blue-gradient': 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 48%, #A77D35 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};