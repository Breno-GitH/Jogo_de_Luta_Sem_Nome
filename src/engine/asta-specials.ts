import art from "../data/asta-special-art.json";
import sockets from "../data/asta-sockets.json";
import type { Move, Button, Capsule } from "./types";
import type { Fighter, Match } from "./combat";
import type { CommandBuffer } from "./input";
import type { KiProjectile } from "./goku-specials";
import { astaBody, swordReach, type Grip } from "./asta-normals";
import type { AstaSword } from "./asta-stances";
export type AstaSpecialId = keyof typeof art;
export const astaSpecialIds = Object.keys(art) as AstaSpecialId[];
type Technique = {
  name: string;
  family: 0 | 1 | 2;
  button: "light" | "medium" | "heavy";
  stages: { at: number; sword: AstaSword }[];
  damage: number;
  stun: number;
  push: number;
  launch: number;
  rank: number;
  reach?: number;
  chain?: boolean;
  launchCancel?: boolean;
  knockdown?: boolean;
  drive?: Move["drive"];
  windows?: NonNullable<Move["hitWindows"]>;
  projectile?: boolean;
};
export const astaTechniques: Record<AstaSpecialId, Technique> = {
  astaBlackRush: {
    name: "Black Rush",
    family: 0,
    button: "light",
    stages: [{ at: 3, sword: "slayer" }],
    damage: 65,
    stun: 28,
    push: 1.4,
    launch: 0,
    rank: 2,
    chain: true,
    drive: { from: 3, to: 9, speed: 10 },
  },
  astaRisingDemon: {
    name: "Rising Demon",
    family: 0,
    button: "medium",
    stages: [{ at: 4, sword: "slayer" }],
    damage: 84,
    stun: 32,
    push: 1.5,
    launch: -14.7,
    rank: 3,
    launchCancel: true,
  },
  astaBlackDivider: {
    name: "Black Divider",
    family: 0,
    button: "heavy",
    stages: [{ at: 6, sword: "slayer" }],
    damage: 128,
    stun: 30,
    push: 7.5,
    launch: 3,
    rank: 4,
    reach: 210,
    knockdown: true,
  },
  astaIaiSlash: {
    name: "Iai Slash",
    family: 1,
    button: "light",
    stages: [{ at: 1, sword: "slasher" }],
    damage: 48,
    stun: 24,
    push: 1,
    launch: 0,
    rank: 2,
    chain: true,
    drive: { from: 1, to: 6, speed: 8 },
  },
  astaFlashSteps: {
    name: "Black Flash Steps",
    family: 1,
    button: "medium",
    stages: [{ at: 2, sword: "slasher" }],
    damage: 41,
    stun: 27,
    push: 0.7,
    launch: 0,
    rank: 3,
    chain: true,
    drive: { from: 3, to: 23, speed: 5.4 },
    windows: [
      { id: 1, fromTick: 5, toTick: 9, damage: 38 },
      { id: 2, fromTick: 21, toTick: 26, damage: 44, push: 2.5 },
    ],
  },
  astaSeveringLine: {
    name: "Severing Line",
    family: 1,
    button: "heavy",
    stages: [{ at: 4, sword: "slasher" }],
    damage: 96,
    stun: 29,
    push: 5,
    launch: 2,
    rank: 4,
    reach: 140,
    knockdown: true,
  },
  astaBlackSlash: {
    name: "Black Slash",
    family: 2,
    button: "light",
    stages: [{ at: 4, sword: "dweller" }],
    damage: 58,
    stun: 27,
    push: 2,
    launch: 0,
    rank: 2,
    chain: true,
    projectile: true,
  },
  astaCausalityBreak: {
    name: "Causality Break",
    family: 2,
    button: "medium",
    stages: [{ at: 3, sword: "destroyer" }],
    damage: 52,
    stun: 26,
    push: 2.3,
    launch: 0,
    rank: 3,
  },
  astaDualBreak: {
    name: "Dual Anti-Magic Break",
    family: 2,
    button: "heavy",
    stages: [
      { at: 3, sword: "dweller" },
      { at: 26, sword: "destroyer" },
    ],
    damage: 44,
    stun: 32,
    push: 0.7,
    launch: 0,
    rank: 4,
    windows: [
      { id: 1, fromTick: 7, toTick: 13, damage: 44 },
      {
        id: 2,
        fromTick: 30,
        toTick: 36,
        damage: 80,
        push: 7,
        launch: 4,
        knockdown: true,
      },
    ],
  },
};
export const isAstaSpecial = (id: string): id is AstaSpecialId =>
  Object.hasOwn(astaTechniques, id);
export function astaSpecialCommand(
  buffer: CommandBuffer,
  button: Button,
): AstaSpecialId | undefined {
  const command = buffer.gokuSpecial(button); // Existing edge-based relative motion reader.
  if (!command) return;
  const family = command === "ki" ? 0 : command === "kamehameha" ? 1 : 2;
  return astaSpecialIds.find(
    (id) =>
      astaTechniques[id].family === family &&
      astaTechniques[id].button === button,
  );
}
export function astaCells(id: AstaSpecialId) {
  return art[id].flatMap((s) =>
    s.durations.map((ticks, cel) => ({ sheet: s.sheet, cel, ticks })),
  );
}
export function astaSpecialFrame(id: AstaSpecialId, tick: number) {
  const cells = astaCells(id);
  let start = 0;
  for (const c of cells) {
    if (tick < start + c.ticks) return { ...c, start };
    start += c.ticks;
  }
  return {
    ...cells[cells.length - 1],
    start: start - cells[cells.length - 1].ticks,
  };
}
export function astaSpecialGrip(id: AstaSpecialId, tick: number): Grip {
  const c = astaSpecialFrame(id, tick);
  return (
    (sockets as Record<string, Grip[]>)[c.sheet]?.[c.cel] ?? {
      x: 25,
      y: -85,
      angle: 0,
    }
  );
}
export function astaStageSword(id: AstaSpecialId, tick: number) {
  return (
    astaTechniques[id].stages.filter((s) => s.at <= tick).at(-1)?.sword ??
    astaTechniques[id].stages[0].sword
  );
}
export function astaReach(id: AstaSpecialId, tick: number) {
  return astaTechniques[id].reach ?? swordReach[astaStageSword(id, tick)];
}
export function astaSpecialBlade(id: AstaSpecialId, tick: number): Capsule {
  const g = astaSpecialGrip(id, tick),
    a = (g.angle * Math.PI) / 180;
  const pt = (n: number) => ({
    x: g.x + Math.cos(a) * n,
    y: g.y + Math.sin(a) * n,
  });
  return {
    a: pt(12),
    b: pt(astaReach(id, tick)),
    r:
      id === "astaBlackDivider"
        ? 11
        : astaStageSword(id, tick) === "slasher"
          ? 5
          : 8,
  };
}
export const astaSpecialMoves: Record<AstaSpecialId, Move> = Object.fromEntries(
  astaSpecialIds.map((id) => {
    const s = astaTechniques[id],
      cells = astaCells(id),
      h = cells.map((c) => c.ticks),
      total = h.reduce((a, b) => a + b, 0);
    const startup =
      s.windows?.[0].fromTick ??
      (id === "astaCausalityBreak" ? 12 : h[0] + h[1]);
    const end =
      s.windows?.at(-1)?.toTick ??
      (id === "astaCausalityBreak" ? 17 : startup + h[2] + h[3]);
    let clock = 0;
    return [
      id,
      {
        startup,
        active: end - startup,
        recovery: total - end,
        damage: s.damage,
        stun: s.stun,
        blockstun: s.rank >= 4 ? 14 : 10,
        push: s.push,
        launch: s.launch,
        rank: s.rank,
        level: "mid",
        kind: s.projectile ? "astaWave" : "strike",
        special: "asta",
        hitstop: s.rank >= 4 ? 8 : 5,
        knockdown: s.knockdown,
        box: { x: 0, y: 0, w: 0, h: 0 },
        astaSword: {
          sword: s.stages[0].sword,
          commitTick: s.stages[0].at,
          sequence: s.stages
            .slice(1)
            .map((p) => ({ sword: p.sword, commitTick: p.at })),
        },
        drive: s.drive,
        hitWindows: s.windows,
        cancels: [
          ...(s.chain ? ["special"] : []),
          ...(s.launchCancel ? ["jump"] : []),
        ],
        cancelWindow: {
          fromTick: id === "astaFlashSteps" ? 24 : startup,
          toTick: end + 5,
        },
        poses: cells.map((c) => {
          const at = clock;
          clock += c.ticks;
          const active =
            at >= startup &&
            at < end &&
            (!s.windows ||
              s.windows.some((w) => at >= w.fromTick && at < w.toTick));
          return {
            ticks: c.ticks,
            phase: active ? "active" : at < startup ? "startup" : "recovery",
            hurtboxes: astaBody.standing,
            hitboxes: active && !s.projectile ? [astaSpecialBlade(id, at)] : [],
          };
        }),
      } satisfies Move,
    ];
  }),
) as Record<AstaSpecialId, Move>;
export function astaRuntimeMove(f: Fighter, id: AstaSpecialId): Move {
  const m = astaSpecialMoves[id];
  if (id === "astaBlackRush" && f.hitConfirmed)
    return { ...m, recovery: m.recovery - 6 };
  if (id === "astaCausalityBreak" && f.asta?.neutralized)
    return { ...m, damage: 76, launch: -9, push: 4 };
  return m;
}
export function canStartAstaSpecial(f: Fighter, id: AstaSpecialId) {
  const s = f.asta;
  if (
    !s ||
    f.health <= 0 ||
    f.airborne ||
    f.knockedDown ||
    f.match?.capture ||
    f.match?.cinematicActive ||
    f.match?.temporal.isFrozen(f.id)
  )
    return false;
  if (
    id === "astaBlackSlash" &&
    (s.projectileCooldown > 0 ||
      f.match?.kiProjectiles.some(
        (p) => p.owner === f.id && p.move === id && p.state === "flight",
      ))
  )
    return false;
  if (
    f.opponent?.combo &&
    (s.usedSpecials.includes(id) || s.usedSpecials.length >= 3)
  )
    return false;
  if (
    f.state === "attack" &&
    f.moveId === "astaFlashSteps" &&
    !f.hitIds.includes(2)
  )
    return false;
  return (
    ["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
      f.state,
    ) || f.canCancel("special")
  );
}
export function spawnAstaSpecial(f: Fighter, m: Match) {
  if (
    !f.asta ||
    f.moveId !== "astaBlackSlash" ||
    f.stateFrame !== astaSpecialMoves.astaBlackSlash.startup
  )
    return;
  const g = astaSpecialGrip("astaBlackSlash", f.stateFrame),
    a = (g.angle * Math.PI) / 180;
  const x = f.x + f.facing * (g.x + Math.cos(a) * 24),
    y = f.y + g.y + Math.sin(a) * 24;
  m.kiProjectiles.push({
    id: ++m.projectileSerial,
    owner: f.id,
    move: f.moveId,
    cast: f.asta.cast,
    x,
    y,
    previousX: x,
    previousY: y,
    vx: 12 * f.facing,
    vy: 0,
    facing: f.facing,
    radius: 22,
    age: 0,
    life: 26,
    state: "flight",
    impactAge: 0,
  });
  f.asta.projectileCooldown = 48;
}
export const astaWaveVolume = (p: KiProjectile): Capsule => ({
  a: { x: p.previousX, y: p.y - 22 },
  b: { x: p.x, y: p.y + 22 },
  r: 6,
});
export function astaSpecialSegment(id: AstaSpecialId, tick: number) {
  let start = 0;
  for (let index = 0; index < art[id].length; index++) {
    const length = art[id][index].durations.reduce((a, b) => a + b, 0);
    if (tick < start + length || index === art[id].length - 1)
      return { index, start };
    start += length;
  }
  return { index: 0, start: 0 };
}
