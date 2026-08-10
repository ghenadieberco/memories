import { build } from "esbuild";

/*
 * Bundles db/migrate.ts into a single self-contained dist/migrate.mjs.
 *
 * Why bundle at all: fly.toml runs the migration as a release command inside
 * the runtime image, but `output: 'standalone'` only traces what the Next app
 * itself imports. The migrator and tsx are not in there, so the release command
 * would fail on first deploy.
 *
 * The banner matters: pg is CommonJS and calls `require("events")` at load. ESM
 * output has no `require`, so without this shim the bundle throws
 * "Dynamic require of \"events\" is not supported" the moment it runs. ESM (not
 * CJS) because migrate.ts uses top-level await.
 */

await build({
  entryPoints: ["db/migrate.ts"],
  outfile: "dist/migrate.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  external: ["pg-native", "cloudflare:sockets"],
  logLevel: "info",
});
