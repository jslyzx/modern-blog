import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
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
    formats: ["image/webp"],
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
