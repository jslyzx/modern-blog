import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "gips3.baidu.com",
      },
      {
        protocol: "https",
        hostname: "gips3.baidu.com",
      },
    ],
  },
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
