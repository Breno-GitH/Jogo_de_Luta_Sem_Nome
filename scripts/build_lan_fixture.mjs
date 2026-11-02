import{build}from"esbuild";
await build({entryPoints:["e2e/lan/fixtures.ts"],outfile:"deployment/run/lan-fixtures.mjs",bundle:true,platform:"node",format:"esm",target:"node22",packages:"external"});
