import balance from "../data/goku-specials.json";
import type { Fighter } from "./combat";
import type { Rect } from "./types";
import { poseAt } from "./moves";
export { balance as gokuBalance };
export interface KiBeam {
  id:number;owner:number;move:string;facing:number;x:number;y:number;length:number;radius:number;
  age:number;life:number;state:"active"|"dissipate";hitIds:number[];
}
export function beamBox(beam:KiBeam):Rect {
 return {x:beam.facing===1?beam.x:beam.x-beam.length,y:beam.y-beam.radius,w:beam.length,h:beam.radius*2};
}
export function gokuInvisible(f:Fighter) {
 return f.data.id==="goku" && f.state==="attack" && f.move?.special==="teleport" && f.stateFrame>=f.move.startup && f.stateFrame<f.move.startup+f.move.active;
}
export function canStartGokuSpecial(f:Fighter,id:string) {
 const move=f.data.specialMoves?.[id];if(!move)return false;
 const airAllowed=move.special==="teleport" && move.gokuStrength==="heavy";
 if(f.airborne && !airAllowed)return false;
 const free=["idle","walk","crouch","dash","landing",...(airAllowed?["air"]:[])].includes(f.state);
 if(move.special==="teleport")return free && f.gokuTeleportLock===0 && (!airAllowed || !f.gokuAirTeleportUsed);
 if(!free && !f.canSpecialCancel())return false;
 if(move.projectile && f.match && f.match.projectiles.filter(p=>p.owner===f.id && p.state!=="impact").length+move.projectile.releases.length>balance.projectiles.maximumPerOwner)return false;
 return true;
}
const clamp=(x:number)=>Math.max(40,Math.min(1240,x));
/** Validates the final position before assigning it. The medium crossing is
 * allowed only in range and when a complete pushbox fits behind the target. */
export function teleportDestination(f:Fighter) {
 const strength=f.move?.gokuStrength ?? "light",c=balance.teleport[strength],other=f.opponent!;
 let x=f.x+f.facing*c.distance,y=f.y;
 if(strength==="medium") {
  const medium=balance.teleport.medium,behind=other.x+f.facing*medium.distance;
  if(Math.abs(other.x-f.x)<=medium.targetRange && behind>=40 && behind<=1240)x=behind;
  else x=f.x+f.facing*medium.fallbackDistance;
 } else if(strength==="heavy")y=Math.max(balance.teleport.minimumAirY,Math.min(490,f.y-balance.teleport.heavy.height));
 x=clamp(x);
 if(Math.abs(y-other.y)<90) {
  if(strength!=="medium" && Math.sign(other.x-f.x)===f.facing && (x-other.x)*f.facing>-balance.teleport.separation)x=other.x-f.facing*balance.teleport.separation;
  if(Math.abs(x-other.x)<balance.teleport.separation) {
   const side=x<other.x?-1:1;
   x=other.x+side*balance.teleport.separation;
   if(x<40 || x>1240)x=other.x-side*balance.teleport.separation;
  }
 }
 return {x:clamp(x),y};
}
export function tickGokuMove(f:Fighter) {
 if(f.data.id!=="goku" || f.state!=="attack" || f.move?.special!=="teleport")return;
 const move=f.move;
 if(f.stateFrame===move.startup+move.active) {
  const destination=teleportDestination(f);f.x=destination.x;f.y=destination.y;f.vx=0;
  if(move.gokuStrength==="heavy"){f.vy=-3;f.gokuAirTeleportUsed=true;}
  else f.vy=0;
  f.facing=f.opponent!.x>=f.x?1:-1;
  f.gokuTeleportLock=balance.teleport[move.gokuStrength!].lockTicks;
 }
}
export function beamOrigin(f:Fighter) {
 const hand=poseAt(f.move!,f.stateFrame)?.release ?? {x:52,y:-80};
 return {x:f.x+hand.x*f.facing,y:f.y+hand.y};
}
