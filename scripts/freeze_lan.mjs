import{readdirSync,readFileSync,writeFileSync,existsSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
const out="deployment/audit/preserved-game.json";mkdirSync("deployment/audit",{recursive:true});
if(!existsSync(out)){const files={};function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=dir+"/"+e.name;if(e.isDirectory())walk(p);else files[p]=createHash("sha256").update(readFileSync(p)).digest("hex");}}for(const p of["src/engine","src/data","public/sprites"])walk(p);writeFileSync(out,JSON.stringify(files,null,2)+"\n");}
console.log("Preserved",Object.keys(JSON.parse(readFileSync(out,"utf8"))).length,"combat/data/sprite files");
