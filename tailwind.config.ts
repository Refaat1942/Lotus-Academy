import type { Config } from "tailwindcss";

// All colors come from CSS variables defined in src/app/globals.css (design tokens).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: token("primary"), dark: token("primary-dark"), light: token("primary-light") },
        secondary: token("secondary"),
        background: token("background"),
        surface: token("surface"),
        text: token("text"),
        muted: token("muted"),
        border: token("border"),
        success: token("success"),
        warning: token("warning"),
        error: token("error"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], serif: ["var(--font-serif)", "Georgia", "serif"] },
      borderRadius: { DEFAULT: "8px", lg: "12px", xl: "16px", "2xl": "22px", "3xl": "32px" },
      boxShadow: { card: "0 1px 2px rgb(16 24 40 / 0.04), 0 4px 14px rgb(16 24 40 / 0.05)", lift: "0 10px 30px rgb(0 74 40 / 0.14)" },
    },
  },
  plugins: [],
} satisfies Config;
