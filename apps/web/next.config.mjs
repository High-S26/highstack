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
  transpilePackages: ["@highstack/engine", "@highstack/agents", "@highstack/trading", "@highstack/prognose"],
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ["postgres", "unpdf", "nodemailer", "tesseract.js", "sharp", "@tesseract.js-data/deu", "@napi-rs/canvas"], outputFileTracingRoot: join(hier, "../.."),
    // Texterkennung lädt Sprachdaten und WebAssembly zur Laufzeit per Pfad: für den eigenständigen Server mitnehmen
    outputFileTracingIncludes: { "/api/erfassen": ["../../node_modules/@tesseract.js-data/deu/4.0.0_best_int/**", "../../node_modules/tesseract.js-core/**", "../../node_modules/tesseract.js/**"], "/api/objekte/[id]/dokumente": ["../../node_modules/@tesseract.js-data/deu/4.0.0_best_int/**", "../../node_modules/tesseract.js-core/**", "../../node_modules/tesseract.js/**"],
      "/api/admin/termine/lesen": ["../../node_modules/@tesseract.js-data/deu/4.0.0_best_int/**", "../../node_modules/tesseract.js-core/**", "../../node_modules/tesseract.js/**", "../../node_modules/@napi-rs/**"] } },
};
export default nextConfig;
