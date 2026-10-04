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
      borderRadius: { DEFAULT: "6px", lg: "10px" },
      boxShadow: { card: "0 1px 2px rgb(16 24 40 / 0.05), 0 1px 3px rgb(16 24 40 / 0.06)" },
    },
  },
  plugins: [],
} satisfies Config;
