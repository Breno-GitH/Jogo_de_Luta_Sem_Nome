import base from "../data/sasuke.json";
import frames from "../data/sasuke-frames.json";
import clips from "../data/sasuke-clips.json";
import normals from "../data/sasuke-normals.json";
import { sasukeGrab, sasukeThrow } from "./sasuke-grab";
import { sasukeSpecialMoves } from "./sasuke-specials";
import { kirinConfig, kirinId, kirinOpener } from "./sasuke-kirin";
import type { CharacterData, CombatPose, Move } from "./types";

export const sasukeNormals = normals;
type NormalId = keyof typeof normals;
type ArtCel = Omit<CombatPose, "ticks" | "phase"> & { frame: number };
export const sasukeFrames = frames as {
  movement: Record<string, number[]>;
  normals: Record<NormalId, ArtCel[]>;
  reactions: Record<string, ArtCel[]>;
};
export const sasukeClips = clips;
export const sasukeMoves: Record<string, Move> = Object.fromEntries(
  (Object.keys(normals) as NormalId[]).map((id) => {
    const {
      holds,
      activeFrames: [first, end],
      ...stats
    } = normals[id];
    const [stance, weight] = id.split("_");
    const rank = weight === "light" ? 1 : weight === "medium" ? 2 : 3;
    const duration = (start: number, stop: number) =>
      holds.slice(start, stop).reduce((a, b) => a + b, 0);
    const startup = duration(0, first),
      active = duration(first, end);
    const recovery = duration(end, holds.length);
    const next = rank === 1 ? "medium" : rank === 2 ? "heavy" : undefined;
    return [
      id,
      {
        ...stats,
        startup,
        active,
        recovery,
        rank,
        kind: "strike",
        box: { x: 0, y: 0, w: 0, h: 0 },
        cancels: [
          ...(next ? [next] : id === "crouch_heavy" ? ["jump"] : []),
          ...(stance !== "air" ? ["special"] : []),
        ],
        cancelMoves: next ? [`${stance}_${next}`] : [],
        cancelWindow: {
          fromTick: startup,
          toTick: startup + active + (id === "crouch_heavy" ? 9 : 6),
        },
        poses: sasukeFrames.normals[id].map(({ frame: _, ...cel }, index) => ({
          ...cel,
          ticks: holds[index],
          phase:
            index < first ? "startup" : index < end ? "active" : "recovery",
        })),
      },
    ];
  }),
);
export const sasuke: CharacterData = {
  ...base,
  moves: { ...sasukeMoves, throw: sasukeThrow },
  grabSequence: sasukeGrab,
  specialMoves: sasukeSpecialMoves,
  superMoves: { [kirinId]: kirinOpener },
  meterMaximum: kirinConfig.cost,
  meterGainScale: 1,
  lifecycle: {
    entranceDistance: 58,
    entranceWalkTicks: 20,
    entranceSpeed: 2.9,
    tauntTicks: 36,
    getupTicks: 20,
    koTicks: 55,
  },
  hurtboxes: {
    standing: [
      { x: -18, y: -127, w: 40, h: 29 },
      { x: -25, y: -99, w: 58, h: 53 },
      { x: -31, y: -46, w: 68, h: 46 },
    ],
    crouching: [
      { x: -13, y: -83, w: 35, h: 29 },
      { x: -31, y: -56, w: 70, h: 55 },
    ],
    air: [
      { x: -20, y: -119, w: 43, h: 31 },
      { x: -29, y: -89, w: 62, h: 77 },
    ],
  },
  reactions: Object.fromEntries(
    Object.entries(sasukeFrames.reactions).map(([id, cels]) => [
      id,
      {
        loop: id === "guardStand" || id === "guardCrouch" || id === "falling",
        poses: cels.map((cel, index) => ({
          ticks: clips[id as keyof typeof clips][index],
          hurtboxes: cel.hurtboxes,
        })),
      },
    ]),
  ),
};
