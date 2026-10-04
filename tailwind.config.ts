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
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        float: { "0%,100%": { transform: "translateY(0) rotate(0deg)" }, "50%": { transform: "translateY(-14px) rotate(2deg)" } },
        gradient: { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        pop: { "0%": { transform: "scale(.92)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shine: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(220%)" } },
      },
      animation: {
        "fade-up": "fade-up .55s cubic-bezier(.2,.7,.2,1) both",
        float: "float 8s ease-in-out infinite",
        gradient: "gradient 14s ease infinite",
        pop: "pop .35s ease-out both",
        shine: "shine 3.5s ease-in-out infinite",
      },
      boxShadow: { card: "0 1px 2px rgb(16 24 40 / 0.04), 0 4px 14px rgb(16 24 40 / 0.05)", lift: "0 10px 30px rgb(0 74 40 / 0.14)" },
    },
  },
  plugins: [],
} satisfies Config;
