import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Cormorant Garamond', 'serif'],
      },
      colors: {
        brand: {
          dark:      '#0D1A0A',
          forest:    '#1A2216',
          green:     '#2D4A22',
          midgreen:  '#4A7A35',
          sage:      '#7AAD5E',
          cream:     '#F5F0E8',
          nude:      '#EDE7D5',
          warm:      '#E8E0CC',
          red:       '#C0392B',
          brightred: '#E8503A',
          gold:      '#E8C547',
          deepgold:  '#D4A820',
        },
      },
      backgroundImage: {
        'grid-dark': 'linear-gradient(rgba(45,74,34,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(45,74,34,0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '24px 24px',
      },
    },
  },
  plugins: [],
};
export default config;
