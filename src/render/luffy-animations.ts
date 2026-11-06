import locomotion from "../data/luffy-animations.json";
import { luffyNormals } from "../engine/luffy-normals";
import { luffySpecialNames, luffySpecialMoves } from "../engine/luffy-specials";
import { luffySecondaryClips } from "../engine/luffy-secondary";
import { jetClips, jetId, jetStartupClip } from "../engine/luffy-jet-gigant";
import type { AnimationData } from "./animator";

let first = 0;
const attacks: AnimationData["clips"] = {};
for (const [id, move] of Object.entries(luffyNormals)) {
  attacks[id] = {
    sheet: "luffy/normals.png",
    frames: move.holds.map(() => first++),
    ticks: 1,
    durations: move.holds,
    loop: false,
  };
}
for (const id of Object.keys(luffySpecialMoves)) {
  const row = luffySpecialNames.findIndex((name) => id.startsWith(name + "_"));
  attacks[id] = {
    sheet: "luffy/specials.png",
    frames: [0, 1, 2, 3].map((column) => row * 4 + column),
    ticks: 1,
    loop: false,
  };
}

export const luffyAnimations: AnimationData = {
  ...locomotion,
  clips: {
    ...locomotion.clips,
    ...attacks,
    ...jetClips,
    [jetId]: jetStartupClip,
    ...Object.fromEntries(
      Object.entries(luffySecondaryClips).map(
        ([name, { frames, durations, loop }]) => [
          name,
          { frames, durations, loop, ticks: 1, sheet: "luffy/secondary.png" },
        ],
      ),
    ),
  },
};
