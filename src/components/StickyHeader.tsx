"use client";
import { useEffect, useRef, useState } from "react";

/** Header that slides away when scrolling down and returns on scroll up (long-form reading pattern). */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const menuOpen = !!document.querySelector("header details[open]");
      if (y <= 160) setHidden(false);
      else if (y > last.current + 4) setHidden(!menuOpen);
      else if (y < last.current - 4) setHidden(false);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-40 border-b border-border bg-surface transition-transform duration-300 print:hidden ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      {children}
    </header>
  );
}
