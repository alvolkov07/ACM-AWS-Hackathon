import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Standalone output packs a minimal Node server for Docker / App Runner.
  output: "standalone",
  // Keep Turbopack rooted here so a parent-folder pnpm workspace is ignored.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
