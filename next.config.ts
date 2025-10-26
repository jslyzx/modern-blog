import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["app", "components", "lib"],
  },
  experimental: {
    serverComponentsExternalPackages: ["mysql2"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
