import { execFileSync } from "node:child_process";

import type { NextConfig } from "next";

/*
 * The version shown in the footer (FR-VER-1, D28).
 *
 * Resolved once, at build time, and inlined into the bundle as a
 * NEXT_PUBLIC_* value — there is nothing to read at runtime because the
 * version is a property of the commit the image was built from.
 *
 * CI derives it and passes it in as a build arg, because `.git` is
 * dockerignored: the container genuinely cannot work it out for itself. The
 * git fallback below is for `next dev` and `next build` on a developer's
 * machine, where the repository is right there.
 */
function appVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;

  try {
    return execFileSync("node", ["scripts/compute-version.mjs"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // No git and no build arg — an image built outside CI. Say so rather than
    // guessing a number, so a mislabelled deploy is obvious in the footer.
    return "0.0.0-dev";
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },

  // Small container images — plan §11.4. Emits .next/standalone with a
  // self-contained server.js and only the traced dependencies.
  output: "standalone",

  // sharp ships native binaries; keep it out of the bundler so the prebuilt
  // libvips binding resolves correctly at runtime.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
