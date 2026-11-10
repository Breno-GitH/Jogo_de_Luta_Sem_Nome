import { centipedeConfig, centipedeEase, centipedeScene, type CentipedeState } from "../engine/kaneki-centipede";
import { directedKagune, samplePath, type KaguneId, type KagunePose } from "../engine/kagune";
import type { Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

export type KakujaBack = readonly [upper: Point, middle: Point, lower: Point];
export type KakujaTier = "upper" | "middle" | "lower";
export type KakujaPose = KagunePose & { tier: KakujaTier };
type Profile = {
  id: KaguneId;
  tier: KakujaTier;
  offset: Point;
  width: number;
  nodes: readonly [number, number][];
};

const normals: readonly Profile[] = [
  { id:"upperRear", tier:"upper", offset:{x:-3,y:-4}, width:11,
    nodes:[[-26,-11],[-73,-35],[-127,-67],[-179,-64],[-205,-35],[-201,-20]] },
  { id:"upperFront", tier:"upper", offset:{x:4,y:3}, width:10,
    nodes:[[-21,-22],[-13,-57],[38,-93],[106,-108],[149,-143],[143,-173]] },
  { id:"lowerRear", tier:"lower", offset:{x:-4,y:0}, width:12,
    nodes:[[-26,17],[-71,36],[-131,44],[-204,31],[-241,2],[-231,-23]] },
  { id:"lowerFront", tier:"lower", offset:{x:3,y:4}, width:11,
    nodes:[[-21,16],[12,53],[79,64],[144,55],[190,30],[204,-5]] },
];

const shells: readonly Profile[] = [
  { id:"upperRear", tier:"middle", offset:{x:-4,y:-5}, width:25,
    nodes:[[-25,-6],[-87,-27],[-138,-105],[-130,-195],[-52,-237],[41,-216],[76,-167]] },
  { id:"upperFront", tier:"middle", offset:{x:5,y:4}, width:25,
    nodes:[[-25,1],[-53,26],[16,36],[115,26],[220,-5],[290,-63],[304,-111]] },
];

const mix = (a: number,b: number,t: number) => a+(b-a)*t;
const clamp = (n: number,a: number,b: number) => Math.max(a,Math.min(b,n));
const point = (a: Point,b: Point,t: number) => ({ x:mix(a.x,b.x,t), y:mix(a.y,b.y,t) });

/** The pose anchors are authored on the scapulae, thorax and lower back.
 * The standard four keep their organic profile while the middle pair grows. */
export function centipedeRig(state: CentipedeState, back: KakujaBack, passive: KagunePose[], floor: number): KakujaPose[] {
  const scene = centipedeScene(state), t = state.tick;
  const side = state.facing as 1 | -1;
  const bodySide = scene.attacker.facing === -1 ? -1 : 1;
  const target = { x: scene.victim.x, y: scene.victim.y - 70 };
  const growth = scene.armor;
  const { phases, hits } = centipedeConfig;
  const beat = hits.find(h => Math.abs(t-h.tick) <= 9);
  const grip = 1-centipedeEase((t-23)/36);
  const clasp = centipedeEase((t-phases.capture)/16) * (1-centipedeEase((t-291)/14));
  const crash = centipedeEase((t-343)/9) * (1-centipedeEase((t-phases.ground)/13));
  const plant = centipedeEase((t-218)/8) * (1-centipedeEase((t-phases.rebound)/8));
  const impact = centipedeEase((t-phases.ground)/14) * (1-centipedeEase((t-417)/26));
  const boost = centipedeEase((t-289)/7) * (1-centipedeEase((t-308)/13));

  function build(profile: Profile, i: number, startPose: KagunePose, shell: boolean): KakujaPose {
    const anchor = back[profile.tier === "upper" ? 0 : profile.tier === "middle" ? 1 : 2];
    const start = { x:anchor.x + profile.offset.x*bodySide, y:anchor.y + profile.offset.y };
    const limb = shell ? i === 0 ? "shellRear" : "shellFront" : profile.id;
    const held = !shell && profile.id === state.grip ? grip : 0;
    const lash = beat && (beat.limb === limb || shell && beat.limb === "both") && beat.kind !== "ground"
      ? centipedeEase(1-Math.abs(t-beat.tick)/10) : 0;
    const wrap = shell ? Math.max(clasp,crash) : 0;
    const brace = shell && i === 0 ? plant : 0;
    const contact = brace > 0
      ? { x:scene.wall, y:scene.attacker.y-35 }
      : { x:target.x + side*(shell ? i === 0 ? -19 : 18 : 0),
          y:Math.min(floor-22,target.y+(shell ? i === 0 ? -27 : 30 : 0)) };
    const ex = (contact.x-start.x)*side, ey = contact.y-start.y;
    const focus = Math.max(held,lash,wrap,brace);
    const movement = (phase:number) => Math.sin(t * (.045 + i*.008) + i*1.63 + phase);
    const formation = shell ? Math.max(.02,growth) : growth;
    const spread = impact * (shell ? 35 : 15);
    const nodes = profile.nodes.map(([x,y],j) => {
      const u = (j+1)/profile.nodes.length;
      const reach = focus * centipedeEase((u-.14)/.86);
      const arch = Math.sin(u*Math.PI) * focus * (shell ? 78 : 38);
      const tail = scene.phase === "rush" || scene.phase === "wall" ? 31*bodySide*side : 0;
      const lift = scene.phase === "return" && shell ? -38 : 0;
      const px = x + (movement(u*5.4)*16 + Math.sign(x)*spread-tail)*u*u;
      const risingKick = shell ? boost : 0;
      const py = mix(y,(i===0?116:99)*u,risingKick) + (movement(u*4.3 + .7)*18 + spread*.25+lift)*u*u;
      const pathX = mix(px,ex,reach) + (i%2 ? 1 : -1)*arch*.7;
      const pathY = mix(py,ey,reach) + (shell ? i === 0 ? -1 : 1 : profile.tier === "lower" ? .6 : -1)*arch;
      return {
        x: clamp(start.x + side * pathX * (shell ? formation : 1), -42,1322),
        y: clamp(start.y + pathY * (shell ? formation : 1), -120, floor - (shell ? 42*growth + 7 : 11)),
      };
    });
    const curve = samplePath([start,...nodes]);
    const attached = held > 0
      ? directedKagune(profile.id,back[2],bodySide,{x:(target.x-back[2].x)*bodySide,y:target.y-back[2].y},-35,floor)
      : startPose;
    const spine = shell ? curve : curve.map((p,j) =>
      point(attached.spine[Math.round(j*(attached.spine.length-1)/(curve.length-1))],p,formation));
    const length = spine.reduce((n,p,j) => j ? n + Math.hypot(p.x-spine[j-1].x,p.y-spine[j-1].y) : n,0);
    const radius = spine.map((_,j) => {
      const u = j/(spine.length-1);
      const width = profile.width * (shell
        ? formation * (.53 + .47*centipedeEase(u/.2)) * (1 - .91*centipedeEase((u-.62)/.38))
        : (1 - u) ** .67 * (.81 + .19*Math.sin(Math.PI*u)));
      const old = attached.radius[Math.round(u*(attached.radius.length-1))];
      return Math.max(.45,shell ? width : mix(old,width,formation));
    });
    return { ...startPose, tier:profile.tier, origin:spine[0], tip:spine.at(-1)!, spine, radius, length,
      layer:"behind", kakuja:shell ? {growth,broad:true} : undefined };
  }

  const organic = normals.map((p,i) => build(p,i,passive[i],false));
  const armored = growth > .065 ? shells.map((p,i) => build(p,i,passive[i],true)) : [];
  return [...armored,...organic];
}

type Station = { p:Point; dx:number; dy:number; w:number };
const at = (s: Station, side: number, ahead=0): Point =>
  ({ x:Math.round(s.p.x-s.dy*side+s.dx*ahead), y:Math.round(s.p.y+s.dx*side+s.dy*ahead) });

/** Separate shell sections overlap a red underbody. Hooks follow the local
 * tangent instead of rotating the whole structure as one rigid sprite. */
export function drawCentipedeShell(c: CanvasRenderingContext2D, pose: KagunePose) {
  const shell = pose.kakuja!;
  const { spine, radius, length } = pose;
  const distance = spine.reduce<number[]>((out,p,i) => {
    out.push(i ? out[i-1]+Math.hypot(p.x-spine[i-1].x,p.y-spine[i-1].y) : 0);
    return out;
  },[]);
  const count = Math.max(5,Math.min(shell.broad ? 17 : 15,Math.round(length/(shell.broad ? 27 : 32))));
  function station(d: number): Station {
    d = clamp(d,0,length);
    const i = Math.max(1,distance.findIndex(x => x >= d));
    const a = spine[i-1], b = spine[i], v = Math.max(.01,distance[i]-distance[i-1]);
    const u = clamp((d-distance[i-1])/v,0,1);
    return { p:point(a,b,u), dx:(b.x-a.x)/v, dy:(b.y-a.y)/v, w:mix(radius[i-1],radius[i],u) };
  }
  function ribbon(width: number, color: string, offset=0) {
    const a = spine.map((_,i) => station(distance[i]));
    fillPixels(c,[...a.map(s=>at(s,s.w*(offset+width))),...a.reverse().map(s=>at(s,s.w*(offset-width)))],color);
  }
  ribbon(1,"#0c0a10");
  ribbon(.82,"#710b20");
  ribbon(.51,"#be1a31",.17);
  ribbon(.19,"#ec3443",.32);
  const span = length/count;
  for (let i=count-1;i>=0;i--) {
    const a = station(span*i), m = station(span*(i+.45)), b = station(span*(i+.90));
    const coverage = .52 + .42*shell.growth;
    const hookSide = i % 3 === 0 ? 1 : -1;
    if (m.w > 5 && (shell.broad || i % 2 === 0)) {
      const w = m.w * hookSide;
      const bend = shell.broad ? (i % 3 === 0 ? 25 : 31) : 14;
      // Broad black roots lock the feet to each plate. The hook curves back
      // toward the preceding segment, with a highlight only along its ridge.
      const claw = (shape: [number,number][], ink: string) =>
        fillPixels(c,shape.map(([out,back])=>at(m,w*out,bend*back)),ink);
      claw([[.66,-.33],[1.15,-.33],[1.58,-.62],[1.91,-.83],[1.79,-1.18],
        [2.05,-1.01],[2.09,-.64],[1.82,-.29],[1.43,.03],[.83,.31]],"#0b0910");
      claw([[.94,-.20],[1.26,-.28],[1.63,-.59],[1.96,-.81],[1.87,-1.03],
        [2.00,-.90],[2.02,-.69],[1.76,-.36],[1.31,-.05]],"#3a3845");
      claw([[1.35,-.33],[1.65,-.61],[1.98,-.82],[1.88,-1.03],[2.01,-.88],
        [2.00,-.75],[1.69,-.49]],"#96909d");
    }
    fillPixels(c,[at(a,-a.w*.89),at(m,-m.w),at(b,-b.w*.82),
      at(b,b.w*coverage),at(m,m.w*.61),at(a,a.w*.70)],"#0d0c13");
    fillPixels(c,[at(a,-a.w*.66,2),at(m,-m.w*.91),at(b,-b.w*.65,-1),
      at(b,b.w*.30,-2),at(m,m.w*.23),at(a,a.w*.46,3)],"#24242d");
    fillPixels(c,[at(a,-a.w*.62,3),at(m,-m.w*.85),at(b,-b.w*.65,-2),
      at(m,-m.w*.60),at(a,-a.w*.40,3)],"#43434c");
    if (m.w > 6) fillPixels(c,[at(a,-a.w*.54,3),at(m,-m.w*.79),at(m,-m.w*.70,3)],"#898490");
  }
  const h=station(length*.88), k=station(length*.96), tip=station(length);
  const side=pose.id.endsWith("Rear") ? -1 : 1;
  const w=(shell.broad ? 28 : 17)*side*shell.growth;
  fillPixels(c,[at(h,-h.w*.88),at(k,-w*.24),at(tip,w*.12,12),
    at(tip,w*.90,27),at(tip,w*.98,10),at(k,w*.75,3),at(h,h.w*.78)],"#0c0a11");
  fillPixels(c,[at(h,-h.w*.51),at(k,-w*.13),at(tip,w*.24,11),at(tip,w*.88,25),
    at(tip,w*.69,12),at(k,w*.37,2),at(h,h.w*.49)],"#a4162b");
  fillPixels(c,[at(k,w*.17),at(tip,w*.20,9),at(tip,w*.88,24),at(tip,w*.66,13)],"#ee4150");
}



