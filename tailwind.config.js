/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff", 100: "#e0effe", 200: "#bae0fd", 300: "#7cc8fb",
          400: "#36adf6", 500: "#0c93e7", 600: "#0074c5", 700: "#015ca0",
          800: "#064f84", 900: "#0b426e", 950: "#072a49",
        },
        surface: {
          0: "#ffffff", 50: "#f8f9fb", 100: "#f1f3f5", 200: "#e2e5e9",
          300: "#c8cdd4", 400: "#9aa2ae", 500: "#6b7280", 600: "#4b5563",
          700: "#374151", 800: "#1f2937", 900: "#111827",
        },
        success: { light: "#ecfdf5", DEFAULT: "#10b981", dark: "#065f46" },
        danger: { light: "#fef2f2", DEFAULT: "#ef4444", dark: "#991b1b" },
        warning: { light: "#fffbeb", DEFAULT: "#f59e0b", dark: "#92400e" },
      },
      fontFamily: {
        display: ["'DM Sans'", "system-ui", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        elevated: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        modal: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
