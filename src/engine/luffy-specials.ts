import balance from "../data/luffy-specials.json";
import poses from "../data/luffy-special-poses.json";
import { buildLuffyLimb, luffyLimb, type LuffyActor } from "./luffy-normals";
import type { CommandBuffer } from "./input";
import type { Button, Capsule, Move, Rect } from "./types";

export type LuffySpecial = keyof typeof balance;
export const luffySpecialNames = Object.keys(balance) as LuffySpecial[];
const strengths = ["light", "medium", "heavy"] as const;
const pulseTicks = 6;
const data: Record<LuffySpecial, { joints: number[][]; hurtboxes: Rect[] }[]> =
  poses;
const specByMove = new Map<string, { name: LuffySpecial; rank: number }>();

export function luffySpecialCommand(buffer: CommandBuffer, button: Button) {
  const motion = buffer.gokuSpecial(button);
  return motion === "ki"
    ? "pistol"
    : motion === "kamehameha"
      ? "gatling"
      : motion === "teleport"
        ? "bazooka"
        : undefined;
}

function bodyFrame(
  name: LuffySpecial,
  tick: number,
  startup: number,
  active: number,
) {
  if (tick < startup) return tick < Math.ceil(startup * 0.55) ? 0 : 1;
  if (tick >= startup + active) return 3;
  if (name === "gatling")
    return 1 + (Math.floor((tick - startup) / pulseTicks) % 2);
  return tick - startup < 2 ? 1 : 2;
}

export const luffySpecialMoves: Record<string, Move> = {};
for (const name of luffySpecialNames) {
  const spec = balance[name];
  for (const [index, strength] of strengths.entries()) {
    const id = name + "_" + strength;
    const startup = spec.startup[index],
      active = spec.active[index],
      recovery = spec.recovery[index];
    specByMove.set(id, { name, rank: index });
    luffySpecialMoves[id] = {
      special: name,
      kind: "strike",
      startup,
      active,
      recovery,
      damage: spec.damage[index],
      stun: spec.stun[index],
      blockstun: spec.blockstun[index],
      push: spec.push[index],
      launch: name === "bazooka" && index === 2 ? -6 : 0,
      knockdown: name === "bazooka" && index === 2,
      hitstop: name === "gatling" ? 3 : 5 + index,
      rank: index + 1,
      level: "mid",
      cancels: [],
      box: { x: 0, y: 0, w: 0, h: 0 },
      poses: Array.from({ length: startup + active + recovery }, (_, tick) => ({
        ticks: 1,
        phase:
          tick < startup
            ? "startup"
            : tick < startup + active
              ? "active"
              : "recovery",
        hurtboxes: data[name][bodyFrame(name, tick, startup, active)].hurtboxes,
      })),
      ...(name === "gatling"
        ? {
            hitWindows: Array.from(
              { length: active / pulseTicks },
              (_, pulse) => ({
                id: pulse,
                fromTick: startup + pulse * pulseTicks + 1,
                toTick: startup + pulse * pulseTicks + 5,
              }),
            ),
          }
        : {}),
    };
  }
}

export function luffySpecialFrame(actor: LuffyActor) {
  const spec = specByMove.get(actor.moveId);
  if (actor.state !== "attack" || !actor.move || !spec) return;
  return bodyFrame(
    spec.name,
    actor.stateFrame,
    actor.move.startup,
    actor.move.active,
  );
}

function limbsAt(
  actor: LuffyActor,
  name: LuffySpecial,
  rank: number,
  tick: number,
) {
  const move = actor.move!;
  const frame = bodyFrame(name, tick, move.startup, move.active);
  const after = tick - move.startup;
  const range = balance[name].reach[rank];
  const pulse = Math.max(0, Math.floor(after / pulseTicks));
  const within = after % pulseTicks;
  const live = after >= 0 && after < move.active;
  const recoil = Math.max(
    0,
    Math.min(1, (after - move.active) / (move.recovery * 0.77)),
  );
  const progress =
    name === "gatling"
      ? live
        ? [0, 0.33, 0.67, 0.91, 1, 0.48][within]
        : after >= move.active
          ? 0.38 * (1 - recoil)
          : 0
      : after < 0
        ? 0
        : live
          ? Math.min(1, (after + 1) / (name === "pistol" ? 6 : 4))
          : (1 - recoil) ** 2;
  const front = name === "gatling" ? pulse % 2 : 0;
  const depth = name === "bazooka" || name === "gatling" ? 2 : 1;
  return Array.from({ length: depth }, (_, side) => {
    const [x, y] = data[name][frame].joints[side];
    const driving = name !== "gatling" || side === front;
    const extent = driving ? progress : 0;
    const tucked = x + (after < 0 ? 5 - 20 * (tick / move.startup) : 12);
    const punchHeight =
      name === "gatling"
        ? -88 + ((pulse % 3) - 1) * 7
        : name === "bazooka"
          ? -80 + side * 10
          : -88;
    const length = range - (name === "gatling" ? (pulse % 3) * 5 : side * 4);
    const tip = {
      x: tucked + (length - tucked) * extent,
      y: y + 11 + (punchHeight - y - 11) * extent,
    };
    const limb = buildLuffyLimb(
      actor,
      { x, y },
      tip,
      (1 - extent) * (side ? -10 : 10),
    );
    return {
      ...limb,
      rear: side === 1,
      driving,
      palm: name === "bazooka",
      trail: live && extent > 0.3,
    };
  });
}

export function luffyAttackLimbs(actor: LuffyActor) {
  if (actor.data.id !== "luffy" || actor.state !== "attack" || !actor.move)
    return [];
  const spec = specByMove.get(actor.moveId);
  if (!spec) {
    const limb = luffyLimb(actor);
    return limb ? [{ ...limb, rear: false, trail: false, driving: false }] : [];
  }
  const current = limbsAt(actor, spec.name, spec.rank, actor.stateFrame);
  const active =
    actor.stateFrame >= actor.move.startup &&
    actor.stateFrame < actor.move.startup + actor.move.active &&
    (!actor.move.hitWindows ||
      actor.move.hitWindows.some(
        (w) => actor.stateFrame >= w.fromTick && actor.stateFrame < w.toTick,
      ));
  const previous =
    active && actor.stateFrame
      ? limbsAt(actor, spec.name, spec.rank, actor.stateFrame - 1)
      : [];
  return current.map((limb, i) => {
    const hitboxes: Capsule[] = active && limb.driving ? [limb.terminal] : [];
    const prev = previous[i]?.terminal;
    if (prev && hitboxes.length && prev.b.x < limb.terminal.b.x) {
      hitboxes.push({ a: prev.a, b: limb.terminal.a, r: limb.terminal.r });
      hitboxes.push({ a: prev.b, b: limb.terminal.b, r: limb.terminal.r });
    }
    return { ...limb, hitboxes };
  });
}
