import type { AnimationClip } from "./animator";
import type { Fighter } from "../engine/combat";
import { astaUnionId } from "../engine/asta-super";
import { unionBodyClips } from "../engine/asta-super-acts";
export const astaSuperClips = Object.fromEntries(
  Object.entries(unionBodyClips).map(([id, b]) => [
    id,
    {
      sheet: "asta/" + b.sheet + ".png",
      frames: b.frames,
      durations: b.durations,
      ticks: 1,
      loop: false,
    },
  ]),
) as Record<keyof typeof unionBodyClips, AnimationClip>;
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
