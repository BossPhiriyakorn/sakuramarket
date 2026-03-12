import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-prompt)", "var(--font-kanit)", "sans-serif"],
        thai: ["var(--font-kanit)", "var(--font-prompt)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
