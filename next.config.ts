import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  allowedDevOrigins: ['vos-sync-local', 'vertex-dev', '100.114.249.96', '100.85.88.114', '100.77.171.59', 'desktop-1al8ql9.tail054015.ts.net', 'msi-lo.tail054015.ts.net', '100.99.36.91', 'msi-lo', 'ubuntuserver1', 'ubuntuserver1.tail054015.ts.net'],
  // allowedDevOrigins:['vos-sync-local','vertex-dev','100.114.249.96','100.85.88.114','100.77.171.59','desktop-1al8ql9.ta>
  
  // cacheComponents: true,
  experimental: {
    agentUpgrade: 'security',
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },

  async redirects() {
    return [
      {
        source: "/vos-sync/vos-admin/:path*",
        destination: "/linkbridge/admin/:path*",
        permanent: false,
      },
      {
        source: "/vos-sync/:path*",
        destination: "/linkbridge/:path*",
        permanent: false,
      },
      {
        source: "/linkbridge/vos-admin/:path*",
        destination: "/linkbridge/admin/:path*",
        permanent: false,
      },
    ];
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
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
