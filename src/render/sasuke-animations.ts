import {
  sasukeClips,
  sasukeFrames,
  sasukeNormals,
} from "../engine/sasuke-data";
import { sasukeSpecialFrames, sasukeSpecialIds, sasukeSpecialMoves } from "../engine/sasuke-specials";
import { curseAwaken, curseRevert, sasukeCurseArt, sasukeCurseBalance, sasukeCurseMoves } from "../engine/sasuke-curse";
import { chidoriProfile } from "../engine/sasuke-polish";
import { kirinConfig, kirinId } from "../engine/sasuke-kirin";
import type { AnimationClip, AnimationData } from "./animator";

const clips: AnimationData["clips"] = {};
const loops = new Set([
  "idle",
  "walkForward",
  "walkBack",
  "crouchIdle",
  "guardStand",
  "guardCrouch",
  "falling",
]);
function add(
  name: string,
  sheet: string,
  frames: number[],
  durations: number[],
) {
  clips[name] = {
    sheet: `sasuke/${sheet}.png`,
    frames,
    durations,
    ticks: 1,
    loop: loops.has(name),
  };
}
for (const [name, frames] of Object.entries(sasukeFrames.movement))
  add(name, "movement", frames, sasukeClips[name as keyof typeof sasukeClips]);
for (const [name, frames] of Object.entries(sasukeFrames.normals))
  add(
    name,
    "normals",
    frames.map((f) => f.frame),
    sasukeNormals[name as keyof typeof sasukeNormals].holds,
  );
for (const [name, frames] of Object.entries(sasukeFrames.reactions))
  add(
    name,
    "reactions",
    frames.map((f) => f.frame),
    sasukeClips[name as keyof typeof sasukeClips],
  );

for (const id of sasukeSpecialIds)
  add(id, "specials", sasukeSpecialFrames(id), sasukeSpecialMoves[id].poses!.map(p => p.ticks));

export const sasukeCurseSheet = "sasuke/curse.png";
export const curseClipName = (name: string) =>
  name === curseAwaken || name === curseRevert ? name : `curse_${name}`;
for (const [name, { frames, holds }] of Object.entries(sasukeCurseArt.clips)) {
  clips[curseClipName(name)] = {
    sheet: sasukeCurseSheet, frames, ticks: 1, loop: loops.has(name),
    durations: name === curseAwaken ? sasukeCurseBalance.activationHolds
      : name === curseRevert ? sasukeCurseBalance.reversionHolds
        : sasukeCurseMoves[name]?.poses?.map(p => p.ticks) ?? holds,
    frameWidth: 384, frameHeight: 288, columns: 8, pivot: { x: 192, y: 248 },
  };
}

export const chidoriCurseSheet = "sasuke/chidori-dash-curse.png";
for (const cursed of [false, true]) {
  clips[cursed ? curseClipName("chidori") : "chidori"] = {
    sheet: cursed ? chidoriCurseSheet : "sasuke/chidori-dash.png",
    frames: [0, 1, 2, 3, 4, 5], durations: chidoriProfile(cursed).holds, ticks: 1, loop: false,
    frameWidth: 384, frameHeight: 288, columns: 3, pivot: { x: 192, y: 248 },
  };
}

export const kirinCurseSheet = "sasuke/kirin-curse.png";
for (const cursed of [false, true]) {
  for (const [name, frames, durations] of [
    [kirinId, [0, 1, 2], kirinConfig.opening.holds],
    ["kirinPrepare", [3, 4], [17, 120]],
    ["kirinCommand", [4, 5, 6], [8, 10, 15]],
    ["kirinRelease", [7, 8], [31, 90]],
  ] as const) {
    clips[cursed ? curseClipName(name) : name] = {
      sheet: cursed ? kirinCurseSheet : "sasuke/kirin-base.png",
      frames: [...frames], durations: [...durations], ticks: 1, loop: false,
      frameWidth: 384, frameHeight: 288, columns: 3, pivot: { x: 192, y: 248 },
    };
  }
}

export const sasukeAnimations: AnimationData = {
  sheet: "sasuke/movement.png",
  frameWidth: 256,
  frameHeight: 256,
  columns: 8,
  pivot: { x: 128, y: 224 },
  scale: 1,
  clips,
};
export function sasukeClipTicks(name: string) {
  const clip: AnimationClip = clips[name];
  return clip.durations!.reduce((sum, hold) => sum + hold, 0);
}
