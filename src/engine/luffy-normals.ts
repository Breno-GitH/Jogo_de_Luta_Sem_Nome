import normals from "../data/luffy-normals.json";
import joints from "../data/luffy-normal-joints.json";
import { luffyFootPoint, luffyFootPose } from "./luffy-foot";
import { elasticGeometry } from "./elastic";
import { phaseAt } from "./moves";
import type { CharacterData, Move, Point, Rect, State } from "./types";

type Spec = (typeof normals)[keyof typeof normals];
export const luffyNormals = normals as Record<string, Spec>;
const normalPoses: Record<string, { joint: number[]; hurtboxes: Rect[] }[]> =
  joints;

function buildMove(id: string, spec: Spec): Move {
  const {
    holds,
    active: [first, end],
    cancels,
  } = spec;
  const total = (from: number, to: number) =>
    holds.slice(from, to).reduce((sum, ticks) => sum + ticks, 0);
  const startup = total(0, first);
  const active = total(first, end);
  const recovery = total(end, holds.length);
  return {
    ...spec,
    startup,
    active,
    recovery,
    rank: id.endsWith("_light") ? 1 : id.endsWith("_medium") ? 2 : 3,
    launch: "launch" in spec ? spec.launch : 0,
    kind: "strike",
    box: { x: 0, y: 0, w: 0, h: 0 },
    poses: holds.map((ticks, index) => ({
      ticks,
      phase: index < first ? "startup" : index < end ? "active" : "recovery",
      hurtboxes: normalPoses[id][index].hurtboxes,
    })),
    cancelWindow: {
      fromTick: startup,
      toTick: startup + active + Math.min(8, recovery - 1),
    },
    cancels: [...cancels, ...(!id.startsWith("air_") ? ["special"] : [])],
    cancelMoves: cancels.map((button) => id.replace(/_[^_]+$/, "_" + button)),
  };
}

export const luffyMoves: CharacterData["moves"] = Object.fromEntries(
  Object.entries(luffyNormals).map(([id, spec]) => [id, buildMove(id, spec)]),
);

export interface LuffyActor {
  data: { id: string };
  state: State;
  moveId: string;
  move?: Move;
  stateFrame: number;
  facing: number;
  x: number;
  y: number;
}

function limbAt(actor: LuffyActor, spec: Spec, tick: number) {
  let remaining = tick;
  let frame = 0;
  while (frame < spec.holds.length - 1 && remaining >= spec.holds[frame]) {
    remaining -= spec.holds[frame++];
  }

  const t = Math.min(1, remaining / spec.holds[frame]);
  const end = spec.active[1];
  const atPeak = frame === end - 1 && spec.holds[frame] >= 4;
  const firstRecovery = frame === end && spec.holds[frame - 1] >= 4;
  const startIndex = firstRecovery && t < 0.5 ? frame - 1 : frame;
  const [x, y, bend] = spec.track[startIndex];
  const next = spec.track[Math.min(startIndex + 1, spec.track.length - 1)];
  const release = firstRecovery ? (t < 0.5 ? t * 2 : t * 2 - 1) : t;
  const fraction = atPeak ? 0 : frame >= end ? release * (2 - release) : t;
  const tip = {
    x: x + (next[0] - x) * fraction,
    y: y + (next[1] - y) * fraction,
  };
  const foot = spec.kind === "foot";
  const [jointX, jointY] = normalPoses[actor.moveId][frame].joint;
  const root = { x: jointX, y: jointY };
  return {
    ...buildLuffyLimb(
      actor,
      root,
      tip,
      bend + (next[2] - bend) * fraction,
      foot,
      Math.max(
        ...spec.track.map(([px, py]) => Math.hypot(px - root.x, py - root.y)),
      ),
    ),
    frame,
  };
}

export function buildLuffyLimb(
  actor: LuffyActor,
  root: Point,
  desiredTip: Point,
  bend: number,
  foot = false,
  maximumLength = 540,
) {
  // Reserve room for the terminal outline at both walls and the floor.
  const left = actor.facing === 1 ? 16 - actor.x : actor.x - 1264;
  const right = actor.facing === 1 ? 1264 - actor.x : actor.x - 16;
  const tip = {
    x: Math.max(left, Math.min(right, desiredTip.x)),
    y: Math.max(16 - actor.y, Math.min(564 - actor.y, desiredTip.y)),
  };
  const geometry = elasticGeometry({
    root,
    tip,
    bend,
    radius: foot ? 9 : 7,
    profile: foot ? "leg" : "arm",
    maximumLength,
    active: false,
  });
  const prior = geometry.centers.at(-2)!;
  const dx = geometry.tip.x - prior.x;
  const dy = geometry.tip.y - prior.y;
  const length = Math.hypot(dx, dy);
  const axis = length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
  const nose = {
    x: Math.round(geometry.tip.x + (foot ? 9 : 6) * axis.x),
    y: Math.round(geometry.tip.y + (foot ? 9 : 6) * axis.y),
  };
  const footPose = foot
    ? luffyFootPose(
        actor.moveId,
        Math.hypot(geometry.tip.x - root.x, geometry.tip.y - root.y),
      )
    : undefined;
  const terminal = footPose
    ? {
        a: luffyFootPoint(geometry.tip, axis, footPose, -4, 3),
        b: luffyFootPoint(geometry.tip, axis, footPose, footPose.contact, 2),
        r: 5,
      }
    : { a: geometry.tip, b: nose, r: 7 };
  return {
    ...geometry,
    foot,
    axis,
    footPose,
    limbHurtboxes: [...geometry.limbHurtboxes, terminal],
    terminal,
  };
}

/** Stateless fixed-tick geometry shared by both collision and presentation. */
export function luffyLimb(actor: LuffyActor) {
  if (actor.data.id !== "luffy" || actor.state !== "attack" || !actor.move)
    return;
  const spec = luffyNormals[actor.moveId];
  if (!spec) return;
  const limb = limbAt(actor, spec, actor.stateFrame);
  const { terminal } = limb;
  const hitboxes = [];
  if (phaseAt(actor.move, actor.stateFrame) === "active") {
    hitboxes.push(terminal);
    if (actor.stateFrame > 0) {
      const previous = limbAt(actor, spec, actor.stateFrame - 1).terminal;
      // Sweep the rounded terminal between simulation samples. The shaft
      // stays vulnerable and never becomes an offensive volume.
      if (previous.a.x !== terminal.a.x || previous.a.y !== terminal.a.y)
        hitboxes.push({ a: previous.a, b: terminal.a, r: terminal.r });
      if (previous.b.x !== terminal.b.x || previous.b.y !== terminal.b.y)
        hitboxes.push({ a: previous.b, b: terminal.b, r: terminal.r });
    }
  }
  return { ...limb, hitboxes };
}
