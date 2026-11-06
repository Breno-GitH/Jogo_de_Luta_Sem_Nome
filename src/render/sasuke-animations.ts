import {
  sasukeClips,
  sasukeFrames,
  sasukeNormals,
} from "../engine/sasuke-data";
import { sasukeSpecialFrames, sasukeSpecialIds, sasukeTechniques } from "../engine/sasuke-specials";
import { curseAwaken, curseRevert, sasukeCurseArt, sasukeCurseBalance, sasukeCurseMoves } from "../engine/sasuke-curse";
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
  add(id, "specials", sasukeSpecialFrames(id), sasukeTechniques[id].holds);

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
