import {chromium,expect} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
const out=process.env.ASTA_LIVE_EVIDENCE_DIR??"deployment/msfd-work/asta-super-live";
const url="http://localhost/2025/M.S.F.D/";mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 const a=await browser.newPage({viewport:{width:1440,height:1100}}),b=await browser.newPage({viewport:{width:1440,height:1100}});
 for(const p of[a,b]){await p.goto(url,{waitUntil:"domcontentloaded"});await p.locator("#online").click();await expect(p.locator("#app")).toHaveAttribute("data-connection","connected");}
 await a.locator("#create-room").click();const code=(await a.locator("#lobby-code").innerText()).trim();
 await b.locator("#room-code").fill(code);await b.locator("#join-room").click();await expect(b.locator("#lobby-code")).toHaveText(code);
 for(const[p,id]of[[a,"asta"],[b,"samurai"]]){await p.locator("#online-"+id).check();await p.locator("#online-confirm").click();await p.locator("#online-ready").click();}
 await a.locator("#online-start").click();
 for(const p of[a,b]){
  await expect(p.locator("canvas")).toHaveAttribute("data-match-phase","fight",{timeout:20000});
  await p.evaluate(()=>{window.liveTicks={};new MutationObserver(()=>{const d=document.querySelector("#app").dataset;if(d.netTick&&d.netHash)window.liveTicks[d.netMatch+":"+d.netTick]=d.netHash;}).observe(document.querySelector("#app"),{attributes:true});});
 }
 async function ready(){await a.waitForFunction(()=>{const d=document.querySelector("canvas").dataset;return["idle","walk","crouch"].includes(d.physicsState)&&["idle","walk","crouch"].includes(d.targetState);},null,{timeout:7000});}
 async function approach(){
  const d=await a.locator("canvas").evaluate(c=>({...c.dataset}));const gap=Math.abs(+d.playerX- +d.targetX),side=+d.playerX<+d.targetX?"d":"a";
  if(gap>66){await a.locator("canvas").focus();await a.keyboard.down(side);await a.waitForTimeout(Math.min(1500,(gap-65)/6.2*1000/60));await a.keyboard.up(side);}
 }
 await a.locator("canvas").focus();let strikes=0;
 while(+(await a.locator("canvas").getAttribute("data-meter"))<100&&strikes<20){
  await ready();await approach();await a.keyboard.press("j",{delay:40});await a.waitForTimeout(520);strikes++;
 }
 await ready();await approach();await expect(a.locator("canvas")).toHaveAttribute("data-meter","100");
 const before=+(await a.locator("canvas").getAttribute("data-p2-health"));expect(before).toBeGreaterThan(340);
 await a.evaluate(()=>{
  const c=document.querySelector("canvas"),chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:"video/webm;codecs=vp8"});
  const s=window.liveMovie={chunks,rec,frames:[],active:true};rec.ondataavailable=e=>chunks.push(e.data);rec.start();
  const seen=new Set();function poll(){const d={...c.dataset},t=+d.astaUnionTick;
   let key=t>=0?d.astaUnionPhase:d.move==="astaBlackMeteorite"?"opener":"";
   if(t>=230&&t<=233)key="impact";
   if(key&&!seen.has(key)){seen.add(key);s.frames.push({key,png:c.toDataURL(),state:d});}
   if(s.active)requestAnimationFrame(poll);
  }poll();
 });
 await a.keyboard.press("r",{delay:40});
 for(const p of[a,b])await expect(p.locator("canvas")).toHaveAttribute("data-capture","astaUnion");
 await expect(a.locator("canvas")).toHaveAttribute("data-capture","none",{timeout:9000});
 for(const p of[a,b]){
  await expect(p.locator("canvas")).toHaveAttribute("data-p2-health",String(before-340));
  await expect(p.locator("canvas")).toHaveAttribute("data-asta-form","base");
 }
 await expect(a.locator("canvas")).toHaveAttribute("data-asta-sword","slasher");await expect(a.locator("canvas")).toHaveAttribute("data-meter","0");
 await a.waitForTimeout(700);await a.keyboard.press("d",{delay:100});
 const x=await a.evaluate(()=>window.liveTicks),y=await b.evaluate(()=>window.liveTicks),common=Object.keys(x).filter(k=>y[k]);
 expect(common.length).toBeGreaterThan(250);expect(common.every(k=>x[k]===y[k])).toBe(true);
 const resyncs=await Promise.all([a,b].map(p=>p.locator("#app").getAttribute("data-resyncs")));expect(resyncs).toEqual(["0","0"]);
 const data=await a.evaluate(()=>new Promise(resolve=>{const s=window.liveMovie;s.active=false;s.rec.onstop=()=>{const r=new FileReader();r.onload=()=>resolve({video:r.result,frames:s.frames});r.readAsDataURL(new Blob(s.chunks,{type:"video/webm"}));};s.rec.stop();}));
 writeFileSync(out+"/apache-live.webm",Buffer.from(data.video.split(",")[1],"base64"));
 for(const f of data.frames)writeFileSync(out+"/apache-"+f.key+".png",Buffer.from(f.png.split(",")[1],"base64"));
 const clients=[];for(const[i,p]of[a,b].entries()){const d=await p.locator("canvas").evaluate(c=>({png:c.toDataURL(),state:{...c.dataset}}));writeFileSync(out+"/lan-p"+(i+1)+".png",Buffer.from(d.png.split(",")[1],"base64"));clients.push(d.state);}
 const build=await(await a.request.get(url+"build-info.json")).json();const result={url,build,strikes,healthBefore:before,healthAfter:before-340,commonTicks:common.length,hashesEqual:true,resyncs,clients,frames:data.frames.map(({png,...f})=>f)};
 writeFileSync(out+"/lan-live.json",JSON.stringify(result,null,2));console.log(JSON.stringify({commit:build.commit,version:build.version,strikes,before,after:before-340,commonTicks:common.length,hashesEqual:true,resyncs}));
 await a.locator("#pause").click();await a.locator("#pause-menu").click();await a.locator("#confirm-leave").click();
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
