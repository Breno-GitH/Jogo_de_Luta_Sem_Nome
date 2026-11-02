import { build } from "esbuild";
await build({
  entryPoints: ["server/index.ts"],
  outfile: "server-dist/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
});
await build({
  entryPoints: ["server/server.ts"],
  outfile: "server-dist/server-core.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
});
