import movement from "../data/xebec-animations.json";
import { xebecNormals } from "../engine/xebec";
import { pandemoniumConfig, pandemoniumId } from "../engine/xebec-pandemonium";
import type { AnimationClip, AnimationData } from "./animator";

const clip = (sheet: string, frames: number[], durations: number[], loop = false): AnimationClip =>
  ({ sheet: `xebec/${sheet}.png`, frames, durations, ticks: 1, loop });
const reaction = (frames: number[], durations: number[], loop = false) =>
  clip("reactions", frames, durations, loop);
const special = (frames: number[], durations: number[]) => clip("specials", frames, durations);
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
    taunt: special([15, 5, 15], [9, 25, 12]),
    defeat: reaction([14], [1]),
    victory: cinema([10, 11], [12, 64]),
    throw: cinema([12, 13, 12, 2], [8, 4, 9, 15]),
    grabHold: cinema([13, 14, 15], [9, 15, 10]),
    throwRecover: cinema([15, 10, 2], [5, 7, 6]),
    ...normals,
    xebecLightning: special([0, 1, 15], [8, 5, 14]),
    xebecRift: special([7, 0, 2, 15], [9, 7, 4, 24]),
    xebecRupture: special([0, 3, 4, 12, 15], [5, 14, 7, 12, 21]),
    xebecIntimidation: special([0, 5, 15], [6, 4, 20]),
    xebecPressure: special([12, 0, 6, 15], [5, 7, 5, 23]),
    xebecCollision: special([12, 7, 15], [4, 8, 29]),
    xebecRiposte: special([7, 8, 11, 15], [1, 5, 8, 15]),
    xebecBrutal: special([0, 9, 10, 15], [7, 4, 5, 10]),
    xebecBreaker: special([12, 9, 10, 11, 8, 15], [10, 4, 6, 5, 9, 14]),
    xebecConqueror: special([12, 0, 13, 10, 14, 4, 15], [7, 6, 4, 6, 6, 10, 22]),
    [pandemoniumId]: cinema([0, 1, 2, 10], [14, 5, 10, 25]),
    pandemoniumScene: cinema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [13, 25, 22, 26, 22, 27, 8, 12, 23, 27, pandemoniumConfig.duration - 205]),
  },
};
