import type { NextConfig } from "next";
import { IMAGE_REMOTE_PATTERNS } from "./app/lib/image-hosts";

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "media-src 'self' https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const CACHE_IMAGE = "public, max-age=86400, stale-while-revalidate=3600";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  reactCompiler: true,

  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],

  experimental: {
    optimizePackageImports: ["lucide-react"],

    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
    ];
  },
  images: {
    minimumCacheTTL: 86400,
    remotePatterns: IMAGE_REMOTE_PATTERNS,
  },
};

export default nextConfig;
