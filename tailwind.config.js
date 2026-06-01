/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0f172a",
        canvas: "#020617",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(2, 6, 23, 0.35)",
      },
    },
  },
  plugins: [],
};
