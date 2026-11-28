/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',
        forest: '#475569',
        electric: '#10B981',
        'electric-light': '#14B8A6',
        emerald: '#10B981',
        teal: '#14B8A6',
        cyan: '#06B6D4',
        nardo: '#475569',
        cream: '#1A1A1A',
        onyx: '#050505',
        surface: '#1A1A1A',
        'surface-2': '#343A40',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 70px rgba(0,0,0,0.42)',
        luxury: '0 30px 90px rgba(0,0,0,0.52)',
        electric: '0 0 0 1px rgba(16, 185, 129,.24), 0 18px 50px rgba(16, 185, 129,.12)',
        emerald: '0 0 0 1px rgba(16, 185, 129,.24), 0 18px 50px rgba(16, 185, 129,.12)',
      },
      backgroundImage: {
        'electric-gradient': 'linear-gradient(135deg, #10B981 0%, #14B8A6 52%, #06B6D4 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #10B981 0%, #14B8A6 52%, #06B6D4 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025))',
      },
      borderRadius: {
        luxury: '28px',
      },
    },
  },
  plugins: [],
};
