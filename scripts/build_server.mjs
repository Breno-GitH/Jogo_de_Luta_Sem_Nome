import { build } from "esbuild";
import path from "node:path";

const output = process.argv[2] ?? "server-dist";
await build({
  entryPoints: ["server/index.ts"],
  outfile: path.join(output, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
});
await build({
  entryPoints: ["server/server.ts"],
  outfile: path.join(output, "server-core.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
});
