/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
