/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#00a884",
        "accent-hover": "#06cf9c",
        "bg-base": "#0b141a",
        "bg-panel": "#1f2c33",
        "bg-elevated": "#202c33",
        border: "#2a3942",
        muted: "#8696a0",
      },
    },
  },
  plugins: [],
};
