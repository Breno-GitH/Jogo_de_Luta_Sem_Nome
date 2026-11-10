import benArt from "../data/ben-art.json";
import forms from "../data/ben-alien-art.json";
import attacks from "../data/ben-attack-art.json";
import stage5 from "../data/ben-stage5-art.json";
import feedbackMotion from "../data/feedback-motion-art.json";
import nrgArmor from "../data/nrg-armor-art.json";
import anatomy from "../data/ben-body-art.json";
import stage6 from "../data/ben-stage6-combat.json";
import reform from "../data/ben-reform-art.json";
import { benFormBalance } from "../engine/ben-moves";
import type { BenAlien } from "../engine/ben-omnitrix";
import type { Fighter } from "../engine/combat";
import type { AnimationData, Animator } from "./animator";

type Point = { x: number; y: number };
type AlienArt = AnimationData & { anchors: Record<string, Point[]> };
const alienArt: Partial<Record<BenAlien, AlienArt>> = Object.fromEntries(
  (Object.keys(forms) as (keyof typeof forms)[]).map(id => {
    const locomotion = forms[id], combat = attacks[id];
    const throwClips = id === "xlr8" ? {
      grabHold: { ...locomotion.clips.grabHold, durations: [4, 6, 7] },
      throw: { ...locomotion.clips.throw, durations: [10, 21] },
    } : {};
    return [id, { ...locomotion, clips: { ...locomotion.clips, ...throwClips, ...combat.clips },
      anchors: { ...locomotion.anchors, ...combat.anchors } }];
  }),
);

function withReform(data: AnimationData, clips: AnimationData["clips"]): AnimationData {
  return { ...data, clips: { ...data.clips, ...clips } };
}

const released = anatomy.nrgReleased;
const newerForms: Partial<Record<BenAlien, AnimationData>> = {
  ...stage5.forms,
  bigChill: stage6.bigChill,
  ghostfreak: withReform(stage6.ghostfreak, reform.clips.ghostfreak),
  nrg: withReform(anatomy.nrg, Object.fromEntries(
    Object.entries(nrgArmor.clips).map(([name, clip]) => [name, {
      ...clip, sheet: nrgArmor.sheet, columns: nrgArmor.columns,
      frameWidth: nrgArmor.frameWidth, frameHeight: nrgArmor.frameHeight, pivot: nrgArmor.pivot,
    }]),
  )),
  humungousaur: withReform(stage5.forms.humungousaur, reform.clips.humungousaur),
  feedback: withReform(anatomy.feedback, Object.fromEntries(
    Object.entries(feedbackMotion.clips).map(([name, clip]) => [name, {
      ...clip, sheet: feedbackMotion.sheet, columns: feedbackMotion.columns,
      frameWidth: feedbackMotion.frameWidth, frameHeight: feedbackMotion.frameHeight, pivot: feedbackMotion.pivot,
    }]),
  )),
};

export function feedbackHeadAnchor(sheet: string, frame: number): Point | undefined {
  const heads: Partial<Record<number, Point>> | undefined = sheet === feedbackMotion.sheet ? feedbackMotion.heads :
    sheet === anatomy.feedback.sheet ? anatomy.feedback.heads : undefined;
  return heads?.[frame];
}

export function feedbackStormTips(sheet: string, frame: number): Point[] {
  const tips: Partial<Record<number, Point[]>> = anatomy.feedback.tips;
  return sheet === anatomy.feedback.sheet ? tips[frame] ?? [] : [];
}

export function feedbackWalkOffset(f: Fighter) {
  if (f.omnitrix?.active !== "feedback" || f.state !== "walk" || !f.vx ||
      f.x <= f.stageInset || f.x >= 1280 - f.stageInset) return 0;
  const clip = f.input.direction === f.facing ? feedbackMotion.clips.walkForward : feedbackMotion.clips.walkBack;
  let time = f.stateFrame % clip.durations.reduce((sum, hold) => sum + hold, 0);
  for (const hold of clip.durations) {
    if (time < hold) return -f.vx * time;
    time -= hold;
  }
  return 0;
}
const grownForms: Partial<Record<number, AnimationData>> = Object.fromEntries(
  Object.entries(stage5.grown).map(([rank, data]) => {
    const scale = benFormBalance.growth[Number(rank) === 1 ? 1 : 2].scale;
    return [rank, withReform(data, Object.fromEntries(
      Object.entries(reform.clips.humungousaur).map(([id, clip]) => [id, { ...clip, scale }]),
    ))];
  }),
);
export const benAnimationSets = [benArt, ...Object.values(alienArt), ...Object.values(newerForms), ...Object.values(grownForms), released];
export const benAnimation = (form: "human" | BenAlien | "nrgReleased", growth = 0): AnimationData => {
  if (form === "human") return benArt;
  if (form === "nrgReleased") return released;
  return (form === "humungousaur" ? grownForms[growth] : undefined) ?? newerForms[form] ?? alienArt[form] ?? benArt;
};

export function benFlameAnchor(sheet: string, frame: number) {
  return alienArt.heatblast?.anchors[sheet]?.[frame];
}

export function tickBenAnimation(f: Fighter, animator: Animator) {
  let clip = "idle";
  let tick = f.stateFrame;
  if (f.state === "attack" && f.move?.ben?.absorb && f.omnitrix?.absorbFlash && animator.hasClip("absorbConfirm")) {
    clip = "absorbConfirm";
    tick = 18 - f.omnitrix.absorbFlash;
  } else if (f.state === "attack" && animator.hasClip(f.moveId)) {
    clip = f.moveId;
    if (f.move?.ben?.leap && f.airborne && !f.omnitrix?.landingStrike) {
      const heavy = f.moveId.endsWith("_medium");
      tick = f.vy < -2 ? (heavy ? 15 : 8) : f.vy < 2 ? (heavy ? 26 : 14) : (heavy ? 45 : 23);
    }
    if (f.airborne && !f.input.up && f.move?.ben?.field?.aim === "heat" && animator.hasClip(clip + "Air")) clip += "Air";
  }
  else if (f.benForm) {
    if ((f.knockedDown || f.state === "ko" || f.state === "defeat") && !f.airborne && animator.hasClip("downed")) clip = "downed";
    else if (f.state === "hitstun" && animator.hasClip("damage")) clip = "damage";
    else if (f.state === "blockstun" && animator.hasClip("guardStand")) clip = f.blockCrouched ? "guardCrouch" : "guardStand";
    else if (f.state === "grabbing") clip = animator.hasClip(f.actionClip) ? f.actionClip : "grabHold";
    else if (f.state === "throwRecover") clip = animator.hasClip(f.actionClip) ? f.actionClip : "throwRecover";
    else if (f.state === "air" && f.airChaseTicks && f.stateFrame < 4 &&
        f.actionClip === "conductor_mediumRecover") clip = f.actionClip;
    else if (f.state === "dash") clip = f.dashDirection === f.facing ? "dashForward" : "backdash";
    else if (f.state === "jumpStart" || f.state === "landing")
      clip = f.state === "landing" && f.actionClip === "nrgDropLanding" && animator.hasClip(f.actionClip)
        ? f.actionClip : f.state;
    else if (f.state === "air" && f.omnitrix?.flightTicks && f.omnitrix.nrgReleased) {
      const lateral = !f.input.direction ? "" : f.input.direction === f.facing ? "Forward" : "Back";
      const vertical = f.input.up ? "Up" : f.input.down ? "Down" : "";
      clip = "fly" + (lateral + vertical || "Idle");
    } else if (f.airborne) {
      clip = f.vy < -3 ? "jumpRise" : f.vy > 3 ? "jumpFall" : "jumpApex";
      tick = clip === "jumpRise" ? Number(f.vy > f.movementData.jump * .58) : Number(f.vy > 8);
    } else if (f.state === "crouch") {
      clip = f.stateFrame < 6 ? "crouchStart" : "crouchIdle";
    } else if (f.omnitrix?.crouchExit) {
      clip = "crouchEnd";
      tick = 5 - f.omnitrix.crouchExit;
    } else if (f.state === "walk") {
      clip = f.input.direction === f.facing ? "walkForward" : "walkBack";
    } else if (f.knockedDown || f.state === "getup" || f.state === "ko" || f.state === "defeat") {
      clip = "crouchIdle";
    }
  }
  animator.update(animator.hasClip(clip) ? clip : "idle");
  animator.seekTick(tick);
}

