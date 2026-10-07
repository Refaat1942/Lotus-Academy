import { Baby, Bug, Brain, Droplets, Flower2, HeartPulse, MessagesSquare, Pill, Scissors, ShoppingBag, Sparkles, Stethoscope, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BY_SLUG: Record<string, LucideIcon> = {
  cardiovascular: HeartPulse,
  "infectious-diseases": Bug,
  endocrinology: Droplets,
  "neuroscience-pain": Brain,
  "gi-respiratory": Wind,
  pediatrics: Baby,
  "womens-health": Flower2,
  "retail-excellence": ShoppingBag,
  "professional-skills": MessagesSquare,
  dermocosmetics: Sparkles,
  "hair-scalp-care": Scissors,
};

export const categoryIcon = (slug?: string | null): LucideIcon => (slug && BY_SLUG[slug]) || Pill;
export { Stethoscope };
