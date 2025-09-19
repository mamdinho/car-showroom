/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: { boxShadow: { card: "0 2px 10px rgba(0,0,0,0.06)" } },
  },
  plugins: [],
};
