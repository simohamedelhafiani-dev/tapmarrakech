/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { ink: '#17221d', forest: '#17352a', gold: '#c8a96b', cream: '#f7f7f3' }, fontFamily: { display: ['Playfair Display', 'serif'], sans: ['DM Sans', 'sans-serif'] }, boxShadow: { soft: '0 14px 40px rgba(23,53,42,0.08)' } } }, plugins: [] };
