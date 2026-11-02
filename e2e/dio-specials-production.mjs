import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='http://127.0.0.1:3001',qa='art/dio/qa/specials';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const epoch=new Date('2026-10-30T12:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(epoch.getTime()+60000));
  await page.goto(base+'/art/dio-specials.html');
  await page.waitForFunction(()=>document.querySelector('#arena').dataset.loaded==='true');
  const c=page.locator('#arena'),cases=[];
  for(const enemy of ['samurai','dio'])for(const type of ['knives','rush'])for(const[strength,count]of [['light',type==='knives'?1:4],['medium',type==='knives'?2:7],['heavy',type==='knives'?3:10]]){
    await page.selectOption('#scenario',type+'_'+strength);await page.selectOption('#opponent',enemy);await page.locator('#reset').click();await page.locator('#execute').click();await page.clock.runFor(3000);
    assert.equal(await c.getAttribute('data-hits'),String(count));assert.equal(await c.getAttribute('data-projectiles'),'0');assert.equal(await c.getAttribute('data-owner-stand-state'),'follow');
    cases.push({enemy,type,strength,hits:count});
  }
  await page.selectOption('#scenario','time_stop');await page.locator('#reset').click();await page.locator('#cast').click();await page.clock.runFor(650);
  const before=await c.evaluate(n=>({...n.dataset}));assert.ok(Number(before.timeRemaining)>80);
  await c.focus();await page.keyboard.down('a');await page.clock.runFor(350);await page.keyboard.up('a');
  const after=await c.evaluate(n=>({...n.dataset}));assert.equal(after.enemyX,before.enemyX);assert.equal(after.enemyTick,before.enemyTick);assert.equal(after.targetFrame,before.targetFrame);assert.notEqual(after.playerX,before.playerX);
  await page.clock.runFor(2300);assert.equal(await c.getAttribute('data-time-uses'),'1');
  await page.locator('#fast-cooldown').click();assert.equal(await c.getAttribute('data-time-cooldown'),'0');await page.locator('#pause').click();await page.locator('#cast').click();await page.clock.runFor(2600);
  assert.equal(await c.getAttribute('data-time-uses'),'2');assert.ok(Number(await c.getAttribute('data-time-cooldown'))>1700);
  await page.locator('#round').click();assert.equal(await c.getAttribute('data-round'),'2');assert.equal(await c.getAttribute('data-time-uses'),'2');
  await page.locator('#reset').click();assert.equal(await c.getAttribute('data-time-uses'),'0');
  await page.goto(base+'/');await page.locator('#training').click();await page.getByRole('radio',{name:'Selecionar Dio Brando'}).check();await page.locator('#fight').click();
  const main=page.locator('canvas').first();await page.waitForFunction(()=>document.querySelector('#app').dataset.screen==='fight');
  await page.keyboard.down('s');await page.clock.runFor(50);await page.keyboard.down('d');await page.clock.runFor(50);await page.keyboard.up('s');await page.keyboard.press('j');await page.clock.runFor(17);await page.keyboard.up('d');
  assert.equal(await main.getAttribute('data-move'),'knives_light');await page.clock.runFor(1300);assert.ok(Number(await page.locator('#total-damage').textContent())>0);
  await page.keyboard.down('d');await page.clock.runFor(50);await page.keyboard.down('s');await page.clock.runFor(50);await page.keyboard.up('d');await page.keyboard.press('l');await page.clock.runFor(17);await page.keyboard.up('s');
  assert.equal(await main.getAttribute('data-move'),'time_stop');await page.clock.runFor(500);assert.equal(await main.getAttribute('data-time-uses'),'1');
  await page.keyboard.press('Escape');const remaining=await main.getAttribute('data-time-remaining');await page.clock.runFor(1500);assert.equal(await main.getAttribute('data-time-remaining'),remaining);await page.keyboard.press('Escape');
  await page.clock.runFor(2600);assert.ok(Number(await main.getAttribute('data-time-cooldown'))>0);await page.locator('#restart').click();await page.clock.runFor(50);assert.equal(await main.getAttribute('data-time-uses'),'0');
  for(const file of ['downloads/dio-specials.zip','sprites/dio/knives_heavy.png','sprites/the-world/mudaHeavy.png','sprites/fx/dio-specials.png']){
    const response=await page.request.get(base+'/'+file);assert.equal(response.status(),200);assert.ok((await response.body()).equals(fs.readFileSync('public/'+file)),file);
  }
  const health=await (await page.request.get(base+'/health')).json();const version=fs.readFileSync('src/net/version.ts','utf8').match(/ENGINE_VERSION = "([^"]+)"/)[1];assert.equal(health.version,version);
  assert.deepEqual(errors,[]);fs.writeFileSync(qa+'/production-results.json',JSON.stringify({origin:base,cases,mainKeyboard:true,freeze:true,cooldownProgression:true,roundPersistence:true,newMatchReset:true,downloadsByteIdentical:true,version,errors},null,2));
  console.log('Production: 12 special variants versus both characters, main keyboard, freeze, pause, recharge, round persistence, new-match reset and exact exported files passed.');
}finally{await browser.close();}
