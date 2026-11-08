import type { NextConfig } from "next";

// Where the FastAPI backend runs. The browser always calls /api on this site,
// and Next.js forwards those requests here, so no CORS setup is needed.
const API_URL = process.env.API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
