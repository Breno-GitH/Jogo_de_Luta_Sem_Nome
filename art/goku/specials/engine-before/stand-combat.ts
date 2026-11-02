import type { AttackShape, CompanionData, Move, StandTimeline } from "./types";
import { worldRect, worldCapsule, shapeBounds } from "./geometry";
import { poseAt } from "./moves";

interface Owner {
  x: number;
  y: number;
  vx: number;
  facing: number;
  state: string;
  stateFrame: number;
  moveId: string;
  move?: Move;
  airborne: boolean;
  temporalActive?: boolean;
  temporalEnding?: boolean;
  opponent?: { x: number };
  knockedDown?: boolean;
}
export interface StandState {
  x: number;
  y: number;
  facing: number;
  depth: number;
  mode:
    | "follow"
    | "attack"
    | "link"
    | "recoil"
    | "return"
    | "cinematic"
    | "reaction";
  clip: string;
  clipTick: number;
  clock: number;
  moveId: string;
  fromX: number;
  fromY: number;
  returnFrame: number;
  returnDuration: number;
  turnLeft: number;
  timeline?: StandTimeline;
  settleLeft: number;
  previousMotion: string;
  bridgeClip?: string;
  linkFrame: number;
  recoilFrame: number;
  chainCount: number;
  ownerLiftFrame: number;
  returnClip?: string;
  reaction?: {
    phase:
      | "interrupt"
      | "retreat"
      | "return"
      | "vanish"
      | "hidden"
      | "appear"
      | "dissipate";
    tick: number;
    fromX: number;
    fromY: number;
  };
}
export class CombatStand {
  s: StandState;
  constructor(
    readonly data: CompanionData,
    owner: Owner,
  ) {
    this.s = {
      x: owner.x + data.neutral.x * owner.facing,
      y: owner.y + data.neutral.y,
      facing: owner.facing,
      depth: 0,
      mode: "follow",
      clip: "standIdle",
      clipTick: 0,
      clock: 0,
      moveId: "",
      fromX: 0,
      fromY: 0,
      returnFrame: 0,
      returnDuration: data.returnTicks,
      turnLeft: 0,
      settleLeft: 0,
      previousMotion: "idle",
      linkFrame: 0,
      recoilFrame: 0,
      chainCount: 0,
      ownerLiftFrame: -1,
    };
  }
  get ready() {
    return (
      this.s.mode === "follow" ||
      (this.s.reaction?.phase === "return" && this.s.reaction.tick >= 6)
    );
  }
  canBegin(chain = false) {
    return (
      this.ready ||
      (chain && (this.s.mode === "attack" || this.s.mode === "link"))
    );
  }
  get transform() {
    return {
      x: Math.round(this.s.x),
      y: Math.round(this.s.y),
      facing: this.s.facing,
      depth: this.s.depth,
    };
  }
  begin(
    id: string,
    timeline: StandTimeline,
    owner: Owner,
    targetX?: number,
    chain = false,
  ) {
    if (!this.canBegin(chain)) return false;
    this.s.reaction = undefined;
    let sourceFrame = 0,
      remaining = this.s.clipTick;
    const source = this.data.actions[this.s.clip];
    for (let i = 0; i < (source?.poses.length ?? 0); i++) {
      sourceFrame = i;
      if (remaining < source.poses[i].ticks) break;
      remaining -= source.poses[i].ticks;
    }
    const key = `bridge_${this.s.clip}_${sourceFrame}_${timeline.clip}`;
    this.s.bridgeClip = chain
      ? this.data.actions[key]
        ? key
        : "comboTransition"
      : undefined;
    let front = timeline.front;
    const first = this.data.actions[timeline.clip].poses.find(
      (p) => p.hitboxes?.length,
    )?.hitboxes?.[0];
    if (targetX !== undefined && first) {
      const b = shapeBounds(first),
        gap = (targetX - owner.x) * owner.facing;
      front = {
        ...front,
        x: Math.max(0, Math.min(front.x, gap - b.x - b.w / 2)),
      };
    }
    // Never pull the Stand behind its owner to start the next hit of a chain.
    const from = (this.s.x - owner.x) * owner.facing;
    if (chain) front = { ...front, x: Math.max(from, front.x) };
    this.s.chainCount = chain ? this.s.chainCount + 1 : 1;
    this.s.mode = "attack";
    this.s.returnClip = timeline.returnClip;
    this.s.moveId = id;
    this.s.timeline = { ...timeline, front };
    this.s.fromX = (this.s.x - owner.x) * owner.facing;
    this.s.fromY = this.s.y - owner.y;
    this.s.facing = owner.facing;
    return true;
  }
  holdCombo(owner: Owner) {
    if (this.s.mode !== "attack") return;
    this.s.mode = "link";
    this.s.ownerLiftFrame = 0;
    this.s.linkFrame = 0;
    this.s.moveId = "";
    this.s.timeline = undefined;
    this.s.fromX = (this.s.x - owner.x) * owner.facing;
    this.s.fromY = this.s.y - owner.y;
  }
  cancel(owner: Owner, damaged = false) {
    if (this.s.mode !== "attack" && this.s.mode !== "link") return;
    this.s.mode = damaged ? "recoil" : "return";
    if (damaged) this.s.ownerLiftFrame = -1;
    this.s.recoilFrame = 0;
    this.s.returnFrame = 0;
    this.s.returnDuration =
      this.s.timeline?.returnTicks ?? this.data.returnTicks;
    this.s.fromX = this.s.x - owner.x;
    this.s.fromY = this.s.y - owner.y;
    this.s.moveId = "";
    this.s.timeline = undefined;
    this.s.clip = damaged
      ? "interruptRecoil"
      : (this.s.returnClip ?? "returnBehind");
    this.s.clipTick = 0;
    this.s.bridgeClip = undefined;
  }
  /** All reaction clocks and relative transforms belong to the fixed-tick
   * entity and are included in snapshots. There is no independent Stand HP. */
  react(owner: Owner) {
    if (!this.data.actions.secondaryInterrupt) return;
    if (["ko", "defeat"].includes(owner.state)) {
      if (!["dissipate", "hidden"].includes(this.s.reaction?.phase ?? ""))
        this.startReaction("dissipate", owner);
    } else if (["hitstun", "grabbed"].includes(owner.state)) {
      this.startReaction("interrupt", owner);
    } else if (owner.state === "blockstun" && this.s.mode === "recoil") {
      this.startReaction("interrupt", owner);
    }
  }
  private startReaction(
    phase: NonNullable<StandState["reaction"]>["phase"],
    owner: Owner,
  ) {
    this.s.reaction = {
      phase,
      tick: 0,
      fromX: this.s.x - owner.x,
      fromY: this.s.y - owner.y,
    };
    this.s.mode = "reaction";
    this.s.moveId = "";
    this.s.timeline = undefined;
    this.s.bridgeClip = undefined;
    this.s.returnClip = undefined;
    this.s.ownerLiftFrame = -1;
    this.s.clip = `secondary${phase === "retreat" ? "Recoil" : phase[0].toUpperCase() + phase.slice(1)}`;
    this.s.clipTick = 0;
  }
  private tickSecondary(owner: Owner) {
    if (!this.data.actions.secondaryInterrupt) return false;
    const s = this.s;
    if (["ko", "defeat"].includes(owner.state)) this.react(owner);
    if (
      !s.reaction &&
      ((owner.knockedDown && owner.state !== "getup") ||
        owner.state === "grabbed")
    )
      this.startReaction("vanish", owner);
    const follow = () => {
      const targetX = owner.x + this.data.neutral.x * owner.facing;
      s.x += Math.max(-12, Math.min(12, (targetX - s.x) * 0.65));
      const crossing =
        s.reaction &&
        ["retreat", "return"].includes(s.reaction.phase) &&
        (s.x - owner.x) * owner.facing > -10;
      s.y += (owner.y + this.data.neutral.y - (crossing ? 12 : 0) - s.y) * 0.8;
      s.facing = owner.facing;
      s.depth = 0;
    };
    if (owner.state === "entrance") {
      s.reaction = undefined;
      s.mode = "follow";
      follow();
      s.clip = owner.stateFrame < 64 ? "secondaryHidden" : "secondaryAppear";
      s.clipTick = Math.max(0, owner.stateFrame - 64);
      return true;
    }
    if (owner.state === "victory" || owner.state === "taunt") {
      s.reaction = undefined;
      s.timeline = undefined;
      s.mode = "follow";
      follow();
      s.clip =
        owner.state === "victory" ? "secondaryVictory" : "secondaryThreat";
      s.clipTick = owner.stateFrame;
      return true;
    }
    const r = s.reaction;
    if (!r) return false;
    s.mode = "reaction";
    s.clipTick = r.tick++;
    s.clip = `secondary${r.phase === "retreat" ? "Recoil" : r.phase[0].toUpperCase() + r.phase.slice(1)}`;
    if (r.phase === "interrupt") {
      s.x = owner.x + r.fromX;
      s.y = owner.y + r.fromY;
    } else follow();
    const duration = this.data.actions[s.clip].durations.reduce(
      (a, b) => a + b,
      0,
    );
    const severe =
      owner.state === "grabbed" ||
      (owner.knockedDown && owner.state !== "getup");
    if (r.phase === "hidden") {
      if (!["ko", "defeat"].includes(owner.state) && !severe)
        this.startReaction("appear", owner);
    } else if (r.tick >= duration) {
      if (r.phase === "interrupt") this.startReaction("retreat", owner);
      else if (r.phase === "retreat")
        this.startReaction(severe ? "vanish" : "return", owner);
      else if (r.phase === "dissipate" || r.phase === "vanish")
        this.startReaction("hidden", owner);
      else {
        s.reaction = undefined;
        s.mode = "follow";
        s.settleLeft = 0;
      }
    }
    return true;
  }
  tick(owner: Owner) {
    const s = this.s;
    if (s.mode === "cinematic") {
      s.reaction = undefined;
      return;
    }
    s.clock++;
    if (this.tickSecondary(owner)) return;
    if (s.ownerLiftFrame >= 0 && ++s.ownerLiftFrame > 4) s.ownerLiftFrame = -1;
    if (s.mode === "link") {
      if (["hitstun", "blockstun", "ko", "grabbed"].includes(owner.state)) {
        this.cancel(owner, true);
      } else if (++s.linkFrame > (this.data.comboGrace ?? 12)) {
        this.cancel(owner);
      } else {
        s.x = owner.x + s.fromX * s.facing;
        const target = owner.y + s.fromY;
        s.y += (target - s.y) * 0.8;
        s.y = Math.max(target - 4, Math.min(target + 4, s.y));
        s.depth = (s.x - owner.x) * owner.facing > 8 ? 20 : 0;
        return;
      }
    }
    if (s.mode === "recoil") {
      s.clip = "interruptRecoil";
      s.clipTick = s.recoilFrame++;
      s.x = owner.x + s.fromX;
      s.y = owner.y + s.fromY;
      s.depth = (s.x - owner.x) * owner.facing > 8 ? 20 : 0;
      if (s.recoilFrame >= 6) {
        s.mode = "return";
        s.returnFrame = 0;
      }
      return;
    }
    if (s.mode === "attack") {
      if (owner.state !== "attack" || owner.moveId !== s.moveId) {
        this.cancel(owner);
      } else {
        const t = owner.stateFrame,
          move = s.timeline!;
        if (
          (owner.move?.special === "rush" || owner.move?.super) &&
          owner.opponent
        ) {
          const centers = this.data.actions[move.clip].poses.flatMap((p) =>
            (p.hitboxes ?? []).map((shape) => {
              const b = shapeBounds(shape);
              return b.x + b.w / 2;
            }),
          );
          const fistCenter =
            centers.reduce((a, b) => a + b, 0) / Math.max(1, centers.length);
          const gap = (owner.opponent.x - owner.x) * s.facing;
          move.front = {
            ...move.front,
            x: Math.max(
              s.fromX,
              Math.max(
                0,
                Math.min(owner.move.stand!.front.x, gap - fistCenter),
              ),
            ),
          };
        }
        const progress = Math.max(
          0,
          Math.min(1, (t - move.approachAt) / move.approachTicks),
        );
        // Smoothstep has zero speed at both ends and preserves each fixed tick.
        const ease = progress * progress * (3 - 2 * progress);
        const targetX =
          owner.x + (s.fromX + (move.front.x - s.fromX) * ease) * s.facing;
        s.x =
          owner.move?.special === "rush" || owner.move?.super
            ? s.x + Math.max(-16, Math.min(16, targetX - s.x))
            : targetX;
        s.y = owner.y + s.fromY + (move.front.y - s.fromY) * ease;
        s.depth = (s.x - owner.x) * owner.facing > 8 ? 20 : 0;
        s.clip =
          t < move.approachAt
            ? "standIdle"
            : t < move.punchAt
              ? "forwardAttackMovement"
              : t < move.recoverAt
                ? move.clip
                : (move.recoveryClip ?? "attackRecovery");
        s.clipTick =
          t < move.approachAt
            ? t
            : t < move.punchAt
              ? Math.floor(((t - move.approachAt) * 9) / move.approachTicks)
              : t < move.recoverAt
                ? t - move.punchAt
                : t - move.recoverAt;
        if (s.bridgeClip && t < (move.bridgeTicks ?? 4)) {
          s.clip = s.bridgeClip;
          const total = this.data.actions[s.bridgeClip].durations.reduce(
            (a, b) => a + b,
            0,
          );
          s.clipTick = Math.min(
            total - 1,
            Math.floor((t * total) / (move.bridgeTicks ?? 4)),
          );
        }
        if (t >= move.returnAt) this.cancel(owner);
        else return;
      }
    }
    if (s.mode === "return") {
      if (s.facing !== owner.facing) {
        s.fromX = s.x - owner.x;
        s.fromY = s.y - owner.y;
        s.returnFrame = 0;
        s.facing = owner.facing;
      }
      const progress = Math.min(1, ++s.returnFrame / s.returnDuration),
        ease = progress * progress * (3 - 2 * progress);
      s.x =
        owner.x +
        s.fromX +
        (this.data.neutral.x * owner.facing - s.fromX) * ease;
      s.y = owner.y + s.fromY + (this.data.neutral.y - s.fromY) * ease;
      s.facing = owner.facing;
      s.depth = (s.x - owner.x) * owner.facing > 8 ? 20 : 0;
      s.clip = s.returnClip ?? "returnBehind";
      const returnTicks = s.returnClip
        ? this.data.actions[s.returnClip].durations.reduce((a, b) => a + b, 0)
        : 16;
      s.clipTick = Math.min(
        returnTicks - 1,
        Math.floor(((s.returnFrame - 1) * returnTicks) / s.returnDuration),
      );
      if (progress === 1) {
        s.mode = "follow";
        s.moveId = "";
        s.timeline = undefined;
        s.returnClip = undefined;
      }
      return;
    }
    if (s.facing !== owner.facing) {
      s.turnLeft = 10;
      s.settleLeft = 18;
    }
    if (
      s.previousMotion !== owner.state &&
      ["idle", "crouch", "landing"].includes(owner.state)
    )
      s.settleLeft = 18;
    s.previousMotion = owner.state;
    s.facing = owner.facing;
    s.depth = 0;
    const bob = [0, 1, 2, 3, 3, 2, 1, 0, -1, -2, -3, -3, -2, -1][
      Math.floor(s.clock / 5) % 14
    ];
    const arc = s.turnLeft
      ? -8 * Math.sin((Math.PI * (10 - s.turnLeft)) / 10)
      : 0;
    const targetX = owner.x + this.data.neutral.x * owner.facing,
      targetY = owner.y + this.data.neutral.y + bob + arc;
    const step = (targetX - s.x) * 0.65;
    s.x += s.turnLeft ? Math.max(-12, Math.min(12, step)) : step;
    s.y += (targetY - s.y) * 0.8;
    if (!s.turnLeft) s.x = Math.max(targetX - 9, Math.min(targetX + 9, s.x));
    else s.turnLeft--;
    s.y = Math.max(targetY - 4, Math.min(targetY + 4, s.y));
    const ability =
      owner.move?.special === "timeStop" && owner.state === "attack";
    const clip = ability
      ? owner.stateFrame < (owner.move?.startup ?? 24) - 6
        ? "timePrepare"
        : "timeActivate"
      : owner.temporalEnding && owner.state !== "attack"
        ? "timeFinish"
        : owner.temporalActive
          ? "timeMaintain"
          : s.turnLeft > 0
            ? "returnPosition"
            : owner.airborne
              ? "jumpFollow"
              : owner.state === "dash"
                ? "dashFollow"
                : owner.state === "walk"
                  ? owner.vx * owner.facing >= 0
                    ? "followForward"
                    : "followBackward"
                  : s.settleLeft > 0
                    ? "returnPosition"
                    : s.clock % 120 < 60
                      ? "standIdle"
                      : "floating";
    if (clip !== s.clip) {
      s.clip = clip;
      s.clipTick = 0;
    } else s.clipTick++;
    if (ability)
      s.clipTick =
        owner.stateFrame < (owner.move?.startup ?? 24) - 6
          ? owner.stateFrame
          : owner.stateFrame - ((owner.move?.startup ?? 24) - 6);
    if (s.settleLeft > 0) s.settleLeft--;
  }
  hitboxes(owner: Owner): AttackShape[] {
    if (
      this.s.mode !== "attack" ||
      owner.state !== "attack" ||
      owner.moveId !== this.s.moveId ||
      !this.s.timeline
    )
      return [];
    const definition = this.data.actions[this.s.timeline.clip];
    if (
      owner.move?.hitWindows &&
      !owner.move.hitWindows.some(
        (w) => owner.stateFrame >= w.fromTick && owner.stateFrame < w.toTick,
      )
    )
      return [];
    if (this.s.clip !== this.s.timeline.clip) return [];
    if (owner.stateFrame < this.s.timeline.punchAt) return [];
    const pose = poseAt(
      { poses: definition.poses } as Move,
      owner.stateFrame - this.s.timeline.punchAt,
    );
    const t = this.transform;
    return (pose?.hitboxes ?? []).map((shape) =>
      "a" in shape
        ? worldCapsule(shape, t.x, t.y, t.facing)
        : worldRect(shape, t.x, t.y, t.facing),
    );
  }
}
