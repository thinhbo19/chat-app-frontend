/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Segoe UI", "system-ui", "sans-serif"],
      },
      animation: {
        "auth-card-in": "auth-card-in 0.48s cubic-bezier(0.22, 1, 0.36, 1) both",
        "auth-float": "auth-float 5s ease-in-out infinite",
      },
      keyframes: {
        "auth-card-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "auth-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
    },
  },
  plugins: [],
};
