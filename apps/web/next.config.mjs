import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const hier = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eigenständiger Server für Docker (node server.js), inkl. der Pakete aus dem Monorepo
  output: "standalone",
  transpilePackages: ["@highstack/engine", "@highstack/agents"],
  experimental: { serverComponentsExternalPackages: ["postgres", "unpdf", "nodemailer"], outputFileTracingRoot: join(hier, "../..") },
};
export default nextConfig;
