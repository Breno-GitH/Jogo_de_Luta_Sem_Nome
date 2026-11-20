import {
  astaArtKey,
  astaSpecialSegment,
  isAstaAction,
  type AstaArtKey,
} from "../engine/asta-specials";
import specialArt from "../data/asta-special-art.json";
import movement from "../data/asta-animations.json";
import type { AnimationData, AnimationClip } from "./animator";
import { astaNormalIds, normalHolds } from "../engine/asta-normals";
import { visibleAstaSword } from "../engine/asta-stances";
import type { Fighter } from "../engine/combat";
import { reactionFor } from "../engine/lifecycle";
import { Animator } from "./animator";
export function astaAnimation(
  sword: import("../engine/asta-stances").AstaSword = "slayer",
): AnimationData {
  const clips: Record<string, AnimationClip> = { ...movement.clips };
  for (const id of astaNormalIds)
    clips[id] = {
      sheet: "asta/" + id + ".png",
      frames: [0, 1, 2, 3, 4, 5],
      ticks: 1,
      durations: normalHolds(sword, id),
      loop: false,
    };
  for (const id of Object.keys(specialArt) as AstaArtKey[])
    specialArt[id].forEach((s, i) => {
      clips[i ? id + ":" + i : id] = {
        sheet: "asta/" + s.sheet + ".png",
        frames: [0, 1, 2, 3, 4, 5],
        ticks: 1,
        durations: s.durations,
        loop: false,
      };
    });
  return { ...movement, clips };
}
export const astaAnimations = astaAnimation();
export function tickAsta(f: Fighter, animator: Animator) {
  const reaction = reactionFor(f);
  let name =
    reaction?.clip ??
    (f.state === "attack"
      ? f.moveId
      : f.state === "jumpStart" || f.state === "landing"
        ? f.state
        : f.asta?.airDashTicks
          ? "airDash"
          : f.state === "dash"
            ? f.dashDirection === f.facing
              ? "dashForward"
              : "backdash"
            : f.airborne
              ? f.vy < -3
                ? "jumpRise"
                : f.vy > 3
                  ? "jumpFall"
                  : "jumpApex"
              : f.state === "crouch"
                ? "crouchIdle"
                : f.state === "walk"
                  ? f.input.direction === f.facing
                    ? "walkForward"
                    : "walkBack"
                  : "idle");
  let seek = f.stateFrame;
  if (f.state === "attack" && isAstaAction(name)) {
    const segment = astaSpecialSegment(name, seek, f.asta?.relay);
    name = astaArtKey(name, f.asta?.relay);
    name = segment.index ? name + ":" + segment.index : name;
    seek -= segment.start;
  }
  let clip = animator.hasClip(name) ? name : "idle";
  if (!reaction && f.state === "crouch" && f.stateFrame < 4)
    clip = "crouchStart";
  if (
    !reaction &&
    ["idle", "walk"].includes(f.state) &&
    (["crouchIdle", "crouchStart"].includes(animator.clipName) ||
      (animator.clipName === "crouchEnd" && !animator.complete))
  )
    clip = "crouchEnd";
  animator.update(clip, f.stateFrame === 1);
  if (
    f.state === "attack" ||
    reaction ||
    f.state === "jumpStart" ||
    f.state === "landing" ||
    f.state === "dash"
  )
    animator.seekTick(reaction?.tick ?? seek);
}
/** Weapon choice is presented with the same latched state used by move lookup. */
export const astaVisualSword = visibleAstaSword;
