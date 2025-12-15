/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 👈 這行會確保 Tailwind 掃描到 travelapp_v1.jsx
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}