import {chromium,expect}from"@playwright/test";
import{mkdirSync,writeFileSync}from"node:fs";
const out="deployment/msfd-work/asta-super-modes",url=process.env.MSFD_TEST_URL??"http://localhost/2025/M.S.F.D/";mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});const results=[];
try{
 for(const mode of["arcade","versus"]){
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on("pageerror",e=>errors.push(e.message));
  await p.goto(url,{waitUntil:"domcontentloaded"});await p.locator("#"+mode).click();
  await p.getByRole("radio",{name:"Selecionar Asta",exact:true}).check();await p.locator("#confirm-character").click();
  if(mode!=="arcade"){await p.getByRole("radio",{name:"Selecionar Samurai",exact:true}).check();await p.locator("#confirm-character").click();}
  if(await p.locator("#difficulty").count())await p.locator("#difficulty").selectOption("easy");
  await p.locator("#fight").click();const c=p.locator("canvas");await expect(c).toHaveAttribute("data-match-phase","fight",{timeout:25000});
  await p.evaluate(()=>{
   const c=document.querySelector("canvas"),chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:"video/webm;codecs=vp8"});const s=window.modeSuper={frames:[],rec,chunks,active:true,confirmed:false};rec.ondataavailable=e=>chunks.push(e.data);rec.start();const seen=new Set();
   function poll(){const d={...c.dataset},phase=d.astaUnionPhase;if(+d.astaUnionTick>=0){s.confirmed=true;if(!seen.has(phase)){seen.add(phase);s.frames.push({phase,png:c.toDataURL(),state:d});}}if(s.active)requestAnimationFrame(poll);}poll();
  });
  await c.focus();const deadline=Date.now()+80000;let attempts=0;
  while(Date.now()<deadline&&!await p.evaluate(()=>window.modeSuper.confirmed)){
   const d=await c.evaluate(c=>({...c.dataset}));
   if(d.matchPhase!=="fight"){await p.waitForTimeout(800);continue;}
   if(!["idle","walk","crouch","attack"].includes(d.physicsState)){await p.waitForTimeout(120);continue;}
   const gap=Math.abs(+d.playerX- +d.targetX),side=+d.playerX<+d.targetX?"d":"a";
   if(gap>75&&d.physicsState!=="attack"){await p.keyboard.down(side);await p.waitForTimeout(Math.min(500,(gap-60)/6.2*1000/60));await p.keyboard.up(side);}
   if(+d.meter>=100){await p.keyboard.press("k",{delay:25});await p.waitForTimeout(230);await p.keyboard.press("r",{delay:35});attempts++;await p.waitForTimeout(350);}
   else{await p.keyboard.press(attempts%3?"j":"k",{delay:30});await p.waitForTimeout(360);attempts++;}
  }
  expect(await p.evaluate(()=>window.modeSuper.confirmed)).toBe(true);
  await expect(c).toHaveAttribute("data-capture","none",{timeout:9000});
  const data=await p.evaluate(()=>new Promise(resolve=>{const s=window.modeSuper;s.active=false;s.rec.onstop=()=>{const r=new FileReader();r.onload=()=>resolve({video:r.result,frames:s.frames});r.readAsDataURL(new Blob(s.chunks,{type:"video/webm"}));};s.rec.stop();}));
  writeFileSync(out+"/"+mode+".webm",Buffer.from(data.video.split(",")[1],"base64"));
  for(const f of data.frames)writeFileSync(out+"/"+mode+"-"+f.phase+".png",Buffer.from(f.png.split(",")[1],"base64"));
  const state=await c.evaluate(c=>({...c.dataset}));results.push({mode,attempts,errors,state,phases:data.frames.map(f=>f.phase)});expect(errors).toEqual([]);await p.close();console.log(mode+" Super completed");
 }
 writeFileSync(out+"/results.json",JSON.stringify(results,null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
