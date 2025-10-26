import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/hls-proxy/:path*',
        destination: 'https://liveshopping.app.100ms.live/:path*',
      },
    ];
  },
};

export default nextConfig;
