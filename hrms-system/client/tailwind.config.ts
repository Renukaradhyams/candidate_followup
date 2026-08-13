import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#1E2D4E',
          dark: '#162340',
          light: '#2a3f6e'
        },
        gold: {
          DEFAULT: '#C9952A',
          dark: '#B8860B',
          light: '#dfad45'
        },
        cream: {
          DEFAULT: '#EDE8DE',
          bg: '#F9F7F4'
        }
      }
    },
  },
  plugins: [],
};
export default config;
