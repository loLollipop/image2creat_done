import path from "node:path";

import type { NextConfig } from "next";

// During local development the legacy Node.js backend (server.js) runs at
// :3000 and serves the JSON API under /api/*.  We proxy those paths from the
// Next.js dev server (:3001) so the new frontend can talk to the existing
// backend without any cross-origin / cookie surgery.
//
// In production the recommended deployment is nginx in front of both
// services:
//   - `/api/*`  -> http://backend:3000
//   - `/*`      -> http://web:3001
//
// The same nginx config is documented in docker-compose.yml and README.md.
const API_TARGET =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_PROXY_TARGET ||
  "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The repo root contains the legacy backend's package.json, so we tell
  // Turbopack to root itself at the web/ directory to avoid the
  // "multiple lockfiles" warning.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Pass the API base URL through to client components.  When empty (the
  // default in production behind nginx), all fetches use same-origin paths.
  env: {
    NEXT_PUBLIC_API_BASE_PATH: "",
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_TARGET}/api/:path*` },
      { source: "/data/:path*", destination: `${API_TARGET}/data/:path*` },
      { source: "/output/:path*", destination: `${API_TARGET}/output/:path*` },
    ];
  },
};

export default nextConfig;
