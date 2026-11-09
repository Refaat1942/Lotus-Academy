"use client";
import { useEffect } from "react";

/** Registers the service worker (browsers only allow it on HTTPS or localhost). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
