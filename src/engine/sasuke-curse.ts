import balance from "../data/sasuke-curse.json";
import metadata from "../data/sasuke-curse-frames.json";
import { sasukeMoves } from "./sasuke-data";
import { sasukeSpecialMoves, type SasukeSpecialId } from "./sasuke-specials";
import type { Fighter } from "./combat";
import type { Capsule, CombatPose, Move, Point } from "./types";

export const sasukeCurseBalance = balance;
export const sasukeCurseArt = metadata as {
  clips: Record<string, { frames: number[]; holds: number[] }>;
  cels: Array<Omit<CombatPose, "ticks" | "phase">>;
};
export type CursePhase = "awakening" | "active" | "ending" | "reverting" | "cooldown";
export interface SasukeCurseState {
  phase: CursePhase;
  remaining: number;
  airBurstUsed: boolean;
  airBurstTick: number;
}
export const curseAwaken = "curse_awaken";
export const curseRevert = "curse_revert";
export const winged = (f: Fighter) =>
  f.sasukeCurse?.phase === "active" || f.sasukeCurse?.phase === "ending";
export const sasukeCurseMovement = (f: Fighter) =>
  f.sasukeCurse?.phase === "active" ? balance.movementMultiplier : 1;

type SpecialConfig = Partial<Pick<Move, "drive" | "push" | "hitstop" | "stun" | "blockstun">> & {
  holds: number[];
  reach?: number;
  shots?: { at: number; speed: number; rise: number; radius: number; life: number }[];
};
export const curseSpecials: Record<SasukeSpecialId, SpecialConfig> = balance.specials;

function poseSequence(id: string, holds: number[], attack: boolean) {
  return holds.map((ticks, i) => ({
    ticks,
    phase: !attack ? "recovery" : i === 0 ? "startup" : i === 1 ? "active" : "recovery",
    ...sasukeCurseArt.cels[sasukeCurseArt.clips[id].frames[i]],
  }));
}
function poweredMove(id: string, base: Move, holds: number[], extra: Partial<Move> = {}): Move {
  const [startup, active, recovery] = holds;
  return {
    ...base,
    ...extra,
    damage: Math.round(base.damage * balance.damageMultiplier),
    startup, active, recovery,
    cancelWindow: base.cancelWindow && {
      fromTick: startup,
      toTick: startup + active + (base.cancelWindow.toTick - base.startup - base.active),
    },
    poses: poseSequence(id, holds, true),
  };
}
export const sasukeCurseMoves: Record<string, Move> = Object.fromEntries([
  ...Object.entries(balance.normalTimings).map(([id, holds]) => {
    const base = sasukeMoves[id];
    const extra = id === "crouch_heavy"
      ? { launch: -14.4, stun: 37, push: 2.3, hitstop: 8 }
      : id === "air_medium" ? { airHold: -3.8, launch: -4.2, push: 1.8 }
        : id === "air_heavy" ? { launch: 9, hitstop: 9 }
          : id === "stand_heavy" ? { push: 4.7, hitstop: 9 } : {};
    return [id, poweredMove(id, base, holds, extra)];
  }),
  ...Object.entries(curseSpecials).map(([id, { holds, shots: _, reach: _reach, ...stats }]) =>
    [id, poweredMove(id, sasukeSpecialMoves[id], holds, stats)],
  ),
]);
const transitions: Record<string, Move> = Object.fromEntries(
  [[curseAwaken, balance.activationHolds], [curseRevert, balance.reversionHolds]].map(([id, holds]) => {
    const timing = holds as number[];
    return [id, {
      kind: "curseTransition", startup: 0, active: 0, recovery: timing.reduce((a, b) => a + b, 0),
      damage: 0, stun: 0, blockstun: 0, hitstop: 0, push: 0, launch: 0,
      rank: 0, level: "mid", cancels: [], box: { x: 0, y: 0, w: 0, h: 0 },
      poses: poseSequence(id as string, timing, false),
    }];
  }),
);

export function curseMove(f: Fighter, id: string) {
  if (f.data.id !== "sasuke") return;
  if (id === curseAwaken || id === curseRevert) return transitions[id];
  if (winged(f)) return sasukeCurseMoves[id];
}

const grounded = (f: Fighter) => !f.airborne &&
  (f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "landing");

export function canAwaken(f: Fighter) {
  return f.data.id === "sasuke" && !f.sasukeCurse && grounded(f);
}
export function startCurse(f: Fighter) {
  if (!canAwaken(f) || !f.attack(curseAwaken)) return;
  f.sasukeCurse = { phase: "awakening", remaining: 0, airBurstUsed: false, airBurstTick: 0 };
}
function cooldown(s: SasukeCurseState) {
  s.phase = "cooldown";
  s.remaining = balance.cooldownTicks;
  s.airBurstUsed = false;
  s.airBurstTick = 0;
}

/** Called on an effective fighter tick, after match freezes are filtered. */
export function tickSasukeCurse(f: Fighter) {
  const s = f.sasukeCurse;
  if (!s) return;
  if (s.phase === "cooldown") {
    if (--s.remaining <= 0) f.sasukeCurse = undefined;
    return;
  }
  if (s.phase === "awakening" || s.phase === "reverting") {
    const id = s.phase === "awakening" ? curseAwaken : curseRevert;
    if (f.state !== "attack" || f.moveId !== id) {
      cooldown(s);
    } else if (f.stateFrame + 1 >= transitions[id].recovery) {
      f.setState("idle");
      if (id === curseAwaken) {
        s.phase = "active";
        s.remaining = balance.durationTicks;
      } else cooldown(s);
    }
    return;
  }
  if (s.phase === "active" && --s.remaining <= 0) {
    s.phase = "ending";
    s.airBurstTick = 0;
  }
  if (!f.airborne) {
    s.airBurstUsed = false;
    s.airBurstTick = 0;
  } else if (f.state !== "air") s.airBurstTick = 0;
  if (s.phase === "ending" && grounded(f) && f.attack(curseRevert)) {
    f.buffer.clear();
    s.phase = "reverting";
  }
}

export function tickSasukeAirBurst(f: Fighter) {
  const s = f.sasukeCurse;
  if (s?.phase !== "active" || f.state !== "air" || !f.airborne) return false;
  const { speeds, fallCap } = balance.airBurst;
  if (!s.airBurstUsed && f.input.direction * f.facing >= 0 && f.buffer.consume("dash")) {
    s.airBurstUsed = true;
    s.airBurstTick = 1;
    f.airChaseTicks = 0;
    f.vy = Math.min(f.vy, fallCap);
  }
  if (!s.airBurstTick) return false;
  f.vx = speeds[s.airBurstTick - 1] * f.facing;
  s.airBurstTick = s.airBurstTick < speeds.length ? s.airBurstTick + 1 : 0;
  return true;
}

export function curseSpecialContact(
  id: SasukeSpecialId, age: number, facing: number, rootX: number, origin: Point,
): Capsule[] {
  if (id === "eiso") {
    const reach = curseSpecials.eiso.reach!;
    const edge = facing > 0 ? 1280 - rootX : rootX;
    const x = Math.min(edge, origin.x + (reach - origin.x) * Math.min(1, (age + 1) / 4));
    return [{ a: origin, b: { x: Math.max(origin.x, x), y: origin.y - 8 }, r: 12 }];
  }
  if (id === "chidori") return [{ a: { x: origin.x - 19, y: origin.y + 4 }, b: origin, r: 23 }];
  if (id === "nagashi") return [
    { a: { x: -68, y: -54 }, b: { x: 73, y: -54 }, r: 23 },
    { a: { x: -48, y: -91 }, b: { x: 50, y: -91 }, r: 17 },
    { a: { x: -39, y: -24 }, b: { x: 42, y: -24 }, r: 19 },
  ];
  return [];
}
