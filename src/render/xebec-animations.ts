import movement from "../data/xebec-animations.json";
import { xebecNormals } from "../engine/xebec";
import { xebecSpecialArt } from "../engine/xebec-specials";
import { pandemoniumConfig, pandemoniumId } from "../engine/xebec-pandemonium";
import type { AnimationClip, AnimationData } from "./animator";

const clip = (sheet: string, frames: number[], durations: number[], loop = false): AnimationClip =>
  ({ sheet: `xebec/${sheet}.png`, frames, durations, ticks: 1, loop });
const reaction = (frames: number[], durations: number[], loop = false) =>
  clip("reactions", frames, durations, loop);
const rush = (frames: number[], durations: number[]) => clip("rush", frames, durations);
const cinema = (frames: number[], durations: number[]) => clip("pandemonium", frames, durations);
const normals = Object.fromEntries(
  Object.entries(xebecNormals).map(([id, { frames, holds }]) => [id, clip("normals", frames, holds)]),
);

export const xebecAnimations: AnimationData = {
  ...movement,
  clips: {
    ...movement.clips,
    crouchStart: reaction([1, 2], [3, 3]),
    crouchIdle: reaction([2], [1], true),
    crouchEnd: reaction([1, 0], [3, 3]),
    jumpStart: reaction([1, 3], [2, 3]),
    jumpRise: reaction([4, 5], [3, 16]),
    jumpApex: reaction([6], [1], true),
    jumpFall: reaction([7, 4], [7, 18]),
    landing: reaction([8, 1, 0], [3, 2, 2]),
    guard: reaction([9], [1]),
    guardHigh: reaction([9], [1]),
    guardLow: reaction([10], [1]),
    hitHigh: reaction([11, 0], [9, 3]),
    hitLow: reaction([12, 1], [9, 3]),
    hitAir: reaction([13], [1]),
    launched: reaction([13], [1]),
    grabbed: reaction([11, 12], [5, 20]),
    downed: reaction([14], [1]),
    getup: reaction([15, 1, 0], [6, 5, 5]),
    ko: reaction([14], [1]),
    entrance: { ...movement.clips.walkForward, loop: false },
    taunt: rush([7, 6, 7], [9, 25, 12]),
    defeat: reaction([14], [1]),
    victory: cinema([10, 11], [12, 64]),
    throw: cinema([12, 13, 12, 2], [8, 4, 9, 15]),
    grabHold: cinema([13, 14, 15], [9, 15, 10]),
    throwRecover: cinema([15, 10, 2], [5, 7, 6]),
    ...normals,
    ...Object.fromEntries(Object.entries(xebecSpecialArt).map(([id, pose]) =>
      [id, clip(pose.sheet, pose.frames, pose.durations)])),
    xebecBrutalHold: rush([2, 3], [13, 4]),
    xebecBrutalRecover: rush([3, 7], [5, 13]),
    xebecDominionHold: rush([2, 4, 6], [6, 17, 4]),
    xebecDominionLink: rush([6, 2, 7], [3, 6, 4]),
    xebecExplosionHold: rush([2, 5, 4, 6], [8, 15, 10, 4]),
    xebecExplosionRecover: rush([6, 4, 7], [6, 6, 6]),
    [pandemoniumId]: clip("pandemonium-combat", [0, 1, 7, 2], [14, 5, 10, 25]),
    pandemoniumScene: clip("pandemonium-combat", [1, 2, 3, 4, 5, 6, 7],
      [10, 24, 26, 26, 49, 12, 55]),
    pandemoniumOutro: cinema([9, 10, 11], [12, 10, pandemoniumConfig.duration - 224]),
  },
};
