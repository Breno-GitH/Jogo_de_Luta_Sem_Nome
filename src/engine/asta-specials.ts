import art from "../data/asta-special-art.json";
import sockets from "../data/asta-sockets.json";
import type { Move, Button, Capsule } from "./types";
import type { Fighter, Match } from "./combat";
import type { CommandBuffer } from "./input";
import type { KiProjectile } from "./goku-specials";
import { astaBody, swordReach, type Grip } from "./asta-normals";
import type { AstaSword, AstaRelayState } from "./asta-stances";
export const astaSpecialIds = [
  "astaBlackRush",
  "astaRisingDemon",
  "astaBlackDivider",
  "astaIaiSlash",
  "astaFlashSteps",
  "astaSeveringLine",
  "astaBlackSlash",
  "astaCausalityBreak",
  "astaDualBreak",
] as const;
export type AstaSpecialId = (typeof astaSpecialIds)[number];
export type AstaActionId = AstaSpecialId | "astaBlackSlashPursuit";
export type AstaArtKey = keyof typeof art;
export const isAstaSpecial = (id: string): id is AstaSpecialId =>
  (astaSpecialIds as readonly string[]).includes(id);
export const isAstaAction = (id: string): id is AstaActionId =>
  isAstaSpecial(id) || id === "astaBlackSlashPursuit";
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
  startup: number;
  end: number;
  reach?: number;
  chain?: boolean;
  launchCancel?: boolean;
  knockdown?: boolean;
  drive?: Move["drive"];
  windows?: NonNullable<Move["hitWindows"]>;
  projectile?: boolean;
  hopAt?: number;
  hopVelocity?: number;
};
export const astaTechniques: Record<AstaSpecialId, Technique> = {
  astaBlackRush: {
    name: "Black Rush: Impacto Relâmpago",
    family: 0,
    button: "light",
    stages: [{ at: 1, sword: "slayer" }],
    damage: 62,
    stun: 28,
    push: 0.8,
    launch: 0,
    rank: 2,
    startup: 9,
    end: 13,
    chain: true,
    drive: { from: 1, to: 7, speed: 16 },
  },
  astaRisingDemon: {
    name: "Meteor Break",
    family: 0,
    button: "medium",
    stages: [{ at: 2, sword: "slayer" }],
    damage: 85,
    stun: 31,
    push: 1.2,
    launch: -10.5,
    rank: 3,
    startup: 15,
    end: 21,
    launchCancel: true,
    drive: { from: 2, to: 9, speed: 13 },
    hopAt: 4,
    hopVelocity: -7,
  },
  astaBlackDivider: {
    name: "Black Divider: Queda do Demônio",
    family: 0,
    button: "heavy",
    stages: [{ at: 3, sword: "slayer" }],
    damage: 130,
    stun: 30,
    push: 7,
    launch: 3,
    rank: 4,
    startup: 19,
    end: 25,
    reach: 210,
    knockdown: true,
    drive: { from: 5, to: 13, speed: 14 },
    hopAt: 7,
    hopVelocity: -7,
  },
  astaIaiSlash: {
    name: "Iai Slash: Dois Cortes",
    family: 1,
    button: "light",
    stages: [{ at: 1, sword: "slasher" }],
    damage: 22,
    stun: 25,
    push: 0.5,
    launch: 0,
    rank: 2,
    startup: 3,
    end: 9,
    chain: true,
    drive: { from: 1, to: 8, speed: 7 },
    windows: [
      { id: 1, fromTick: 3, toTick: 5, damage: 22 },
      { id: 2, fromTick: 7, toTick: 9, damage: 26 },
    ],
  },
  astaFlashSteps: {
    name: "Black Flash Steps: Quatro Cortes",
    family: 1,
    button: "medium",
    stages: [{ at: 1, sword: "slasher" }],
    damage: 17,
    stun: 27,
    push: 0.4,
    launch: 0,
    rank: 3,
    startup: 3,
    end: 17,
    chain: true,
    launchCancel: true,
    drive: { from: 1, to: 15, speed: 4.5 },
    windows: [
      { id: 1, fromTick: 3, toTick: 5, damage: 17 },
      { id: 2, fromTick: 6, toTick: 8, damage: 17 },
      { id: 3, fromTick: 12, toTick: 14, damage: 19 },
      { id: 4, fromTick: 15, toTick: 17, damage: 24, launch: -11, push: 1.1 },
    ],
  },
  astaSeveringLine: {
    name: "Demon-Slasher: Tempestade de Cortes",
    family: 1,
    button: "heavy",
    stages: [{ at: 2, sword: "slasher" }],
    damage: 15,
    stun: 25,
    push: 0.4,
    launch: 0,
    rank: 4,
    startup: 4,
    end: 28,
    drive: { from: 2, to: 25, speed: 4.2 },
    windows: [
      { id: 1, fromTick: 4, toTick: 6, damage: 15 },
      { id: 2, fromTick: 7, toTick: 9, damage: 15 },
      { id: 3, fromTick: 13, toTick: 15, damage: 17 },
      { id: 4, fromTick: 16, toTick: 18, damage: 17 },
      { id: 5, fromTick: 22, toTick: 24, damage: 18 },
      {
        id: 6,
        fromTick: 25,
        toTick: 28,
        damage: 34,
        push: 7,
        launch: 2,
        knockdown: true,
      },
    ],
  },
  astaBlackSlash: {
    name: "Black Slash Pursuit",
    family: 2,
    button: "light",
    stages: [{ at: 3, sword: "dweller" }],
    damage: 52,
    stun: 29,
    push: 1.1,
    launch: 0,
    rank: 2,
    startup: 7,
    end: 12,
    projectile: true,
  },
  astaCausalityBreak: {
    name: "Causality Rush",
    family: 2,
    button: "medium",
    stages: [{ at: 2, sword: "destroyer" }],
    damage: 66,
    stun: 28,
    push: 1,
    launch: -6,
    rank: 3,
    startup: 7,
    end: 12,
    chain: true,
    drive: { from: 2, to: 8, speed: 7 },
  },
  astaDualBreak: {
    name: "Anti-Magic Relay",
    family: 2,
    button: "heavy",
    stages: [],
    damage: 42,
    stun: 30,
    push: 0.7,
    launch: 0,
    rank: 3,
    startup: 4,
    end: 8,
  },
};
const swordCase = (s: AstaSword) => s[0].toUpperCase() + s.slice(1);
export function astaArtKey(
  id: AstaActionId,
  relay?: AstaRelayState,
): AstaArtKey {
  if (id !== "astaDualBreak") return id;
  return ("astaRelay" +
    swordCase(relay?.sword ?? "slayer") +
    (relay?.phase === "finish" ? "Finish" : "")) as AstaArtKey;
}
export function astaSpecialCommand(
  buffer: CommandBuffer,
  button: Button,
): AstaSpecialId | undefined {
  const c = buffer.gokuSpecial(button);
  if (!c) return;
  const family = c === "ki" ? 0 : c === "kamehameha" ? 1 : 2;
  return astaSpecialIds.find(
    (id) =>
      astaTechniques[id].family === family &&
      astaTechniques[id].button === button,
  );
}
export function astaCells(id: AstaActionId, relay?: AstaRelayState) {
  return art[astaArtKey(id, relay)].flatMap((s) =>
    s.durations.map((ticks, cel) => ({ sheet: s.sheet, cel, ticks })),
  );
}
export function astaSpecialFrame(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
) {
  const cells = astaCells(id, relay);
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
export function astaSpecialGrip(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
): Grip {
  const c = astaSpecialFrame(id, tick, relay),
    g = (sockets as Record<string, Grip[]>)[c.sheet]?.[c.cel];
  if (!g) throw new Error("Missing Asta grip: " + c.sheet + "/" + c.cel);
  return g;
}
export function astaStageSword(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
): AstaSword {
  if (id === "astaDualBreak") return relay?.sword ?? "slayer";
  if (id === "astaBlackSlashPursuit") return "dweller";
  return (
    astaTechniques[id].stages.filter((s) => s.at <= tick).at(-1)?.sword ??
    astaTechniques[id].stages[0].sword
  );
}
export function astaReach(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
) {
  return id === "astaDualBreak"
    ? swordReach[relay?.sword ?? "slayer"]
    : id === "astaBlackSlashPursuit"
      ? 91
      : (astaTechniques[id].reach ?? swordReach[astaStageSword(id, tick)]);
}
export function astaSpecialBlade(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
): Capsule {
  const g = astaSpecialGrip(id, tick, relay),
    a = (g.angle * Math.PI) / 180;
  const pt = (d: number) => ({
    x: g.x + Math.cos(a) * d,
    y: g.y + Math.sin(a) * d,
  });
  return {
    a: pt(12),
    b: pt(astaReach(id, tick, relay)),
    r:
      id === "astaBlackDivider"
        ? 11
        : astaStageSword(id, tick, relay) === "slasher"
          ? 5
          : 8,
  };
}
function buildMove(
  id: AstaActionId,
  s: Omit<Technique, "family" | "button" | "name">,
  relay?: AstaRelayState,
): Move {
  const cells = astaCells(id, relay),
    total = cells.reduce((n, c) => n + c.ticks, 0);
  let clock = 0;
  return {
    startup: s.startup,
    active: s.end - s.startup,
    recovery: total - s.end,
    damage: s.damage,
    stun: s.stun,
    blockstun: s.rank >= 4 ? 12 : 10,
    push: s.push,
    launch: s.launch,
    rank: s.rank,
    level: "mid",
    kind: s.projectile ? "astaWave" : "strike",
    special: "asta",
    hitstop: s.rank >= 4 ? 7 : 4,
    knockdown: s.knockdown,
    box: { x: 0, y: 0, w: 0, h: 0 },
    astaSword: {
      sword: s.stages[0]?.sword ?? relay?.sword ?? "slayer",
      commitTick: s.stages[0]?.at ?? 2,
    },
    drive: s.drive,
    hopAt: s.hopAt,
    hopVelocity: s.hopVelocity,
    hitWindows: s.windows,
    cancels: [
      ...(s.chain ? ["special"] : []),
      ...(s.launchCancel ? ["jump"] : []),
    ],
    cancelWindow: {
      fromTick: s.windows?.at(-1)?.fromTick ?? s.startup,
      toTick: s.end + 9,
    },
    poses: cells.map((c) => {
      const at = clock;
      clock += c.ticks;
      const active =
        at >= s.startup &&
        at < s.end &&
        (!s.windows ||
          s.windows.some((w) => at >= w.fromTick && at < w.toTick));
      return {
        ticks: c.ticks,
        phase: active ? "active" : at < s.startup ? "startup" : "recovery",
        hurtboxes: astaBody.standing,
        hitboxes:
          active && !s.projectile ? [astaSpecialBlade(id, at, relay)] : [],
      };
    }),
  };
}
const relayCache = new Map<string, Move>();
export function astaRelayMove(
  sword: AstaSword,
  phase: AstaRelayState["phase"] = "opening",
  extensions = 0,
): Move {
  const key = sword + phase + extensions,
    cached = relayCache.get(key);
  if (cached) return cached;
  const finish = phase === "finish",
    slasher = sword === "slasher";
  const r = { sword, phase } as AstaRelayState;
  const startup = finish ? 3 : slasher ? 3 : sword === "destroyer" ? 5 : 4;
  const end = finish
    ? slasher
      ? 10
      : 7
    : slasher
      ? 9
      : sword === "destroyer"
        ? 9
        : sword === "dweller"
          ? 9
          : 8;
  const damage = finish
    ? { slayer: 68, slasher: 45, dweller: 56, destroyer: 54 }[sword]
    : phase === "opening"
      ? { slayer: 42, slasher: 17, dweller: 34, destroyer: 32 }[sword]
      : { slayer: 43, slasher: 14, dweller: 31, destroyer: 30 }[sword];
  const result = buildMove(
    "astaDualBreak",
    {
      startup,
      end,
      stages: [{ at: 2, sword }],
      damage,
      stun: finish ? 20 : Math.max(20, 31 - extensions * 3),
      push: finish ? 6 : sword === "slayer" ? 1.8 : 0.55,
      launch: finish ? 3 : sword === "destroyer" ? -3.5 : 0,
      rank: finish ? 4 : 3,
      knockdown: finish,
      drive: {
        from: 1,
        to: startup + 1,
        speed: sword === "dweller" ? 11 : sword === "slasher" ? 7 : 5,
      },
      windows: slasher
        ? finish
          ? [
              {
                id: 1,
                fromTick: 3,
                toTick: 5,
                damage: 22,
                push: 0.4,
                launch: 0,
                knockdown: false,
              },
              {
                id: 2,
                fromTick: 7,
                toTick: 10,
                damage: 27,
                push: 6,
                launch: 3,
                knockdown: true,
              },
            ]
          : [
              { id: 1, fromTick: 3, toTick: 5, damage },
              { id: 2, fromTick: 7, toTick: 9, damage },
            ]
        : undefined,
    },
    r,
  );
  relayCache.set(key, result);
  return result;
}
export const astaSpecialMoves = Object.fromEntries(
  astaSpecialIds.map((id) => [
    id,
    id === "astaDualBreak"
      ? astaRelayMove("slayer")
      : buildMove(id, astaTechniques[id]),
  ]),
) as Record<AstaSpecialId, Move>;
const pursuitMove = buildMove("astaBlackSlashPursuit", {
  startup: 5,
  end: 10,
  stages: [{ at: 1, sword: "dweller" }],
  damage: 46,
  stun: 26,
  push: 2,
  launch: 0,
  rank: 3,
  chain: true,
  drive: { from: 1, to: 8, speed: 18 },
});
export function astaRuntimeMove(f: Fighter, id: AstaActionId): Move {
  if (id === "astaDualBreak") {
    const r = f.asta?.relay;
    return astaRelayMove(r?.sword ?? f.asta!.equipped, r?.phase, r?.extensions);
  }
  if (id === "astaBlackSlashPursuit") return pursuitMove;
  const m = astaSpecialMoves[id];
  if (id === "astaBlackRush" && f.hitConfirmed)
    return { ...m, recovery: m.recovery - 4 };
  if (id === "astaCausalityBreak" && f.asta?.neutralized)
    return { ...m, damage: 80, launch: -10, stun: 30 };
  return m;
}
export function canStartAstaSpecial(f: Fighter, id: AstaActionId) {
  const s = f.asta;
  if (
    !s ||
    s.relay ||
    f.health <= 0 ||
    f.airborne ||
    f.knockedDown ||
    f.match?.capture ||
    f.match?.cinematicActive ||
    f.match?.temporal.isFrozen(f.id)
  )
    return false;
  if (id === "astaBlackSlashPursuit")
    return (
      !!s.pursuit &&
      !s.pursuit.used &&
      f.match!.frame <= s.pursuit.until &&
      (["idle", "walk", "crouch"].includes(f.state) ||
        (f.state === "attack" &&
          f.moveId === "astaBlackSlash" &&
          f.stateFrame >= 7))
    );
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
  const last = f.move?.hitWindows?.at(-1);
  if (
    f.state === "attack" &&
    f.moveId === "astaFlashSteps" &&
    last &&
    !f.hitIds.includes(last.id)
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
  f.asta.projectileCooldown = 60;
  f.asta.pursuit = {
    cast: f.asta.cast,
    until: m.frame + 32,
    used: false,
    minSerial: f.buffer.snapshot().serial,
  };
}
export const astaWaveVolume = (p: KiProjectile): Capsule => ({
  a: { x: p.previousX, y: p.y - 22 },
  b: { x: p.x, y: p.y + 22 },
  r: 6,
});
export function astaSpecialSegment(
  id: AstaActionId,
  tick: number,
  relay?: AstaRelayState,
) {
  const segments = art[astaArtKey(id, relay)];
  let start = 0;
  for (let index = 0; index < segments.length; index++) {
    const n = segments[index].durations.reduce((a, b) => a + b, 0);
    if (tick < start + n || index === segments.length - 1)
      return { index, start };
    start += n;
  }
  return { index: 0, start: 0 };
}
