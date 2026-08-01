import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
