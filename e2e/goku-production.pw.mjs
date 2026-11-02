import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.skip(process.env.GOKU_PRODUCTION !== "1", "Use playwright.goku-production.config.mjs with the compiled server running.");
const base="http://localhost/jogo-luta",qa="art/goku/rebuild/qa/production";
fs.mkdirSync(qa,{recursive:true});
test("compiled server serves the exact rebuilt assets and drives every Goku movement on both sides",async({page})=>{
 test.setTimeout(120000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const epoch=new Date("2026-11-01T12:00:00Z");await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(epoch.getTime()+60000));
 await page.goto(base+"/art/goku.html?rebuild=5");const c=page.locator("#arena");await expect(c).toHaveAttribute("data-loaded","true");await page.clock.runFor(34);await expect(c).toHaveAttribute("data-revision","5");
 const manifest=JSON.parse(fs.readFileSync("public/sprites/goku/movement.json","utf8"));
 for(const mirror of[false,true]){
  if(mirror){await page.locator("#flip").click();await page.clock.runFor(34);}
  for(const key of["d","a"]){await c.focus();await page.keyboard.down(key);await page.clock.runFor(200);await expect(c).toHaveAttribute("data-animation",(key==="d")!==mirror?"walkForward":"walkBack");await page.keyboard.up(key);await page.clock.runFor(150);await expect(c).toHaveAttribute("data-animation","idle");}
  await page.keyboard.down("s");await page.clock.runFor(250);await expect(c).toHaveAttribute("data-animation","crouchIdle");await page.keyboard.up("s");await page.clock.runFor(200);await expect(c).toHaveAttribute("data-animation","idle");
  for(const dir of["","d","a"]){if(dir)await page.keyboard.down(dir);await page.keyboard.press("w");await page.clock.runFor(250);expect(await c.getAttribute("data-animation")).toMatch(/^jumpRise/);expect(Number(await c.getAttribute("data-root-y"))).toBeLessThan(580);await page.clock.runFor(1000);if(dir)await page.keyboard.up(dir);await page.clock.runFor(180);await expect(c).toHaveAttribute("data-animation","idle");await expect(c).toHaveAttribute("data-root-y","580");}
  for(const key of["d","a"]){await page.keyboard.down(key);await page.keyboard.down("Shift");await page.clock.runFor(34);expect(await c.getAttribute("data-animation")).toMatch(/^(dashForward|backdash)$/);await page.keyboard.up(key);await page.keyboard.up("Shift");await page.clock.runFor(400);await expect(c).toHaveAttribute("data-animation","idle");}
 }
 for(const[key,meta]of Object.entries(manifest.clips)){
  await page.selectOption("#animation",key);await page.getByRole("button",{name:`Quadro ${meta.count}`,exact:true}).click();await expect(c).toHaveAttribute("data-frame",String(meta.count-1));
  const path="sprites/goku/"+meta.sheet,response=await page.request.get(base+"/"+path);expect(response.status()).toBe(200);expect((await response.body()).equals(fs.readFileSync("public/"+path)),path).toBe(true);
 }
 await page.selectOption("#animation","idle");await page.getByRole("button",{name:"Quadro 1",exact:true}).click();await page.locator("#compare").check();await page.locator("#landmarks").check();await expect(c).toHaveAttribute("data-compare","true");
 fs.writeFileSync(`${qa}/comparison.png`,Buffer.from((await c.evaluate(n=>n.toDataURL())).split(",")[1],"base64"));
 for(const path of["sprites/goku/movement.json","downloads/goku-movement.zip","previews/goku-rebuild-gameplay.png","previews/goku-rebuild-gameplay.gif"]){const r=await page.request.get(base+"/"+path);expect(r.status()).toBe(200);expect((await r.body()).equals(fs.readFileSync("public/"+path)),path).toBe(true);}
 const health=await(await page.request.get(base+"/api/health")).json(),version=fs.readFileSync("src/net/version.ts","utf8").match(/ENGINE_VERSION = "([^"]+)"/)[1];expect(health.version).toBe(version);expect(errors).toEqual([]);expect(await page.locator("#error").textContent()).toBe("");
 fs.writeFileSync(`${qa}/results.json`,JSON.stringify({base,version,revision:5,clips:Object.keys(manifest.clips).length,exactAssets:true,bothFacings:true,allMovement:true,comparison:true,errors},null,2));
});
