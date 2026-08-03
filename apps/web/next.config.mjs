/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @ayv/types ships as compiled CommonJS from the workspace; Next needs to
  // know it is a local package rather than a prebuilt node_modules dependency.
  transpilePackages: ['@ayv/types'],
  // Packages with native bindings (Prisma's query engine, argon2's napi
  // binary) must not be pulled into the webpack bundle for the auth API
  // routes — they need to load as real Node addons at runtime.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2', 'pg'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
