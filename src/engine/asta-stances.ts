import type { Fighter } from "./combat";
import { pruneAstaDamage, type DamageReceipt } from "./asta-causality";
export const astaSwords = [
  "slayer",
  "slasher",
  "dweller",
  "destroyer",
] as const;
export type AstaSword = (typeof astaSwords)[number];
export const swordNames: Record<AstaSword, string> = {
  slayer: "Demon-Slayer",
  slasher: "Demon-Slasher",
  dweller: "Demon-Dweller",
  destroyer: "Demon-Destroyer",
};
export interface AstaRelayState {
  initial: AstaSword;
  sword: AstaSword;
  options: [AstaSword, AstaSword, AstaSword];
  phase: "opening" | "choice" | "branch";
  action: number;
  cast: number;
  started: number;
  deadline: number;
  confirmed: boolean;
  windowFrom: number;
  windowTo: number;
  minSerial: number;
  contacts: string[];
  lastContact: number;
  button?: "light" | "medium" | "heavy";
  projectileFired: boolean;
}
export interface AstaDrawState {
  from: AstaSword;
  to: AstaSword;
  move: string;
  tick: number;
  commitAt: number;
  handAt: number;
  total: number;
}
export interface AstaState {
  relay?: AstaRelayState;
  draw?: AstaDrawState;
  equipped: AstaSword;
  attackSword?: AstaSword;
  pending?: {
    sword: AstaSword;
    move: string;
    at: number;
    next?: { sword: AstaSword; at: number }[];
  };
  cast: number;
  usedSpecials: string[];
  projectileCooldown: number;
  neutralized: number;
  airDashUsed: boolean;
  airDashTicks: number;
  airDashDirection: number;
  damageSerial: number;
  recentDamage: DamageReceipt[];
  restorationReadyAt: number;
  restoredCast: number;
  causalityResult?: {
    cast: number;
    at: number;
    hp: number;
    cleansed: string[];
  };
}
export const newAsta = (): AstaState => ({
  equipped: "slayer",
  cast: 0,
  usedSpecials: [],
  projectileCooldown: 0,
  neutralized: 0,
  airDashUsed: false,
  airDashTicks: 0,
  airDashDirection: 1,
  damageSerial: 0,
  recentDamage: [],
  restorationReadyAt: 0,
  restoredCast: -1,
});
export const isAstaSword = (value: string): value is AstaSword =>
  astaSwords.includes(value as AstaSword);
export function practiceSword(f: Fighter, sword: AstaSword) {
  if (
    !f.asta ||
    !f.match?.rules.training ||
    f.airborne ||
    !["idle", "walk", "crouch"].includes(f.state)
  )
    return false;
  f.asta.equipped = sword;
  return true;
}
/** Visual exchange shares the actual commit tick and reaches the hand before the first active frame. */
export function beginAstaDraw(f: Fighter, to: AstaSword, commitAt: number) {
  const s = f.asta!;
  if (to === s.equipped) {
    delete s.draw;
    return;
  }
  const handAt = Math.min(f.move?.startup ?? commitAt + 3, commitAt + 3);
  s.draw = {
    from: s.equipped,
    to,
    move: f.moveId,
    tick: 0,
    commitAt,
    handAt,
    total: handAt + 4,
  };
}
export function beginAstaAttack(
  f: Fighter,
  sword?: {
    sword: AstaSword;
    commitTick: number;
    sequence?: { sword: AstaSword; commitTick: number }[];
  },
) {
  const s = f.asta;
  if (!s) return;
  s.attackSword = s.equipped;
  s.neutralized = 0;
  if (f.moveId !== "astaDualBreak") delete s.relay;
  if (sword) {
    s.cast++;
    if (f.opponent?.combo && !s.usedSpecials.includes(f.moveId))
      s.usedSpecials.push(f.moveId);
    beginAstaDraw(f, sword.sword, sword.commitTick);
  } else delete s.draw;
  s.pending = sword
    ? {
        sword: sword.sword,
        at: sword.commitTick,
        move: f.moveId,
        next: sword.sequence?.map((p) => ({
          sword: p.sword,
          at: p.commitTick,
        })),
      }
    : undefined;
  commitAstaSword(f);
}
export function commitAstaSword(f: Fighter) {
  const s = f.asta,
    p = s?.pending;
  if (
    s &&
    p &&
    f.state === "attack" &&
    f.moveId === p.move &&
    f.stateFrame >= p.at
  ) {
    s.equipped = s.attackSword = p.sword;
    const next = p.next?.shift();
    if (next) s.pending = { ...next, move: p.move, next: p.next };
    else delete s.pending;
  }
}
export function finishAstaAttack(f: Fighter) {
  if (!f.asta) return;
  delete f.asta.pending;
  delete f.asta.attackSword;
  delete f.asta.relay;
  delete f.asta.draw;
}
export const visibleAstaSword = (f: Fighter) =>
  f.asta?.attackSword ?? f.asta?.equipped ?? "slayer";
export function tickAstaState(f: Fighter) {
  const s = f.asta;
  if (!s) return;
  s.projectileCooldown = Math.max(0, s.projectileCooldown - 1);
  if (!f.opponent?.combo && f.state !== "attack") s.usedSpecials.length = 0;
  pruneAstaDamage(f);
  commitAstaSword(f);
  if (s.draw) {
    s.draw.tick = f.stateFrame;
    if (f.moveId !== s.draw.move || s.draw.tick > s.draw.total) delete s.draw;
  }
}
