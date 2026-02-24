import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: "#002844",
          50: "#E6EDF2",
          100: "#CCDBe5",
          200: "#99B7CB",
          300: "#6693B1",
          400: "#336F97",
          500: "#002844",
          600: "#002037",
          700: "#001829",
          800: "#00101C",
          900: "#00080E",
        },
        gold: {
          DEFAULT: "#D9B438",
          50: "#FBF5E2",
          100: "#F7EBC5",
          200: "#EFD78B",
          300: "#E7C351",
          400: "#D9B438",
          500: "#B8962B",
          600: "#8A7020",
          700: "#5C4B16",
          800: "#2E250B",
          900: "#171305",
        },
        gray: {
          DEFAULT: "#555555",
          light: "#F0F0F0",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "flame-pulse": "flamePulse 2s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
      },
      keyframes: {
        flamePulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
