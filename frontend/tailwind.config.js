/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0B0F14",
        card:    "#111827",
        border:  "#1F2937",
        accent:  "#F59E0B",
        surface: "#1A2233",
      },
      fontFamily: {
        serif: ["Merriweather", "serif"],
        sans:  ["Inter", "sans-serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};