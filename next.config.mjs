/** @type {import('next').NextConfig} */
const nextConfig = {
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
