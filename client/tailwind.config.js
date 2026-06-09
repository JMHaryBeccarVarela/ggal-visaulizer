/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta tipo Bloomberg/Refinitiv: oscuro, alto contraste
        bg: {
          DEFAULT: "#0a0e14",
          surface: "#11161d",
          elev: "#161d26",
          hover: "#1c2530",
        },
        border: {
          DEFAULT: "#1f2a36",
          strong: "#2a3744",
        },
        text: {
          DEFAULT: "#e6edf3",
          muted: "#8b96a3",
          dim: "#5a6571",
        },
        accent: {
          DEFAULT: "#f59e0b", // ámbar - tipo terminal financiera
          bright: "#fbbf24",
        },
        bull: {
          DEFAULT: "#22c55e",
          bg: "rgba(34,197,94,0.12)",
        },
        bear: {
          DEFAULT: "#ef4444",
          bg: "rgba(239,68,68,0.12)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "Consolas", "monospace"],
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel:
          "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.03)",
      },
    },
  },
  plugins: [],
};
