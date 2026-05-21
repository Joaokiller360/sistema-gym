import type { NextConfig } from "next";

const BACKEND_URL = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '')

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ]
  },
};

export default nextConfig;
