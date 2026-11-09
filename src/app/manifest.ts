import type { MetadataRoute } from "next";

/** Web app manifest (icons come from the uploaded logo): lets staff install Lotus Academy on their phone like an app (requires HTTPS). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lotus Academy — أكاديمية لوتس",
    short_name: "Lotus Academy",
    description: "Pharmacy education & professional development for Lotus Pharmacies staff.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7faf9",
    theme_color: "#0e5e57",
    lang: "ar",
    dir: "auto",
    categories: ["education", "medical"],
    icons: [
      { src: "/api/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/app-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My learning", short_name: "Learning", url: "/dashboard", icons: [{ src: "/api/app-icon/192", sizes: "192x192" }] },
      { name: "Courses", url: "/courses", icons: [{ src: "/api/app-icon/192", sizes: "192x192" }] },
      { name: "Leaderboard", url: "/leaderboard", icons: [{ src: "/api/app-icon/192", sizes: "192x192" }] },
    ],
  };
}
