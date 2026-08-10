import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Small container images — plan §11.4. Emits .next/standalone with a
  // self-contained server.js and only the traced dependencies.
  output: "standalone",

  // sharp ships native binaries; keep it out of the bundler so the prebuilt
  // libvips binding resolves correctly at runtime.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
