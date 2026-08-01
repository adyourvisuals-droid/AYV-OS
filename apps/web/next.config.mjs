/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @ayv/types ships as compiled CommonJS from the workspace; Next needs to
  // know it is a local package rather than a prebuilt node_modules dependency.
  transpilePackages: ['@ayv/types'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
