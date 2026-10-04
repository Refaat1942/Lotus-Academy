const csp = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "adm-zip"],
  webpack(config) {
    // TypeScript 7 dropped baseUrl, so the "@/" alias is declared here as well as in tsconfig "paths".
    config.resolve.alias["@"] = path.join(root, "src");
    return config;
  },
  async headers() {
    return [
      {
        // /api/brand serves user-uploaded images and sets its own, stricter (sandboxed) CSP.
        source: "/((?!api/brand).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};
