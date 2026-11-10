import type { Match } from "../engine/combat";
import { centipedeConfig, centipedeEase, centipedeScene, type CentipedeState } from "../engine/kaneki-centipede";
import { fillPixels } from "./pixel-contour";

type Scene = ReturnType<typeof centipedeScene>;

export function drawCentipedeBackdrop(c: CanvasRenderingContext2D, scene: Scene) {
  c.save();
  c.globalAlpha = .17 * scene.armor;
  c.fillStyle = "#942838";
  c.fillRect(-900,-900,3200,2400);
  if (scene.phase === "wall") {
    // Cinematic contact plane at the existing arena limit.
    const x = scene.wall, inward = x === 40 ? 1 : -1;
    c.globalAlpha = .77;
    c.fillStyle = "#211b2b";
    c.fillRect(inward > 0 ? x-65 : x, -230, 65, 810);
    c.fillStyle = "#50313c";
    c.fillRect(Math.min(x,x-inward*7),-230,7,810);
    for (let y=-216;y<580;y+=52) {
      c.fillStyle = y % 3 ? "#362b39" : "#70424b";
      c.fillRect(Math.min(x,x-inward*54),y,54,2);
      c.fillRect(x-inward*(inward>0?22:18),y+5,4,21);
    }
    c.globalAlpha=.38;
    c.fillStyle="#f86969";
    c.fillRect(x,-230,2,810);
  }
  c.restore();
}

function motionTrails(c: CanvasRenderingContext2D, s: CentipedeState, scene: Scene) {
  const p = centipedeScene({...s,tick:Math.max(0,s.tick-2)}).attacker;
  const a=scene.attacker, dx=(a.x-p.x)/2, dy=(a.y-p.y)/2;
  const length=Math.hypot(dx,dy);
  if (length < 3) return;
  const dive=scene.phase === "descent", ux=dx/length, uy=dy/length;
  for (let i=0;i<(dive?23:15);i++) {
    const offset=(s.tick*11+i*29)%126;
    const spread=(i*37)%132-66;
    const x=Math.round(a.x-ux*offset-uy*spread);
    const y=Math.round(a.y-61-uy*offset+ux*spread);
    const run=Math.round(Math.min(132,18+length*(1+i%3*.7)));
    c.globalAlpha=.25+(i%5)*.105;
    const width=dive?4+i%4:2+i%3;
    fillPixels(c,[{x,y},{x:x-uy*width,y:y+ux*width},
      {x:x-ux*run-uy,y:y-uy*run+ux},{x:x-ux*(run+11),y:y-uy*(run+11)}],
      i%5===0?"#ffd0b3":i%3===0?"#1f101b":"#e53d53");
  }
}

export function drawCentipedeWorld(c: CanvasRenderingContext2D, match: Match, s?: CentipedeState, scene?: Scene) {
  c.save();
  if (s && scene && scene.armor>0) {
    motionTrails(c,s,scene);
    const a=scene.attacker, v=scene.victim;
    if (scene.phase === "transformation" || scene.phase === "return") {
      for (let i=0;i<11;i++) {
        const rise=(s.tick*3+i*17)%103;
        c.globalAlpha=(1-rise/103)*.52*scene.armor;
        c.fillStyle=i%3?"#9c213b":"#f47969";
        c.fillRect(a.x-58+i*27%116,a.y-19-rise,2+i%3,5+i%5);
      }
    }
    if (scene.phase === "windup") {
      const charge = centipedeEase((s.tick-centipedeConfig.phases.windup)/10);
      for (let i=0;i<14;i++) {
        const run=(s.tick*4+i*19)%90, sign=i%2===0?1:-1;
        c.globalAlpha=(1-run/90)*.70*charge;
        c.fillStyle=i%3?"#e34653":"#ffd6ad";
        c.fillRect(a.x+sign*(95-run),a.y-126+i*37%102,3+i%4,2);
      }
    }
    if (scene.phase === "capture") {
      for (let i=0;i<8;i++) {
        const t=(s.tick+i*13)%32;
        c.globalAlpha=(1-t/32)*.62;
        c.fillStyle=i%3?"#b62138":"#ff896c";
        c.fillRect(v.x-37+i*15%74,v.y-60-t,2,4+i%4*2);
      }
    }
  }
  for (const e of match.events) {
    if (!e.centipede) continue;
    const cue=e.centipede.cue, t=(e.total??e.life)-e.life;
    const x=Math.round(cue==="wall" && scene ? scene.wall : e.x);
    const y=Math.round(cue==="wall" ? e.y+39 : e.y);
    const ground=cue==="ground";
    const wall=cue==="wall";
    for (let i=0;i<(ground?40:wall?17:12);i++) {
      const side=wall?(x===40?1:-1):i%2?1:-1;
      const dx=Math.round(side*((ground?18:9)+i%10*5+t*(2.4+i%7*.8)));
      const dy=Math.round((ground?14:0)+(i%7-2)*4+t*(1.8+i%5)-t*t*.14);
      c.globalAlpha=Math.max(0,Math.min(.9,e.life/(ground?22:10)));
      c.fillStyle=i%6===0?"#fff0de":i%3===0?"#ff6e59":"#a91933";
      c.fillRect(x+dx,y-(ground?Math.max(3,dy):dy),ground?5+i%7:3+i%4,2+i%4);
      if (ground) {
        c.fillStyle=i%3===0?"#bfa1a2":"#735e6b";
        c.fillRect(x+dx*1.7,y-Math.max(0,dy*.42),8+(t+i)%14,4+(i%5));
      }
    }
    if (ground && t<25) {
      const r=32+t*16;
      c.globalAlpha=(1-t/25)*.91;
      c.fillStyle="#ffe2b8";
      c.fillRect(x-r,y-3,r*2,4);
      c.fillStyle="#ff4856";
      for (let i=0;i<6;i++) {
        const dx=r+10*i;
        c.fillRect(x-dx-16,y-7-i*3,19-i*2,2);
        c.fillRect(x+dx,y-7-i*3,19-i*2,2);
      }
      if (t<8) {
        c.globalAlpha=(1-t/8)*.82;
        fillPixels(c,[{x:x-21,y:y-4},{x:x-54,y:y-102},
          {x:x-11,y:y-74},{x,y:y-171},{x:x+18,y:y-65},{x:x+54,y:y-111},
          {x:x+24,y:y-4}],"#ffbd8c");
      }
    }
  }
  c.restore();
}

