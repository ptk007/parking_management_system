/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "node_modules/primevue/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'mfu-red': '#A93226',
        'mfu-gold': '#C4A747',
        'parking-green': '#4CAF50',
        'parking-orange': '#FF9800',
        'parking-yellow': '#FFC107',
        'parking-gray': '#9E9E9E',
      },
    },
  },
  plugins: [],
}
