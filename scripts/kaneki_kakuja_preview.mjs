import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const pixels = name => readFile(name).then(data=>"data:image/png;base64,"+data.toString("base64"));
const js = await build({entryPoints:["scripts/kaneki_kakuja_preview.ts"],bundle:true,write:false,platform:"browser"});
const browser=await chromium.launch({channel:"chrome"});
try {
  const page=await browser.newPage();
  await page.addScriptTag({content:js.outputFiles[0].text});
  const args=await Promise.all([
    pixels("public/sprites/kaneki/idle.png"),
    pixels("public/sprites/kaneki/centipede-transformation.png"),
    readFile("art/kaneki-centipede-source/kakuja-back.json","utf8").then(text=>JSON.parse(text.replace(/^\uFEFF/,"")).transformation[4]),
  ]);
  const out=await page.evaluate(async ([base,body,back])=>{
    await window.renderKakujaPreview(base,body,back);
    return [...document.querySelectorAll("canvas")].map(canvas=>canvas.toDataURL().split(",")[1]);
  },args);
  await writeFile("public/previews/kaneki/kakuja-v2-preview.png",Buffer.from(out[0],"base64"));
  await writeFile("public/previews/kaneki/kakuja-v2-tentaculos.png",Buffer.from(out[1],"base64"));
} finally {await browser.close();}

