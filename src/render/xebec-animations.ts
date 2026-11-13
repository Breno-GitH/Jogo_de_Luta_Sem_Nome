import movement from "../data/xebec-animations.json";
import { xebecNormals } from "../engine/xebec";
import type { AnimationClip, AnimationData } from "./animator";

const idle: AnimationClip = {
  sheet: "xebec/normals.png",
  frames: [0, 1, 0, 2],
  ticks: 12,
};

const normals = Object.fromEntries(
  Object.entries(xebecNormals).map(([id, { frames, holds }]) => [
    id,
    { ...idle, frames, durations: holds, ticks: 1, loop: false },
  ]),
);

export const xebecAnimations: AnimationData = {
  ...movement,
  clips: { ...movement.clips, idle, ...normals },
};
