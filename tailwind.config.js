/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',
        forest: '#686D76',
        electric: '#00DFA5',
        'electric-light': '#14B8A6',
        emerald: '#00DFA5',
        teal: '#14B8A6',
        cyan: '#06B6D4',
        nardo: '#686D76',
        cream: '#1A1A1A',
        onyx: '#050505',
        surface: '#1A1A1A',
        'surface-2': '#343A40',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 70px rgba(0,0,0,0.42)',
        luxury: '0 30px 90px rgba(0,0,0,0.52)',
        electric: '0 0 0 1px rgba(0,223,165,.24), 0 18px 50px rgba(0,223,165,.12)',
        emerald: '0 0 0 1px rgba(0,223,165,.24), 0 18px 50px rgba(0,223,165,.12)',
      },
      backgroundImage: {
        'electric-gradient': 'linear-gradient(135deg, #00DFA5 0%, #14B8A6 52%, #06B6D4 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #00DFA5 0%, #14B8A6 52%, #06B6D4 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};
