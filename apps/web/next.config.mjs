/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@highstack/engine", "@highstack/agents"],
  experimental: { serverComponentsExternalPackages: ["postgres", "unpdf"] },
};
export default nextConfig;
