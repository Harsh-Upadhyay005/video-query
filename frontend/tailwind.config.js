/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wispr: {
          bg: "#FDFCF0",
          accent: "#D9CCF5",
          dark: "#1A1A1A",
          muted: "#8A8A8A",
          border: "#E2E0D4",
          card: "#FFFFFF",
        },
        foreground: "#FFFFFF",
        "muted-foreground": "#71717A",
      },
      fontFamily: {
        serif: ["Baskervville", "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      screens: {
        xs: "420px",
      }
    },
  },
  plugins: [],
}
