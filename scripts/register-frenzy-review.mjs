import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const freeze=JSON.parse(readFileSync("art/goku/rebuild/physics-freeze.json","utf8"));
const previous=JSON.parse(readFileSync("deployment/audit/preserved-game.json","utf8"));
const reasons={
 "src/engine/moves.ts":"Resolve authored pose/hurtbox indices through the shared piecewise timing clock; active contact drawings remain unchanged.",
 "src/engine/stand-combat.ts":"Synchronise The World's authored approach, punch geometry and return using the same remapped owner timing as its sprite animation.",
 "src/render/dio-motion.ts":"Map the existing jump anticipation and landing drawings over the new physical durations; retain all approved images and trajectory-based phase selection.",
 "src/engine/bot.ts":"Use the universal R input for Goku's Super while retaining delayed perception and character-specific AI.",
 "src/engine/characters.ts":"Apply the shared, data-configured pace overlay to the existing three characters; preserve authored sprite/attack geometry data.",
 "src/engine/combat.ts":"Universal R/cost/state gates; confirmed vs blocked cancels, one reverse beat, longer finite juggle limits, aerial teleport resource/physics and impact feedback. Existing three cinematic sequences retained.",
 "src/engine/types.ts":"Optional visualTiming and airTeleport data; a timing bridge maps unchanged authored drawings/hit geometry to new fixed-tick durations.",
 "src/engine/input.ts":"Remove directional Super recognition; suppress repeated held keys; recognise two real down tap edges during hitstop.",
 "src/engine/state.ts":"Explicitly serialize hit confirmation, reverse-beat use and aerial teleport counter for authoritative replay/checkpoint recovery."
};
const hash=p=>createHash("sha256").update(readFileSync(p)).digest("hex");
const files=Object.fromEntries(Object.entries(reasons).map(([p,reason])=>[p,{baseline:freeze.files[p],previous:previous[p],current:hash(p),reason}]));
const sprites=Object.entries(previous).filter(([p])=>p.startsWith("public/sprites/"));
const changed=sprites.filter(([p,h])=>hash(p)!==h).map(([p])=>p);
if(changed.length)throw Error("Approved sprite changed: "+changed.join(","));
writeFileSync("deployment/audit/frenzy-shared-engine-revisions.json",JSON.stringify({request:"User explicitly requested universal frenetic combat, R-only Supers and aerial teleport; preserve approved sprites/cinematic contents",originalFreeze:"art/goku/rebuild/physics-freeze.json",files},null,2)+"\n");
writeFileSync("deployment/audit/frenzy-sprite-preservation.json",JSON.stringify({checked:sprites.length,changed,date:new Date().toISOString()},null,2)+"\n");
console.log("Exact authorised engine revisions recorded; approved sprite files unchanged:",sprites.length);
