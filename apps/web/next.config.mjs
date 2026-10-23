import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
const hier = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(join(hier, "../../package.json"), "utf8")).version;
let commit = process.env.BUILD_COMMIT || "";
try { commit ||= execSync("git rev-parse --short HEAD", { cwd: hier, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* ohne git, z. B. im Docker-Build */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eigenständiger Server für Docker (node server.js), inkl. der Pakete aus dem Monorepo
  output: "standalone",
  env: { NEXT_PUBLIC_VERSION: version, NEXT_PUBLIC_COMMIT: commit, NEXT_PUBLIC_STAND: new Date().toISOString().slice(0, 10) },
  transpilePackages: ["@highstack/engine", "@highstack/agents", "@highstack/trading"],
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ["postgres", "unpdf", "nodemailer"], outputFileTracingRoot: join(hier, "../..") },
};
export default nextConfig;
