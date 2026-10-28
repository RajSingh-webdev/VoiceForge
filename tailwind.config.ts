import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-green": "#0F3D3E",
        teal: "#1F8A84",
        mint: "#E8F1EF",
      },
    },
  },
  plugins: [],
};
export default config;
