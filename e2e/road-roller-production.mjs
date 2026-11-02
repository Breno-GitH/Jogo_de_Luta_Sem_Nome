import{chromium}from'@playwright/test';
import assert from'node:assert/strict';
import fs from'node:fs';
const base='http://127.0.0.1:3001',qa='art/dio/qa/road-roller';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const epoch=new Date('2026-10-30T12:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(epoch.getTime()+60000));
 await page.goto(base+'/art/road-roller.html');await page.waitForFunction(()=>document.querySelector('#arena').dataset.loaded==='true');const c=page.locator('#arena');
 const results=[];
 for(const enemy of['samurai','dio'])for(const mirror of[false,true]){
  await page.selectOption('#opponent',enemy);await page.locator('#mirror').setChecked(mirror);await page.locator('#run').click();await page.clock.runFor(7000);
  assert.equal(await c.getAttribute('data-damage'),'350');assert.equal(await c.getAttribute('data-hits'),'15');assert.equal(await c.getAttribute('data-meter'),'0');assert.equal(await c.getAttribute('data-camera-zoom'),'1');assert.equal(await c.getAttribute('data-stand-state'),'follow');results.push({enemy,mirror,damage:350});
 }
 await page.locator('#mirror').uncheck();await page.selectOption('#energy','199');await page.locator('#run').click();await page.clock.runFor(2500);assert.equal(await c.getAttribute('data-seen'),'false');assert.equal(await c.getAttribute('data-meter'),'199');
 await page.selectOption('#energy','200');await page.selectOption('#scenario','block');await page.locator('#run').click();await page.clock.runFor(2500);assert.equal(await c.getAttribute('data-blocks'),'1');assert.equal(await c.getAttribute('data-seen'),'false');
 await page.selectOption('#scenario','ko');await page.locator('#run').click();await page.clock.runFor(6500);assert.equal(await c.getAttribute('data-match-phase'),'roundEnd');assert.equal(await c.getAttribute('data-target-health'),'0');assert.equal(await c.getAttribute('data-camera-zoom'),'1');
 await page.selectOption('#scenario','hit');await page.locator('#rematch').click();assert.equal(await c.getAttribute('data-meter'),'200');assert.equal(await c.getAttribute('data-time-uses'),'0');
 await page.locator('#time-history').click();assert.equal(await c.getAttribute('data-time-uses'),'1');await page.locator('#execute').click();await page.locator('#pause').click();await page.clock.runFor(800);assert.equal(await c.getAttribute('data-capture'),'roadRoller');
 const cooldown=await c.getAttribute('data-time-cooldown');await page.clock.runFor(3500);assert.equal(await c.getAttribute('data-time-cooldown'),cooldown);await page.clock.runFor(2200);assert.equal(await c.getAttribute('data-time-uses'),'1');
 await page.goto(base+'/');await page.locator('#training').click();await page.getByRole('radio',{name:'Selecionar Dio Brando'}).check();await page.locator('#fight').click();await page.clock.runFor(50);await page.locator('#unlimited-meter').uncheck();const main=page.locator('canvas').first();
 assert.equal(await main.getAttribute('data-meter'),'200');await main.focus();await page.keyboard.down('d');
 for(let i=0;i<70;i++){await page.clock.runFor(100);if(Number(await main.getAttribute('data-target-x'))-Number(await main.getAttribute('data-player-x'))<90)break;}
 await page.keyboard.up('d');await page.clock.runFor(50);
 await page.keyboard.press('r');await page.clock.runFor(34);
 assert.equal(await main.getAttribute('data-move'),'road_roller');assert.equal(await main.getAttribute('data-meter'),'0');await page.clock.runFor(2800);assert.equal(await main.getAttribute('data-capture'),'roadRoller');
 fs.writeFileSync(qa+'/production-main.png',Buffer.from((await main.evaluate(n=>n.toDataURL('image/png'))).split(',')[1],'base64'));
 await page.keyboard.press('Escape');const tick=await main.getAttribute('data-road-tick');await page.clock.runFor(1800);assert.equal(await main.getAttribute('data-road-tick'),tick);await page.keyboard.press('Escape');await page.clock.runFor(5000);
 assert.equal(await main.getAttribute('data-camera-zoom'),'1');assert.equal(await main.getAttribute('data-capture'),'none');assert.ok(Number(await page.locator('#total-damage').textContent())>=350);
 for(const file of['downloads/road-roller.zip','sprites/dio/roadFlyingUp.png','sprites/the-world/roadBarrage.png','sprites/road-roller/roadBase.png','sprites/road-fx/explosion.png']){const response=await page.request.get(base+'/'+file);assert.equal(response.status(),200);assert.ok((await response.body()).equals(fs.readFileSync('public/'+file)),file);}
 const health=await(await page.request.get(base+'/health')).json(),version=fs.readFileSync('src/net/version.ts','utf8').match(/ENGINE_VERSION = "([^"]+)"/)[1];assert.equal(health.version,version);assert.deepEqual(errors,[]);
 fs.writeFileSync(qa+'/production-results.json',JSON.stringify({origin:base,results,insufficientMeter:true,block:true,ko:true,rematch:true,cooldownPreserved:true,mainKeyboardConfirmed:true,pause:true,cameraRestored:true,exactAssets:true,version,errors},null,2));
 console.log('Production Road Roller: both opponents/facings, meter, block, KO, rematch, cooldown, main keyboard confirmation, pause, camera and exact exported assets passed.');
}finally{await browser.close();}
