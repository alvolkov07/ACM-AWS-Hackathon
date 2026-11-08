import type { NextConfig } from "next";

// Where the FastAPI backend runs. The browser always calls /api on this site,
// and Next.js forwards those requests here, so no CORS setup is needed.
// Note: this is read when the app is built, so Docker passes it as a build arg.
const API_URL = process.env.API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  experimental: {
    // Supplier search and AI drafting can take longer than the 30s default.
    proxyTimeout: 180_000,
  },
};

export default nextConfig;
