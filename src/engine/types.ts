export type Button =
  | "light"
  | "medium"
  | "heavy"
  | "throw"
  | "dash"
  | "jump"
  | "ultimate"
  | "taunt";
export interface InputFrame {
  direction: -1 | 0 | 1;
  down: boolean;
  pressed: Button[];
}
export const neutral = (): InputFrame => ({
  direction: 0,
  down: false,
  pressed: [],
});
export type State =
  | "idle"
  | "walk"
  | "crouch"
  | "air"
  | "jumpStart"
  | "landing"
  | "dash"
  | "attack"
  | "hitstun"
  | "blockstun"
  | "ko"
  | "counter"
  | "counterRecover"
  | "ultimateRecover"
  | "throwRecover"
  | "getup"
  | "grabbing"
  | "grabbed"
  | "cinematic"
  | "taunt"
  | "entrance"
  | "victory"
  | "defeat";
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Capsule {
  a: Point;
  b: Point;
  r: number;
}
export type AttackShape = Rect | Capsule;
export interface CombatPose {
  release?: Point;
  ticks: number;
  phase: string;
  blade?: Capsule;
  hitboxes?: AttackShape[];
  hurtboxes: Rect[];
}
export interface Move {
  visualTiming?: { startup: number; active: number; recovery: number };
  airTeleport?: boolean;
  super?: boolean;
  special?: "knives" | "rush" | "timeStop" | "ki" | "kamehameha" | "teleport" | "pistol" | "gatling" | "bazooka";
  gokuStrength?: "light" | "medium" | "heavy";
  beam?: { range: number; radius: number; interval: number; hits: number };
  projectile?: {
    releases: number[];
    angles: number[];
    speed: number;
    life: number;
    kind?: "ki";
    radius?: number;
  };
  comboHitLimit?: number;
  meterGain?: number;
  hitWindows?: HitWindow[];
  cancelWindow?: { fromTick: number; toTick: number };
  cancelMoves?: string[];
  commandClip?: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  stun: number;
  blockstun: number;
  push: number;
  launch: number;
  level: string;
  box: Rect;
  rank: number;
  cancels: string[];
  cost?: number;
  poses?: CombatPose[];
  hitstop?: number;
  airHold?: number;
  knockdown?: boolean;
  kind?: string;
  drive?: { from: number; to: number; speed: number };
  hopAt?: number;
  hopVelocity?: number;
  invulnerable?: { from: number; to: number; upperOnly?: boolean };
  stand?: StandTimeline;
}
export interface StandTimeline {
  returnClip?: string;
  recoveryClip?: string;
  bridgeTicks?: number;
  optional?: boolean;
  approachAt: number;
  approachTicks: number;
  punchAt: number;
  recoverAt: number;
  returnAt: number;
  returnTicks: number;
  front: Point;
  clip: string;
}
export interface CompanionData {
  comboGrace?: number;
  neutral: Point;
  returnTicks: number;
  quickReturnTicks: number;
  actions: Record<string, { durations: number[]; poses: CombatPose[] }>;
}
export interface CharacterData {
  grabSequence?: {
    duration: number;
    hitTick: number;
    damage: number;
    recoveryTicks: number;
    victimTrack: { tick: number; x: number; y: number; clip: string }[];
    release: { vx: number; vy: number; stun: number };
  };
  reactionClips?: Record<string, string>;
  lifecycle?: {
    entranceDistance: number;
    entranceWalkTicks: number;
    entranceSpeed: number;
    tauntTicks: number;
    getupTicks: number;
    koTicks: number;
  };
  meterMaximum?: number;
  meterGainScale?: number;
  superMoves?: Record<string, Move>;
  specialMoves?: Record<string, Move>;
  commandTransitions?: { jump: { poses: CombatPose[] } };
  combatLimits?: { maxHits: number; maxAirHits: number; maxTicks: number };
  id: string;
  name: string;
  health: number;
  speed: number;
  jump: number;
  gravity: number;
  airChaseSpeed?: number;
  airChaseTicks?: number;
  locomotion?: {
    backSpeed: number;
    airSpeed: number;
    jumpStartup: number;
    landingTicks: number;
    dashForward: number[];
    backdash: number[];
  };
  companion?: CompanionData;
  moves: Record<string, Move>;
  hurtboxes?: { standing: Rect[]; crouching: Rect[]; air: Rect[] };
  reactions?: Record<
    string,
    { loop: boolean; poses: { ticks: number; hurtboxes: Rect[] }[] }
  >;
}
export interface HitWindow {
  id: number;
  fromTick: number;
  toTick: number;
  damage?: number;
  stun?: number;
  blockstun?: number;
  push?: number;
  launch?: number;
  airHold?: number;
}
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
