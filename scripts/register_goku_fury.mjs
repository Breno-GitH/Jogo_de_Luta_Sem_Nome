import {readFileSync,writeFileSync}from"node:fs";
const p=JSON.parse(readFileSync("package.json","utf8"));
if(!p.scripts.test.includes("test_goku_fury_art.py"))p.scripts.test+=" && node scripts/run_art.mjs tests/test_goku_fury_art.py";
p.scripts["art:goku:fury"]="node scripts/run_art.mjs scripts/configure_goku_fury.py && node scripts/run_art.mjs scripts/goku_fury_art.py && node scripts/run_art.mjs scripts/goku_fury_contacts.py && node scripts/run_art.mjs scripts/build_goku_fury_fx.py";
writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");
