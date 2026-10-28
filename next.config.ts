import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// GitHub Codespaces serves the app through a forwarded host (*.app.github.dev) that differs from
// the address the server sees, so Next's origin check on Server Actions needs to know about it.
// Scoped to Codespaces only: anyone can create a *.app.github.dev address, so this must never be
// enabled in staging or production.
const inCodespaces = process.env.CODESPACES === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(inCodespaces
    ? {
        allowedDevOrigins: ["*.app.github.dev"],
        experimental: { serverActions: { allowedOrigins: ["*.app.github.dev"] } },
      }
    : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
