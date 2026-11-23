import art from "../data/entrance-art.json";
import dio from "../data/dio-animations.json";
import type { AnimationData, AnimationClip, Animator } from "./animator";

/** Body cels only; the existing arsenal, Stand and code FX remain independent. */
export const entranceAnimationSets: Record<string, AnimationData> =
  Object.fromEntries(
    Object.entries(art.characters).map(([id, clip]) => [
      id,
      {
        sheet: clip.sheet,
        frameWidth: 256,
        frameHeight: 256,
        columns: 4,
        pivot: { x: 128, y: 224 },
        scale: 1,
        clips: {
          entrance: clip,
          ready: { ...clip, frames: [7], durations: [12], loop: true },
        },
      },
    ]),
  );
entranceAnimationSets.dio = {
  ...dio,
  clips: {
    entranceWalk: dio.clips.walkForward,
    entrance: dio.clips.secondaryEntrance,
    ready: { ...dio.clips.idle, loop: true },
  },
};
const duration = (clip: AnimationClip) =>
  clip.frames.reduce(
    (sum, _, i) => sum + (clip.durations?.[i] ?? clip.ticks),
    0,
  );
export function seekEntrance(animator: Animator, id: string, age: number) {
  const set = entranceAnimationSets[id];
  const walk = id === "dio" ? 36 : 0;
  let clip = "entrance",
    tick = age - walk;
  if (age < walk) {
    clip = "entranceWalk";
    tick = age;
  } else if (tick >= duration(set.clips.entrance)) {
    tick -= duration(set.clips.entrance);
    clip = "ready";
  }
  animator.update(clip);
  animator.seekTick(Math.max(0, tick));
}
