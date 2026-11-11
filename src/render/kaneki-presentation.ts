import centipedeArt from "../data/kaneki-centipede-art.json";
import idleArt from "../data/kaneki-art.json";
import movement from "../data/kaneki-movement-art.json";
import { FLOOR, type Fighter } from "../engine/combat";
import { directedKagune, kaguneIds, Rinkaku, type KaguneId, type KaguneMotionState } from "../engine/kagune";
import { kaneki, kanekiArt, kanekiChainArt, kanekiCombatClip, kanekiHolds, kanekiNormalIds, kanekiOffensiveKagunes } from "../engine/kaneki-combat";
import { kanekiSpecialArt } from "../engine/kaneki-specials";
import { centipedeRig, type KakujaBack } from "./kaneki-centipede-rig";
import { reactionFor } from "../engine/lifecycle";
import { Animator, type AnimationData } from "./animator";

const combatClips: AnimationData["clips"] = { ...kanekiArt.clips };
for (const id of kanekiNormalIds) {
  const { startup, active, recovery } = kaneki.moves[id];
  combatClips[id] = { ...combatClips[id], durations: kanekiHolds(startup, active, recovery) };
}
export const kanekiAnimations: AnimationData = {
  ...idleArt,
  clips: { ...idleArt.clips, ...movement.clips, ...combatClips, ...kanekiSpecialArt.clips, ...kanekiChainArt.clips, ...centipedeArt.clips },
};
type Clip = "idle" | keyof typeof movement.clips;
export const kanekiClipTicks = (clip: string) =>
  kanekiAnimations.clips[clip].durations!.reduce(
    (sum, ticks) => sum + ticks,
    0,
  );
const motionByClip: Record<Clip, KaguneMotionState> = {
  idle: "idle",
  walkForward: "following",
  walkBack: "following",
  dashForward: "dash",
  backdash: "dash",
  crouchStart: "crouch",
  crouchIdle: "crouch",
  crouchEnd: "crouch",
  jumpStart: "takeoff",
  jumpRise: "rise",
  jumpApex: "apex",
  jumpFall: "fall",
  landing: "landing",
};

export class KanekiPresentation {
  readonly rinkaku = new Rinkaku();
  private previousX: number;
  private previousFacing: number;
  private walkClock = 0;
  private crouchDepth = 0;
  private risingFromCrouch = 0;
  offset = 0;
  private folding = false;
  private directed = new Map<KaguneId, { x: number; y: number; age: number }>();

  constructor(fighter: Fighter, readonly animator = new Animator(kanekiAnimations)) {
    this.previousX = fighter.x;
    this.previousFacing = fighter.facing;
  }

  get clip() {
    return this.animator.clipName as Clip;
  }
  get lumbar() {
    const frame = this.animator.frame();
    const sheet = this.animator.sprite().sheet;
    const chain = kanekiChainArt.lumbar[sheet as keyof typeof kanekiChainArt.lumbar];
    const centipede = centipedeArt.lumbar[sheet as keyof typeof centipedeArt.lumbar];
    return (centipede ?? chain ?? (sheet === idleArt.sheet ? idleArt.lumbar :
      sheet === "kaneki/combat.png" ? kanekiArt.lumbar :
      sheet === "kaneki/specials.png" ? kanekiSpecialArt.lumbar : movement.lumbar))[frame];
  }
  get planted() {
    return this.clip === "walkForward" || this.clip === "walkBack"
      ? movement.planted[this.animator.frame()]
      : null;
  }

  rootX(fighter: Fighter) {
    return Math.round(fighter.x + this.offset * fighter.facing);
  }

  worldKagunes(fighter: Fighter) {
    const side = fighter.facing as 1 | -1;
    const root = { x: this.rootX(fighter) + this.lumbar.x * side, y: Math.round(fighter.y) + this.lumbar.y };
    const attacks = kanekiOffensiveKagunes(fighter, FLOOR, this.lumbar);
    const passive = this.rinkaku.poses(root, side, FLOOR);
    const cinematic = fighter.match?.centipede;
    if (cinematic?.attacker === fighter.id) {
      const sheet = this.animator.sprite().sheet;
      const cel = centipedeArt.back[sheet as keyof typeof centipedeArt.back]?.[this.animator.frame()];
      if (cel) {
        const bodyX = this.rootX(fighter), bodyY = Math.round(fighter.y);
        const toWorld = ([x,y]: number[]) => ({x:bodyX + x*side, y:bodyY + y});
        const back: KakujaBack = [toWorld(cel[0]), toWorld(cel[1]), toWorld(cel[2])];
        return centipedeRig(cinematic, back, passive, FLOOR);
      }
    }
    return passive.map(pose => {
      const attack = attacks.find(limb => limb.id === pose.id);
      if (attack) return attack;
      const last = this.directed.get(pose.id);
      if (!last) return pose;
      const t = (last.age + 1) / 7;
      return directedKagune(pose.id, root, side, {
        x: last.x * (1 - t) + (pose.tip.x - root.x) * side * t,
        y: last.y * (1 - t) + (pose.tip.y - root.y) * t,
      }, -24, FLOOR);
    });
  }

  step(fighter: Fighter) {
    const previous = this.clip;
    const dx = Math.abs(fighter.x - this.previousX);
    const turned = this.previousFacing !== fighter.facing;
    this.previousX = fighter.x;
    this.previousFacing = fighter.facing;
    let clip = "idle",
      tick: number | undefined;
    this.offset = 0;

    const action = kanekiCombatClip(fighter) ?? (() => {
      const reaction = reactionFor(fighter);
      if (reaction && this.animator.hasClip(reaction.clip)) return { name: reaction.clip, tick: reaction.tick };
    })();
    if (action) {
      clip = action.name;
      tick = action.tick;
    } else if (fighter.state === "dash") {
      clip =
        fighter.dashDirection === fighter.facing ? "dashForward" : "backdash";
      tick = fighter.stateFrame;
    } else if (fighter.state === "jumpStart" || fighter.state === "landing") {
      clip = fighter.state;
      tick = fighter.stateFrame;
    } else if (fighter.airborne) {
      if (fighter.vy < -2.4) {
        clip = "jumpRise";
        tick = fighter.vy < -9 ? 0 : 9;
      } else if (fighter.vy > 2.4) {
        clip = "jumpFall";
        tick = fighter.vy < 8.3 ? 0 : 8;
      } else clip = "jumpApex";
    } else if (fighter.state === "crouch") {
      this.risingFromCrouch = 0;
      if (this.crouchDepth < kanekiClipTicks("crouchStart")) {
        clip = "crouchStart";
        tick = this.crouchDepth++;
      } else clip = "crouchIdle";
    } else if (fighter.state === "idle" && this.crouchDepth > 0) {
      clip = "crouchEnd";
      if (this.risingFromCrouch === 0 && this.crouchDepth < 4)
        this.risingFromCrouch = kanekiAnimations.clips.crouchEnd.durations![0];
      tick = this.risingFromCrouch++;
      if (this.risingFromCrouch >= kanekiClipTicks(clip)) this.crouchDepth = 0;
    } else if (fighter.state === "walk") {
      const forward = fighter.vx * fighter.facing > 0;
      clip = forward ? "walkForward" : "walkBack";
      const speed = forward
        ? fighter.data.speed
        : fighter.data.locomotion!.backSpeed;
      this.walkClock =
        previous === clip && !turned
          ? (this.walkClock + Math.min(1, dx / speed) + 1e-8) %
            kanekiClipTicks(clip)
          : 0;
      tick = this.walkClock;
      let holdStart = 0;
      for (const duration of kanekiAnimations.clips[clip].durations!) {
        if (holdStart + duration > tick) break;
        holdStart += duration;
      }
      this.offset =
        (this.walkClock - holdStart) * speed * (forward ? -1 : 1) || 0;
    }

    if (!clip.startsWith("crouch")) {
      this.crouchDepth = 0;
      this.risingFromCrouch = 0;
    }
    this.animator.update(clip);
    if (tick !== undefined) this.animator.seekTick(tick);
    this.rinkaku.step({
      state: motionByClip[clip as Clip] ?? (fighter.move?.special === "rinkakuRush" ? "dash" : fighter.airborne ? "fall" : "idle"),
      relativeVx: fighter.vx * fighter.facing,
      vy: fighter.vy,
      tick: fighter.stateFrame,
    });
    const folded = fighter.knockedDown || fighter.state === "ko" || fighter.state === "defeat";
    if (folded !== this.folding) {
      for (const id of kaguneIds) this.rinkaku.move(id, folded ? 0.12 : 1, 9);
      this.folding = folded;
    }
    for (const [id, last] of this.directed)
      if (++last.age >= 7) this.directed.delete(id);
    for (const pose of kanekiOffensiveKagunes(fighter, FLOOR, this.lumbar)) {
      this.directed.set(pose.id, {
        x: (pose.tip.x - fighter.x) * fighter.facing - this.lumbar.x,
        y: pose.tip.y - fighter.y - this.lumbar.y,
        age: 0,
      });
    }
  }
}
