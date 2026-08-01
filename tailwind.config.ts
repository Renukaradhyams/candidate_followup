import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hrms-system/client/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hrms-system/client/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1E2D4E",
        gold: "#C9952A",
        cream: "#EDE8DE",
        surface: "#F9F7F4",
      },
    },
  },
  plugins: [],
};
export default config;
