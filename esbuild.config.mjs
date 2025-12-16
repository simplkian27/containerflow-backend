import { build } from "esbuild";
import { config as loadEnv } from "dotenv";

loadEnv();

const isProd = process.env.NODE_ENV === "production";

await build({
  entryPoints: ["server/index.ts"],
  outdir: "server_dist",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  sourcemap: !isProd,
  minify: isProd,
  logLevel: "info",
  banner: {
    js: `
import { createRequire } from "module";
const require = createRequire(import.meta.url);
`
  }
});
