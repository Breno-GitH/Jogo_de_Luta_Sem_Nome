import { centipedeRig, type KakujaTier } from "../src/render/kaneki-centipede-rig";
import { drawKagune } from "../src/render/kagune";
import { Rinkaku } from "../src/engine/kagune";
import type { CentipedeState } from "../src/engine/kaneki-centipede";

const cvs = document.createElement("canvas");
cvs.width=1460;
cvs.height=1075;
document.body.append(cvs);
const c=cvs.getContext("2d")!;
c.imageSmoothingEnabled=false;

const gold="#f0c398", muted="#b3a7bb", red="#ff685c", canvasInk="#111019";
const tierColors={upper:"#ffae8f",middle:"#f3c47b",lower:"#e5adff"};
const tiers: KakujaTier[]=["upper","middle","lower"];
const text=(value:string,x:number,y:number,size=17,color=muted,bold=false)=>{
  c.fillStyle=color;
  c.font=(bold?"bold ":"")+size+"px Consolas, monospace";
  c.fillText(value,x,y);
};
function panel(x:number,y:number,w:number,h:number) {
  c.fillStyle="#211c2b"; c.fillRect(x,y,w,h);
  c.fillStyle="#4b3a51"; c.fillRect(x,y,w,2);
}
function floor(x:number,y:number,w:number) {
  c.fillStyle="#2c2534"; c.fillRect(x,y,w,18);
  c.fillStyle="#524052"; c.fillRect(x,y,w,1);
}
const img=async(src:string)=>{
  const image=new Image();
  image.src=src;
  await image.decode();
  return image;
};

(window as any).renderKakujaPreview = async (baseURI:string,bodyURI:string,points:number[][]) => {
  const [base,body]=await Promise.all([img(baseURI),img(bodyURI)]);
  const root={x:620,y:580};
  const back=points.map(([x,y])=>({x:root.x+x-128,y:root.y+y-224})) as any;
  const passive = new Rinkaku().poses(back[2],1,580);
  const state: CentipedeState = { attacker:0,victim:1,tick:62,hold:0,facing:1,scale:1,
    originX:620,originY:580,targetX:784,targetY:580,source:"strike",grip:"lowerFront"
  };
  const pose = centipedeRig(state,back,passive,580);
  const bodyCel=(x:number,y:number)=>c.drawImage(body,256,256,256,256,x-128,y-224,256,256);
  c.fillStyle=canvasInk; c.fillRect(0,0,1460,1075);
  text("KANEKI  /  KAKUJA INCOMPLETA",27,48,34,"#f5e3d7",true);
  text("ESTUDO ESTÁTICO DO SPRITE E DAS SEIS ORIGENS",29,79,17,gold);
  panel(28,106,954,535);
  panel(1001,106,430,250);
  panel(1001,372,430,269);
  text("02  /  KAKUJA COMPLETA",47,142,21,gold,true);
  text("01  /  FORMA NORMAL",1021,142,21,gold,true);
  text("03  /  ROSTO NO SPRITE",1021,409,21,gold,true);

  floor(48,584,914);
  c.save();
  c.translate(459,584);
  c.scale(1.15,1.15);
  c.translate(-root.x,-root.y);
  for(const limb of pose) drawKagune(c,limb,1);
  bodyCel(root.x,root.y);
  c.restore();

  for(const tier of tiers) {
    pose.filter(limb=>limb.tier===tier).forEach((limb,i)=>{
      const offset=limb.kakuja?(i===0 ? [-15,22] : [18,14]):i===0?[-19,-4]:[13,7];
      const x=459+(limb.tip.x-root.x)*1.15+offset[0], y=584+(limb.tip.y-root.y)*1.15+offset[1];
      c.fillStyle="#211c2b"; c.fillRect(x-4,y-16,42,23);
      text(tier[0].toUpperCase().replace("M","C").replace("U","S").replace("L","I")+(i+1),x,y,18,tierColors[tier],true);
    });
  }

  floor(1020,325,390);
  const baseAt={x:1226,y:325};
  for(const limb of new Rinkaku().poses({x:baseAt.x-8,y:baseAt.y-61},1,baseAt.y)) drawKagune(c,limb,1);
  c.drawImage(base,0,0,256,256,baseAt.x-128,baseAt.y-224,256,256);

  c.drawImage(body,256+106,256+71,46,49,1133,413,184,196);
  text("Recorte do quadro completo · 4×",1023,611,16);
  text("Pixels do atlas, ampliados sem suavização",1023,631,15);
  const titles=["S1 + S2  /  RINKAKUS SUPERIORES","C1 + C2  /  CENTOPEIAS CENTRAIS","I1 + I2  /  RINKAKUS INFERIORES"];
  const description=["Origem nas escápulas · curvas leves","Origem torácica · carapaça e juntas vermelhas","Origem lombar · curvas baixas"];
  for(const [i,tier] of tiers.entries()){
    const x=28+471*i;
    panel(x,668,461,381);
    text(titles[i],x+17,702,18,tierColors[tier],true);
    floor(x+17,1002,427);
    c.save();
    c.translate(x+202,1002);
    c.scale(.74,.74);
    c.translate(-root.x,-root.y);
    for(const limb of pose.filter(limb=>limb.tier===tier)) drawKagune(c,limb,1);
    bodyCel(root.x,root.y);
    for(const limb of pose.filter(limb=>limb.tier===tier)){
      c.fillStyle=tierColors[tier]; c.fillRect(limb.origin.x-2,limb.origin.y-2,5,5);
    }
    c.restore();
    text(description[i],x+17,1035,15);
  }
  const atlas = document.createElement("canvas");
  const frameWidth = 700, frameHeight = 390;
  atlas.width = frameWidth*3;
  atlas.height = frameHeight*3;
  document.body.append(atlas);
  const a = atlas.getContext("2d")!;
  a.imageSmoothingEnabled = false;
  for (const [row,tick] of [62,99,211].entries()) {
    const limbs = centipedeRig({...state,tick},back,passive,580);
    for (const [col,tier] of tiers.entries()) {
      a.save();
      a.translate(col*frameWidth+322-root.x,row*frameHeight+355-root.y);
      for (const limb of limbs.filter(l=>l.tier===tier)) drawKagune(a,limb,1);
      a.restore();
    }
  }
};

