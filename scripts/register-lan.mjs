import{readFileSync,writeFileSync}from"node:fs";
const p=JSON.parse(readFileSync("package.json","utf8"));p.scripts["build:lan"]="node scripts/build-lan.mjs";p.scripts["start:lan"]="node scripts/start-lan.mjs";p.scripts["test:lan"]="playwright test --config playwright.lan.config.mjs";writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");
