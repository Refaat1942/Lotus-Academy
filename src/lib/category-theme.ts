import type { CSSProperties } from "react";

/**
 * Category color themes: each learning area has its own color so courses are instantly
 * recognisable on cards, covers, course pages and certificates. These are the only colors
 * outside the global tokens; Lotus green stays on chrome (buttons, header, footer).
 */
export interface CategoryTheme { accent: string; dark: string; soft: string; label: string }

const THEMES: Record<string, CategoryTheme> = {
  cardiovascular: { accent: "#C62839", dark: "#7F1424", soft: "#FCE8EB", label: "Cardiovascular" },
  "infectious-diseases": { accent: "#D97706", dark: "#8A4B03", soft: "#FEF1DD", label: "Infectious Diseases" },
  endocrinology: { accent: "#2563EB", dark: "#16398F", soft: "#E6EEFD", label: "Endocrinology" },
  "neuroscience-pain": { accent: "#7C3AED", dark: "#48208F", soft: "#F0E8FD", label: "Neuroscience & Pain" },
  "gi-respiratory": { accent: "#0891B2", dark: "#055468", soft: "#E0F4F9", label: "GI & Respiratory" },
  pediatrics: { accent: "#EA580C", dark: "#9A3608", soft: "#FEEBDF", label: "Pediatrics" },
  "womens-health": { accent: "#DB2777", dark: "#8E1650", soft: "#FCE7F1", label: "Women's Health" },
};
const DEFAULT: CategoryTheme = { accent: "#006F3C", dark: "#004A28", soft: "#E6F5ED", label: "Professional Development" };

export const categoryTheme = (slug?: string | null): CategoryTheme => (slug && THEMES[slug]) || DEFAULT;

/** CSS variables to spread on an element's style; children use var(--accent) etc. */
export const themeVars = (slug?: string | null): CSSProperties => {
  const t = categoryTheme(slug);
  return { ["--accent" as string]: t.accent, ["--accent-dark" as string]: t.dark, ["--soft" as string]: t.soft };
};
