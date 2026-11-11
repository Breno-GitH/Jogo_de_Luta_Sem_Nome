import type { CaptureSequence, Fighter, Match } from "./combat";
import type { FuryState } from "./goku-fury";
import type { ChainOrigin } from "./kaneki-chain";
import { chainWindow, kaguneGrabLimit, resistanceGoal } from "./kaneki-chain";
import { directedKagune, type KaguneId } from "./kagune";
import type { Capsule, Move, Point } from "./types";

export const centipedeId = "centipede";
export const centipedeName = "CENTIPEDE — FRENESI DA KAKUJA";
export type CentipedeSource = "strike" | Exclude<ChainOrigin, "fourSwords">;
export type CentipedeCue = "activation" | "transform" | "lash" | "launch" | "grip" | "fall" | "ground" | "release" | "wall";
export interface CentipedeState extends FuryState {
  hold: number;
  originY: number;
  source: CentipedeSource;
  grip: KaguneId;
}

export const centipedeConfig = {
  cost: 100, startup: 27, active: 8, recovery: 32, reach: 184,
  duration: 452, minimumComboScale: .45,
  phases: {
    rush: 60, zigzag: 108, wall: 205, plant: 226, rebound: 232, capture: 257,
    ascend: 287, windup: 325, descent: 343, ground: 367, return: 397, base: 435,
  },
  hits: [
    { tick: 82, damage: 16, kind: "lash", limb: "shellFront", hold: 2 },
    { tick: 113, damage: 17, kind: "lash", limb: "lowerFront" },
    { tick: 143, damage: 20, kind: "lash", limb: "upperRear", hold: 2 },
    { tick: 169, damage: 16, kind: "lash", limb: "shellRear" },
    { tick: 196, damage: 21, kind: "lash", limb: "lowerRear", hold: 2 },
    { tick: 246, damage: 24, kind: "lash", limb: "shellFront", hold: 4 },
    { tick: 275, damage: 24, kind: "grip", limb: "both", hold: 3 },
    { tick: 291, damage: 23, kind: "launch", limb: "both", hold: 3 },
    { tick: 352, damage: 28, kind: "lash", limb: "both", hold: 4 },
    { tick: 367, damage: 130, kind: "ground", limb: "both", hold: 16 },
  ],
} as const;
const c = centipedeConfig;
export const centipedeMove: Move = {
  kind: centipedeId, super: true, cost: c.cost, startup: c.startup, active: c.active,
  recovery: c.recovery, damage: 24, hitstop: 6, stun: 24, blockstun: 0,
  push: 0, launch: 0, level: "mid", rank: 5, cancels: [], meterGain: 0,
  box: { x: 0, y: 0, w: 0, h: 0 },
};

export function canStartCentipede(f: Fighter) {
  return f.match?.phase === "fight" && !f.match.cinematicActive && !f.match.capture &&
    f.meter >= c.cost && !f.airborne &&
    (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(f.state) ||
      (f.hitConfirmed && f.canSuperCancel()));
}

export function centipedeConversion(match: Match, capture?: CaptureSequence, tick = capture?.tick ?? 0): CentipedeSource | undefined {
  if (match.phase !== "fight" || match.cinematicActive || capture !== match.capture) return;
  const chain = capture?.kaneki?.chain;
  if (!capture || !chain || chain.origin === "fourSwords" ||
      (chain.phase !== "choice1" && chain.phase !== "choice2")) return;
  const age = tick - chain.since;
  if (age >= chainWindow(chain, chain.phase === "choice2")) return;
  if (chain.origin === "kaguneGrab" &&
      (match.frame - chain.started >= kaguneGrabLimit || (chain.resistance ?? 0) >= resistanceGoal)) return;
  const a = match.fighters[capture.attacker], b = match.fighters[capture.victim];
  if (a.data.id !== "kaneki" || a.state !== "grabbing" || a.health <= 0 || a.meter < c.cost ||
      b.state !== "grabbed" || b.health <= 0 || match.temporal.isFrozen(a.id)) return;
  return chain.origin;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const unit = (n: number) => clamp(n, 0, 1);
export const centipedeEase = (n: number) => { const t = unit(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const FLOOR = 580;

function openerReach(t: number) {
  if (t < c.startup) return 24 + 19 * centipedeEase((t - 12) / (c.startup - 12));
  if (t < c.startup + c.active) return mix(43, c.reach, (t - c.startup) / (c.active - 1));
  return c.reach * (1 - centipedeEase((t - c.startup - c.active) / 13));
}

export function centipedeOpener(f: Fighter) {
  if (f.moveId !== centipedeId || f.state !== "attack") return;
  const t = f.stateFrame;
  if (t < 12 || t >= c.startup + c.active + 13) return;
  const side = f.facing as 1 | -1;
  const root = { x: f.x - 9 * side, y: f.y - 67 };
  return directedKagune("lowerFront", root, side, { x: openerReach(t), y: -5 }, -42, FLOOR);
}

export function centipedeContact(f: Fighter): Capsule[] {
  const pose = centipedeOpener(f);
  if (!pose) return [];
  const t = f.stateFrame;
  const length = Math.max(16, t > c.startup ? openerReach(t) - openerReach(t - 1) : 0);
  return [{ a: { x: pose.tip.x - f.facing * length, y: pose.tip.y }, b: pose.tip, r: 18 }];
}

// Coordinates relative to a safe center, with the last two values tracking
// the target independently of the attacker. Heights are measured from the floor.
type Key = readonly [tick: number, x: number, height: number, targetX: number, targetHeight: number];
const attacks: readonly Key[] = [
  [60,-103,0,42,0], [68,-112,0,43,0], [76,-48,0,43,0],
  [82,7,0,49,5], [91,119,0,66,7], [101,174,0,65,0],
  [108,151,0,65,0], [113,108,0,59,8], [123,67,0,42,0],
  [133,-54,110,42,0], [143,2,112,41,18], [155,103,6,58,2],
  [161,153,0,55,0], [169,96,0,48,17], [179,-24,0,33,4],
  [186,-130,0,32,0], [196,-23,0,37,8], [205,87,22,55,0],
];

const tracks = [
  [0, "centipedeTransform"], [60, "centipedeFrenzyPounce"], [73, "centipedeFrenzyBound"],
  [91, "centipedeRushBrake"], [105, "centipedeRushCross"], [120, "centipedeReboundLeap"],
  [137, "centipedeAttackDiagonal"], [153, "centipedeFrenzyLand"], [160, "centipedeRushCross"],
  [179, "centipedeRushBrake"], [186, "centipedeFrenzyPounce"], [193, "centipedeRushCross"],
  [205, "centipedeFrenzyBound"], [218, "centipedeWallPlant"],
  [232, "centipedeWallRebound"], [248, "centipedeFrenzyLand"], [257, "centipedeSeize"],
  [287, "centipedeLaunch"], [305, "centipedeAscend"], [325, "centipedeWindup"],
  [343, "centipedeDescent"], [367, "centipedeImpact"], [381, "centipedeFrenzyLand"],
  [397, "centipedeFrenzyLook"], [435, "centipedeBase"],
] as const;

const phases = [
  [0,"transformation"], [c.phases.rush,"rush"], [c.phases.zigzag,"zigzag"],
  [c.phases.wall,"wall"], [c.phases.capture,"capture"], [c.phases.ascend,"ascend"],
  [c.phases.windup,"windup"], [c.phases.descent,"descent"],
  [c.phases.ground,"impact"], [c.phases.return,"return"],
] as const;

export function centipedeScene(s: CentipedeState) {
  const t = clamp(s.tick, 0, c.duration), p = c.phases;
  const center = clamp((s.originX + s.targetX) / 2, 282, 998);
  const wall = center < 640 || center === 640 && s.facing < 0 ? 40 : 1240;
  const wallSide = wall === 40 ? -1 : 1;
  const edgeDirection = wallSide * s.facing;
  const braced = (wall - wallSide * 37 - center) * s.facing;
  const from: Key = [0, (s.originX-center)*s.facing, FLOOR-s.originY,
    (s.targetX-center)*s.facing, FLOOR-s.targetY];
  const early: Key = [35, from[1] * .92, from[2] * .68, from[3] * .89, from[4] * .66];
  const afterWall = 80 - edgeDirection * 84;
  const keys: readonly Key[] = [from, early, ...attacks,
    [214,mix(87,braced,.52),119,55,0], [226,braced,185,55,0],
    [232,braced,185,55,0], [238,mix(braced,55,.46),156,55,0],
    [246,55 + edgeDirection*54,52,63,19], [254,afterWall,0,80,0],
    [266,afterWall - edgeDirection*12,0,80,0], [275,afterWall,0,80,18],
    [287,afterWall + edgeDirection*13,0,77,45], [291,afterWall + edgeDirection*20,24,76,122],
    [301,76 - edgeDirection*41,136,77,234], [311,77 - edgeDirection*24,288,78,303],
    [325,77 - edgeDirection*14,406,80,314], [343,80 - edgeDirection*21,413,81,285],
    [352,81 - edgeDirection*12,351,83,241], [367,85 - edgeDirection*12,55,88,0],
    [379,82 - edgeDirection*54,0,102,0], [397,80 - edgeDirection*63,0,111,0],
    [435,80 - edgeDirection*63,0,111,0], [452,80 - edgeDirection*63,0,111,0],
  ];
  const segment = Math.max(1, keys.findIndex(k => t <= k[0]));
  const a = keys[segment-1], b = keys[segment];
  const f = unit((t-a[0])/(b[0]-a[0]));
  // Maintain momentum through the fast contacts. Only turns and wind-ups ease.
  const accelerating = t >= p.descent && t <= p.ground;
  const fA = accelerating ? f*(.47+.53*f) :
    t >= 68 && t <= 96 || t >= 205 && t <= 226 || t >= 232 && t <= 254 ? f : centipedeEase(f);
  const worldX = (x:number) => clamp(center+x*s.facing,40,1240);
  const ax = t ? Math.round(worldX(mix(a[1],b[1],fA))) : s.originX;
  const ay = t ? Math.round(FLOOR-mix(a[2],b[2],fA)) : s.originY;
  const bx = t ? Math.round(worldX(mix(a[3],b[3],f))) : s.targetX;
  const by = t ? Math.round(FLOOR-mix(a[4],b[4],accelerating ? f*(.42+.58*f) : centipedeEase(f))) : s.targetY;
  const look = Math.abs(bx-ax)<8 ? s.facing : bx>ax ? 1 : -1;
  const facing = t < 95 || t >= 129 && t < 158 || t >= 185 && t < p.wall ? s.facing :
    t < 129 || t < 185 && t >= 158 ? -s.facing :
    t >= p.wall && t < 218 ? wallSide : t >= 218 && t < p.capture ? -wallSide : look;
  const armor = centipedeEase((t-10)/47) * (1-centipedeEase((t-412)/31));
  const phaseEnd = phases.findIndex(([at])=>at>t);
  const trackEnd = tracks.findIndex(([at])=>at>t);
  const [,phase] = phases.at(phaseEnd < 0 ? -1 : phaseEnd - 1)!;
  const [at,clip] = tracks.at(trackEnd < 0 ? -1 : trackEnd - 1)!;

  const exit = 1-centipedeEase((t-416)/36);
  const wide = centipedeEase((t-202)/16)*(1-centipedeEase((t-241)/22));
  const fly = centipedeEase((FLOOR-Math.min(ay,by)-55)/315);
  const close = centipedeEase(t/26)*(1-centipedeEase((t-36)/24));
  const stare = centipedeEase((t-p.windup)/9)*(1-centipedeEase((t-p.descent)/13));
  const ending = centipedeEase((t-p.return)/17)*(1-centipedeEase((t-423)/17));
  const scale = 1+(.21*close-.08*armor-.14*wide-.09*fly+.075*stare+.13*ending)*exit;
  const focusX = mix((ax+bx)/2-facing*22*armor,ax,close*.64+stare*.35+ending*.48);
  const bounds = scale >= 1 ? 640/scale : 522;
  const cameraX = mix(640,clamp(focusX,bounds,1280-bounds),exit*(1-.68*wide));
  const shake = t>=p.ground && t<p.ground+17
    ? Math.round(17*(1-(t-p.ground)/17)*(s.hold?s.hold/16:.58)) : 0;
  const tremor = [0,-1,1,-1,0,1][(t+s.hold)%6];
  return {
    phase, armor, wall,
    attacker: { x:ax,y:ay,facing,clip,tick:t-at },
    victim: { x:bx,y:by,facing:-look,clip:t>=p.ground?"downed":
      by<FLOOR-28?"damageAir":t>=82&&t<257?"damageHeavy":"grabbed",tick:t },
    camera: {
      x:cameraX, y:360+exit*(65*close-136*fly-35*wide-28*stare+22*ending),
      scale, shakeX: tremor*shake, shakeY: Math.round(tremor*shake*.33),
    },
  };
}

export function centipedePhaseCue(tick: number): CentipedeCue | undefined {
  if (tick === 16 || tick === 48) return "transform";
  if (tick === 73) return "lash";
  if (tick === centipedeConfig.phases.plant) return "wall";
  if (tick === 262) return "grip";
  if (tick === centipedeConfig.phases.descent) return "fall";
  if (tick === 421) return "release";
}

