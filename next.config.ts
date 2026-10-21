import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  allowedDevOrigins:['vos-sync-local','vertex-dev','100.114.249.96','100.85.88.114','100.77.171.59','desktop-1al8ql9.tail054015.ts.net','msi-lo.tail054015.ts.net', '100.99.36.91','msi-lo','ubuntuserver1','ubuntuserver1.tail054015.ts.net'],
  // allowedDevOrigins:['vos-sync-local','vertex-dev','100.114.249.96','100.85.88.114','100.77.171.59','desktop-1al8ql9.ta>

  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: { bodySizeLimit: "12mb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
