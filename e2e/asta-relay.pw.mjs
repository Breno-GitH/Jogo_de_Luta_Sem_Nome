import{test,expect}from"@playwright/test";
import{mkdirSync,writeFileSync}from"node:fs";
const dir=process.env.ASTA_RELAY_EVIDENCE_DIR??"deployment/msfd-work/asta22-relay";mkdirSync(dir,{recursive:true});
const swords=["slayer","slasher","dweller","destroyer"],keys=["j","k","l"];
async function start(page){
 await page.goto("./",{waitUntil:"domcontentloaded"});await page.locator("#training").click();
 await page.getByRole("radio",{name:"Selecionar Asta",exact:true}).check();await page.locator("#confirm-character").click();
 await page.getByRole("radio",{name:"Selecionar Samurai",exact:true}).check();await page.locator("#confirm-character").click();await page.locator("#fight").click();
 await expect(page.locator("#app")).toHaveAttribute("data-screen","fight",{timeout:45000});const c=page.locator("canvas");
 await expect(c).toHaveAttribute("data-sheet",/^asta\//);await expect(c).toHaveAttribute("data-match-phase","fight",{timeout:45000});return c;
}
async function ready(page,initial){
 await page.locator("#reset-positions").click();await page.waitForTimeout(220);await page.locator("#asta-sword-0").selectOption(initial);
 await page.locator("canvas").focus();await page.keyboard.down("d");
 await page.waitForFunction(()=>{const d=document.querySelector("canvas").dataset;return Math.abs(+d.rootX-+d.rivalX)<=90;});await page.keyboard.up("d");
}
async function cast(page,key="l"){
 await page.keyboard.down("s");await page.waitForTimeout(45);await page.keyboard.up("s");await page.waitForTimeout(45);
 await page.keyboard.down("s");await page.keyboard.press(key,{delay:20});await page.keyboard.up("s");
}
async function record(page){
 await page.evaluate(()=>{
  const c=document.querySelector("canvas"),chunks=[],frames=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:"video/webm;codecs=vp8"});
  const state=window.relayMovie={chunks,frames,rec,active:true};rec.ondataavailable=e=>chunks.push(e.data);rec.start();let last="";
  function sample(){const d=c.dataset,key=[d.sheet,d.frame,d.astaRelayPhase,d.astaGrimoire].join("/");
   if(d.move==="astaDualBreak"&&d.physicsState==="attack"&&last!==key){
    frames.push({key,sword:d.astaSword,stage:d.astaStage,phase:d.astaRelayPhase,action:d.astaRelayAction,button:d.astaRelayButton,options:d.astaRelayOptions,contacts:d.astaRelayContacts,grimoire:d.astaGrimoire,from:d.astaDrawFrom,to:d.astaDrawTo,weapons:d.astaDrawnWeapons,png:c.toDataURL()});last=key;
   }if(state.active)requestAnimationFrame(sample);
  }sample();
 });
}
async function save(page,name){
 const{movie,frames}=await page.evaluate(()=>new Promise(resolve=>{
  const s=window.relayMovie;s.active=false;s.rec.onstop=()=>{const r=new FileReader();r.onload=()=>resolve({movie:r.result,frames:s.frames});r.readAsDataURL(new Blob(s.chunks,{type:"video/webm"}));};s.rec.stop();
 }));
 writeFileSync(dir+"/"+name+".webm",Buffer.from(movie.split(",")[1],"base64"));
 frames.forEach(({png},i)=>writeFileSync(dir+"/"+name+"-"+i+".png",Buffer.from(png.split(",")[1],"base64")));
 writeFileSync(dir+"/"+name+".json",JSON.stringify(frames.map(({png,...f})=>f),null,2));return frames;
}
test("Relay 2.2: all twelve real J/K/L routes, one choice and grimoire exchanges",async({page})=>{
 test.setTimeout(150000);const errors=[];page.on("pageerror",e=>errors.push(e.message));const c=await start(page);
 for(const initial of swords)for(const[index,key]of keys.entries()){
  const selected=swords.filter(s=>s!==initial)[index];await ready(page,initial);await record(page);await cast(page);
  await expect(c).toHaveAttribute("data-move","astaDualBreak");await expect(c).toHaveAttribute("data-asta-relay-phase","choice",{timeout:2500});
  expect(JSON.parse(await c.getAttribute("data-asta-relay-options"))).toEqual(swords.filter(s=>s!==initial));
  await page.keyboard.press(key,{delay:20});await expect(c).toHaveAttribute("data-asta-relay-phase","branch");await expect(c).toHaveAttribute("data-asta-sword",selected);
  await expect(c).toHaveAttribute("data-physics-state","idle",{timeout:5000});await expect(c).toHaveAttribute("data-asta-relay-phase","");
  const frames=await save(page,initial+"-"+key+"-"+selected);
  expect(new Set(frames.map(f=>f.action)).size).toBe(2);expect(frames.every(f=>f.weapons==="1")).toBe(true);
  expect(frames.some(f=>f.grimoire==="return")).toBe(true);expect(frames.some(f=>f.grimoire==="emerge")).toBe(true);
  expect(frames.some(f=>f.phase==="branch"&&f.sword===selected)).toBe(true);
 }
 expect(errors).toEqual([]);
});
test("Relay bodies with FX disabled and no automatic choice on timeout or guard",async({page})=>{
 test.setTimeout(65000);const c=await start(page);await page.locator("#asta-fx").uncheck();
 for(const[initial,key,selected]of[["slayer","j","slasher"],["slasher","j","slayer"],["dweller","l","destroyer"],["destroyer","l","dweller"]]){
  await ready(page,initial);await record(page);await cast(page);await expect(c).toHaveAttribute("data-asta-relay-phase","choice");await page.keyboard.press(key,{delay:20});
  await expect(c).toHaveAttribute("data-asta-sword",selected);await expect(c).toHaveAttribute("data-physics-state","idle");await save(page,"body-"+initial+"-"+selected);
 }
 for(const guard of[false,true]){
  await page.locator("#dummy").selectOption(guard?"guard":"idle");await ready(page,"slayer");await record(page);await cast(page);
  await page.waitForTimeout(1200);const frames=await save(page,guard?"guard":"timeout");
  expect(frames.every(f=>f.phase!=="branch")).toBe(true);await expect(c).toHaveAttribute("data-asta-sword","slayer");await expect(c).toHaveAttribute("data-physics-state","idle");
 }
});
