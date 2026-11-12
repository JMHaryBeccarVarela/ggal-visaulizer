/** @type {import('tailwindcss').Config} */
const EXCEL_FONT = ["Calibri", "Carlito", "Segoe UI", "Arial", "sans-serif"];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta tipo planilla de Excel: fondo blanco, tinta negra, grilla negra
        bg: {
          DEFAULT: "#ffffff",
          surface: "#ffffff",
          elev: "#f2f2f2",
          hover: "#d9d9d9",
        },
        border: {
          DEFAULT: "#000000",
          strong: "#000000",
        },
        text: {
          DEFAULT: "#000000",
          muted: "#404040",
          dim: "#595959",
        },
        accent: {
          DEFAULT: "#217346", // verde Excel
          bright: "#217346",
        },
        // Formato condicional de Excel ("Bueno" / "Incorrecto")
        bull: {
          DEFAULT: "#006100",
          bg: "#c6efce",
        },
        bear: {
          DEFAULT: "#9c0006",
          bg: "#ffc7ce",
        },
      },
      fontFamily: {
        mono: EXCEL_FONT,
        sans: EXCEL_FONT,
      },
    },
  },
  plugins: [],
};
