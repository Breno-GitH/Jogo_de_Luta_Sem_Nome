// Production check and real fixed-tick release recording. Requires npm start.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = "http://127.0.0.1:3001";
const qa = "art/dio/qa/stand-only";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const epoch = new Date('2026-10-30T12:00:00Z');
  await page.clock.install({time:epoch});
  await page.clock.pauseAt(new Date(epoch.getTime()+60000));
  await page.goto(base+'/art/dio-combat.html');
  const c = page.locator('#arena');
  await page.waitForFunction(()=>document.querySelector('#arena').dataset.loaded==='true');
  const results=[];
  for (const enemy of ['samurai','dio']) {
    await page.selectOption('#opponent',enemy);
    for (const [name,hits] of [['stand_light',1],['stand_medium',1],['stand_heavy',1],['crouch_light',1],['crouch_medium',1],['crouch_heavy',1],['air_light',1],['air_medium',2],['air_heavy',1],['groundCombo',3],['crouchCombo',3],['airChain',4],['airCombo',5]]) {
      await page.selectOption('#scenario',name);
      await page.locator('#run').click();
      await page.clock.runFor(3500);
      assert.equal(await c.getAttribute('data-done'),'true',`${enemy}:${name}`);
      assert.equal(await c.getAttribute('data-hits'),String(hits),`${enemy}:${name}`);
      assert.equal(await c.getAttribute('data-stand-mode'),'follow');
      assert.equal(await c.getAttribute('data-stand-boxes'),'0');
      results.push({enemy,name,hits,damage:await c.getAttribute('data-damage')});
    }
  }
  await page.selectOption('#opponent','samurai');
  await page.selectOption('#zoom','2');
  await page.locator('#boxes').uncheck();
  await page.selectOption('#scenario','groundCombo');
  await page.locator('#run').click();
  await page.locator('#pause').click();
  const out=qa+'/combo-recording';
  fs.mkdirSync(out,{recursive:true});
  for(const file of fs.readdirSync(out)) if(/^\d{3}\.png$/.test(file)) fs.unlinkSync(`${out}/${file}`);
  const trace=[];
  for(let i=0;i<120;i++) {
    await page.locator('#step').click();
    fs.writeFileSync(`${out}/${String(i).padStart(3,'0')}.png`,Buffer.from((await c.evaluate(n=>n.toDataURL('image/png'))).split(',')[1],'base64'));
    trace.push(await c.evaluate(n=>({...n.dataset})));
    if(trace.at(-1).done==='true') break;
  }
  assert.equal(trace[0].phase,'startup');
  assert.equal(trace.at(-1).maxCombo,'3');
  assert.equal(trace.at(-1).standMode,'follow');
  fs.writeFileSync(qa+'/combo-trace.json',JSON.stringify(trace,null,2));
  for(const path of ['/downloads/dio-normal-attacks.zip','/sprites/the-world/airDoublePunch.png','/sprites/dio/commandPoint.png']) assert.equal((await page.request.get(base+path)).status(),200);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(qa+'/production-results.json',JSON.stringify({origin:base,tests:results,errors,recordedFixedTicks:trace.length},null,2));
  console.log(`Production: 18 isolated attacks, 8 combos, no ghost hitboxes, downloads and ${trace.length} fixed-tick Canvas captures passed.`);
} finally { await browser.close(); }
