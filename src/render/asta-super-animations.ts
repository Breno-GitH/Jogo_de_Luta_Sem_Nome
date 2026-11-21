import type { AnimationClip } from "./animator";
import type { Fighter } from "../engine/combat";
import { astaUnionId } from "../engine/asta-super";
const clip = (
  sheet: string,
  frames: number[],
  durations: number[],
): AnimationClip => ({
  sheet: "asta/" + sheet + ".png",
  frames,
  durations,
  ticks: 1,
  loop: false,
});
export const astaSuperClips = {
  unionStart: clip("r-black-start", [0, 1, 2, 3, 4, 5], [2, 2, 2, 3, 3, 2]),
  unionMeteorite: clip(
    "r-black-flight",
    [0, 1, 2, 3, 4, 5],
    [3, 3, 4, 4, 4, 4],
  ),
  unionMissPartial: clip("r-black-start", [0, 1], [5, 5]),
  unionMiss: clip("r-union-return", [4, 5], [8, 14]),
  unionBlackBrace: clip("r-black-flight", [4, 5], [13, 13]),
  unionPartialReady: clip("r-black-start", [0, 1], [3, 3]),
  unionChange: clip("r-union-change", [3, 4, 5], [8, 10, 10]),
  unionRush: clip("r-union-rush", [0, 1, 2], [6, 12, 12]),
  unionCross: clip("r-union-rush", [3, 4, 5], [6, 8, 14]),
  unionRise: clip("r-union-rise", [0, 1, 2, 3, 4, 5], [3, 3, 6, 4, 5, 7]),
  unionDive: clip("r-union-dive", [0, 1, 2, 3, 4, 5], [4, 4, 5, 5, 5, 7]),
  unionEquinoxCharge: clip("r-equinox", [0, 1], [10, 14]),
  unionEquinox: clip("r-equinox", [2, 3, 4, 5], [8, 3, 5, 6]),
  unionPartialReturn: clip("r-black-start", [0, 1], [5, 5]),
  unionBaseReturn: clip("r-union-return", [4, 5], [6, 5]),
  unionReturn: clip("r-union-return", [0, 1, 2, 3, 4, 5], [4, 4, 5, 5, 7, 9]),
};
export function astaSuperOpeningPose(f: Fighter) {
  if (f.state !== "attack" || f.moveId !== astaUnionId) return;
  const t = f.stateFrame;
  return t < 14
    ? { clip: "unionStart", tick: t }
    : t < 26
      ? { clip: "unionMeteorite", tick: Math.min(13, t - 14) }
      : t < 36
        ? { clip: "unionMissPartial", tick: t - 26 }
        : { clip: "unionMiss", tick: t - 36 };
}
