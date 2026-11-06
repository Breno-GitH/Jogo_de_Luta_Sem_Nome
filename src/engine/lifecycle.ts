import type { Fighter } from "./combat";

/** Pure state/phase selection shared by collision data and visual presentation. */
function logicalReactionFor(
  f: Fighter,
): { clip: string; tick: number } | undefined {
  const time = f.stateFrame;
  if (
    [
      "entrance",
      "taunt",
      "victory",
      "defeat",
      "getup",
      "ultimateRecover",
      "throwRecover",
      "ko",
    ].includes(f.state)
  )
    return { clip: f.state, tick: time };
  if (["cinematic", "grabbing", "grabbed"].includes(f.state))
    return { clip: f.actionClip || f.state, tick: time };
  if (f.state === "counter")
    return {
      clip: time < 6 ? "counterEntry" : "counterWait",
      tick: time < 6 ? time : time - 6,
    };
  if (f.state === "counterRecover") return { clip: "counterFail", tick: time };
  if (f.state === "blockstun") {
    if (f.data.id === "luffy" && time >= 6 && f.stun <= 4 && !f.guardIntent)
      return { clip: "guardRecovery", tick: Math.max(0, 4 - f.stun) };
    return {
      clip:
        time < 6
          ? f.blockCrouched
            ? "guardImpactCrouch"
            : "guardImpactStand"
          : f.blockCrouched
            ? "guardCrouch"
            : "guardStand",
      tick: time < 6 ? time : time - 6,
    };
  }
  if (f.state === "hitstun") {
    const clip =
      f.knockedDown && !f.airborne
        ? "downed"
        : f.airborne
          ? f.hitLaunch && f.vy < 0
            ? "launched"
            : f.data.id === "luffy" && !f.hitLaunch && time < 9 &&
                (f.knockedDown || f.reactionStrength >= 3)
              ? "airKnockback"
            : f.knockedDown || f.hitLaunch
              ? "falling"
              : "damageAir"
          : f.hitCrouched
            ? "damageCrouch"
            : f.reactionStrength === 1
              ? "damageLight"
              : f.reactionStrength === 2
                ? "damageMedium"
                : "damageHeavy";
    return {
      clip,
      tick:
        (f.data.reactionClips?.[clip] ?? clip) === f.reactionPhase
          ? f.reactionFrame
          : 0,
    };
  }
  if (
    f.guardIntent &&
    !f.airborne &&
    (["idle", "crouch", "landing"].includes(f.state) ||
      (f.state === "walk" &&
        (f.data.id === "luffy" ||
          (f.data.id === "dio" && Math.abs(f.vx) < 0.01))))
  )
    return { clip: f.crouching ? "guardCrouch" : "guardStand", tick: time };
}

export function reactionFor(f: Fighter) {
  const reaction = logicalReactionFor(f);
  return reaction
    ? {
        ...reaction,
        clip: f.data.reactionClips?.[reaction.clip] ?? reaction.clip,
      }
    : undefined;
}

export function reactionBoxes(f: Fighter) {
  const state = reactionFor(f);
  if (!state) return;
  const sequence = f.data.reactions?.[state.clip];
  if (!sequence) return;
  const total = sequence.poses.reduce((sum, p) => sum + p.ticks, 0);
  let time = sequence.loop
    ? state.tick % total
    : Math.min(state.tick, total - 1);
  for (const pose of sequence.poses) {
    if (time < pose.ticks) return pose.hurtboxes;
    time -= pose.ticks;
  }
}
