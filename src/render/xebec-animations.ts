import movement from "../data/xebec-animations.json";
import { xebecNormals, xebecSpecials } from "../engine/xebec";
import { pandemoniumId } from "../engine/xebec-pandemonium";
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

const specialSheet = "xebec/specials.png";
const special = (frames: number[], durations: number[]): AnimationClip => ({
  sheet: specialSheet,
  frames,
  durations,
  ticks: 1,
  loop: false,
});

export const xebecAnimations: AnimationData = {
  ...movement,
  clips: {
    ...movement.clips,
    idle,
    ...normals,
    damageHeavy: { frames: [16, 18], ticks: 6, loop: false },
    damageAir: { frames: [17, 12], ticks: 6, loop: false },
    launched: { frames: [17, 12], ticks: 6, loop: false },
    falling: { frames: [17, 12], ticks: 7, loop: false },
    downed: special([43], [30]),
    grabbed: { frames: [16], ticks: 1 },
    ko: special([43], [30]),
    [pandemoniumId]: special([27, 36, 28, 37, 34], [7, 5, 6, 10, 22]),
    pandemoniumConfirm: special([28, 37, 42], [8, 8, 6]),
    pandemoniumCharge: special([29, 30, 31], [14, 27, 11]),
    pandemoniumImpact: special([32, 33, 34], [5, 15, 22]),
    pandemoniumReturn: special([34, 35], [10, 16]),
    ...Object.fromEntries(
      Object.entries(xebecSpecials.art).map(([id, art]) => [
        id,
        special(art.frames, art.durations),
      ]),
    ),
  },
};
