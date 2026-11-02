import samurai from "../data/samurai.json";
import { CombatStand } from "./stand-combat";
import { TemporalController, type DeferredReaction } from "./temporal";
import { projectileHits, type KnifeProjectile } from "./projectiles";
import dioBalance from "../data/dio-specials.json";
import { roadConfig, roadScene, type RoadRollerState } from "./road-roller";
import { CommandBuffer } from "./input";
import { MOVEMENT_TIMING } from "./movement";
import cinematics from "../data/cinematics.json";
import { reactionBoxes, reactionFor } from "./lifecycle";
import { poseAt, phaseAt } from "./moves";
import {
  shapeBounds,
  shapeHitsRect,
  unionBounds,
  worldCapsule,
  worldRect,
} from "./geometry";
import {
  neutral,
  overlaps,
  type CharacterData,
  type InputFrame,
  type Move,
  type Rect,
  type State,
  type AttackShape,
} from "./types";
export const character: CharacterData = samurai;
export const FLOOR = 580;
export class Fighter {
  x = 0;
  y = FLOOR;
  vx = 0;
  vy = 0;
  facing = 1;
  health: number;
  meter = 0;
  state: State = "idle";
  stateFrame = 0;
  stun = 0;
  moveId = "";
  connected = false;
  hitIds: number[] = [];
  comboAge = 0;
  comboAirHits = 0;
  combo = 0;
  knockedDown = false;
  dashDirection = 1;
  jumpDirection = 0;
  airChaseTicks = 0;
  homeX: number;
  guardIntent = false;
  blockCrouched = false;
  hitCrouched = false;
  reactionStrength = 1;
  hitLaunch = false;
  reactionPhase = "";
  reactionFrame = 0;
  actionClip = "";
  input = neutral();
  buffer = new CommandBuffer();
  stand?: CombatStand;
  declare opponent?: Fighter;
  declare match?: Match;
  constructor(
    public data: CharacterData,
    public id: number,
    x: number,
  ) {
    this.x = x;
    this.homeX = x;
    this.health = data.health;
    this.facing = id === 0 ? 1 : -1;
    // A runtime link, not serializable combat state. Keeping it non-enumerable
    // avoids a cycle when inspecting/replaying a complete Match as JSON.
    Object.defineProperty(this, "opponent", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(this, "match", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    if (data.companion) this.stand = new CombatStand(data.companion, this);
  }
  get airborne() {
    return this.y < FLOOR || this.vy < 0;
  }
  get move(): Move | undefined {
    return (
      this.data.moves[this.moveId] ??
      this.data.specialMoves?.[this.moveId] ??
      this.data.superMoves?.[this.moveId]
    );
  }
  get temporalActive() {
    return (
      this.match?.temporal.active && this.match.temporal.s.owner === this.id
    );
  }
  get temporalEnding() {
    return (
      (this.match?.temporal.s.endFlash ?? 0) > 0 &&
      this.match?.temporal.s.lastOwner === this.id
    );
  }
  canSpecialCancel() {
    return (
      this.state === "attack" &&
      !this.airborne &&
      this.connected &&
      !this.move?.special &&
      !this.move?.super &&
      this.stateFrame > (this.move?.startup ?? 0) &&
      this.stateFrame < (this.move?.startup ?? 0) + (this.move?.active ?? 0)
    );
  }
  canStartSpecial(id: string) {
    const move = this.data.specialMoves?.[id];
    if (
      !move ||
      this.airborne ||
      !(
        ["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
          this.state,
        ) || this.canSpecialCancel()
      )
    )
      return false;
    if (
      move.special === "timeStop" &&
      !this.match?.temporal.canActivate(this.id)
    )
      return false;
    if (
      move.projectile &&
      this.match &&
      this.match.projectiles.filter((p) => p.owner === this.id).length +
        move.projectile.releases.length >
        dioBalance.knives.maximumPerOwner
    )
      return false;
    if (move.stand && !this.stand?.canBegin(this.canSpecialCancel()))
      return false;
    return true;
  }
  get crouching() {
    return (
      !this.airborne &&
      (this.state === "crouch" ||
        this.moveId.startsWith("crouch_") ||
        (this.state === "blockstun" && this.blockCrouched) ||
        (this.state === "hitstun" && this.hitCrouched))
    );
  }
  get meterMaximum() {
    return this.data.meterMaximum ?? 100;
  }
  canSuperCancel() {
    if (
      this.state !== "attack" ||
      this.airborne ||
      !this.connected ||
      this.move?.super
    )
      return false;
    if (this.move?.special === "rush") {
      const last = this.move.hitWindows?.at(-1);
      return (
        !!last &&
        this.hitIds.includes(last.id) &&
        this.stateFrame >= last.fromTick &&
        this.stateFrame < last.toTick
      );
    }
    return this.canSpecialCancel();
  }
  canStartSuper() {
    return (
      !!this.data.superMoves?.road_roller &&
      this.meter >= roadConfig.cost &&
      !this.airborne &&
      !this.match?.roadRoller &&
      !this.match?.capture &&
      (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
        this.state,
      ) ||
        this.canSuperCancel()) &&
      !!this.stand?.canBegin(this.canSuperCancel())
    );
  }
  hurtbox(): Rect {
    return unionBounds(this.hurtboxes());
  }
  hurtboxes(): Rect[] {
    const lift = this.stand?.s.ownerLiftFrame ?? -1;
    const pose =
      this.state === "attack" && this.move
        ? poseAt(this.move, this.stateFrame)
        : undefined;
    const neutral = this.data.hurtboxes;
    const jumpPose =
      lift > 0 &&
      this.airborne &&
      ["air", "attack"].includes(this.state) &&
      this.data.commandTransitions
        ? poseAt(this.data.commandTransitions.jump as Move, lift - 1)
        : undefined;
    let boxes = jumpPose?.hurtboxes ??
      pose?.hurtboxes ??
      reactionBoxes(this) ??
      (this.crouching
        ? neutral?.crouching
        : this.airborne
          ? neutral?.air
          : neutral?.standing) ?? [
        {
          x: -28,
          y: this.crouching ? -80 : -145,
          w: 56,
          h: this.crouching ? 80 : 145,
        },
      ];
    if (this.invulnerability?.upperOnly) boxes = boxes.slice(2, 4);
    return boxes.map((box) => worldRect(box, this.x, this.y, this.facing));
  }
  get invulnerability() {
    const window =
      this.state === "attack" ? this.move?.invulnerable : undefined;
    return window &&
      this.stateFrame >= window.from &&
      this.stateFrame < window.to
      ? window
      : undefined;
  }
  get invulnerable() {
    return (
      this.state === "getup" ||
      (!!this.invulnerability && !this.invulnerability.upperOnly)
    );
  }
  get counterWindow() {
    return (
      this.state === "counter" &&
      this.stateFrame >= cinematics.counter.entry &&
      this.stateFrame < cinematics.counter.windowEnd
    );
  }
  get attackPhase() {
    return this.state === "attack" && this.move
      ? phaseAt(this.move, this.stateFrame)
      : undefined;
  }
  get hitWindow() {
    return this.move?.hitWindows?.find(
      (w) => this.stateFrame >= w.fromTick && this.stateFrame < w.toTick,
    );
  }
  get canConnect() {
    return this.move?.hitWindows
      ? !!this.hitWindow && !this.hitIds.includes(this.hitWindow.id)
      : !this.connected;
  }
  canCancel(name: string) {
    const window = this.move?.cancelWindow;
    return (
      this.state === "attack" &&
      this.connected &&
      !!this.move?.cancels.includes(name) &&
      (!window ||
        (this.stateFrame >= window.fromTick &&
          this.stateFrame <= window.toTick))
    );
  }
  canCancelMove(id: string) {
    return (
      this.canCancel(id.split("_").at(-1)!) &&
      (!this.move?.cancelMoves || this.move.cancelMoves.includes(id))
    );
  }
  pushbox(): Rect {
    return { x: this.x - 26, y: this.y - 90, w: 52, h: 90 };
  }
  hitbox(): Rect | undefined {
    const shapes = this.attackShapes();
    return shapes.length ? unionBounds(shapes.map(shapeBounds)) : undefined;
  }
  attackShapes(): AttackShape[] {
    const m = this.move;
    if (
      this.state !== "attack" ||
      !m ||
      this.stateFrame < m.startup ||
      this.stateFrame >= m.startup + m.active
    )
      return [];
    const pose = poseAt(m, this.stateFrame);
    if (m.hitWindows && !this.hitWindow) return [];
    if (m.stand) return this.stand?.hitboxes(this) ?? [];
    if (m.kind === "grab")
      return [worldRect(m.box, this.x, this.y, this.facing)];
    const body = pose?.hitboxes
      ? pose.hitboxes.map((shape) =>
          "a" in shape
            ? worldCapsule(shape, this.x, this.y, this.facing)
            : worldRect(shape, this.x, this.y, this.facing),
        )
      : pose?.blade
        ? [worldCapsule(pose.blade, this.x, this.y, this.facing)]
        : pose
          ? []
          : [worldRect(m.box, this.x, this.y, this.facing)];
    return [...body, ...(this.stand?.hitboxes(this) ?? [])];
  }
  setState(s: State, preserveStand = false) {
    if (
      !preserveStand &&
      (this.state === "attack" || this.stand?.s.mode === "link")
    )
      this.stand?.cancel(
        this,
        ["hitstun", "blockstun", "ko", "grabbed"].includes(s),
      );
    this.state = s;
    this.stand?.react(this);
    this.stateFrame = 0;
    this.reactionPhase = "";
    this.reactionFrame = 0;
    if (s !== "attack") {
      this.moveId = "";
      this.connected = false;
      this.hitIds = [];
    }
  }
  attack(id: string) {
    const m =
      this.data.moves[id] ??
      this.data.specialMoves?.[id] ??
      this.data.superMoves?.[id];
    if (!m || this.meter < (m.cost ?? 0)) return false;
    if (m.super && !this.canStartSuper()) return false;
    if (m.special && !this.canStartSpecial(id)) return false;
    const chain =
      !!m.stand &&
      (this.canCancelMove(id) ||
        (m.super && this.canSuperCancel()) ||
        (m.special && this.canSpecialCancel()) ||
        this.stand?.s.mode === "link");
    if (
      m.stand &&
      (!this.stand?.canBegin(chain) ||
        ["hitstun", "blockstun", "ko", "grabbed", "getup"].includes(this.state))
    )
      return false;
    if (m.stand && this.state === "attack" && !chain) return false;
    this.meter -= m.cost ?? 0;
    this.setState("attack", chain);
    this.moveId = id;
    this.connected = false;
    this.hitIds = [];
    if (!this.airChaseTicks) this.vx = 0;
    if (m.stand) this.stand?.begin(id, m.stand, this, this.opponent?.x, chain);
    return true;
  }
  tick(input: InputFrame, frame: number, opponent: Fighter) {
    this.input = input;
    this.buffer.push(input, frame, this.facing);
    this.stateFrame++;
    if (this.combo > 0) this.comboAge++;
    this.syncReactionClock(true);
    if (
      [
        "ko",
        "victory",
        "defeat",
        "entrance",
        "grabbing",
        "grabbed",
        "cinematic",
      ].includes(this.state)
    )
      return;
    const locks: Partial<Record<State, number>> = {
      taunt: this.data.lifecycle?.tauntTicks ?? 48,
      counterRecover: 24,
      getup: this.data.lifecycle?.getupTicks ?? 18,
      ultimateRecover: 18,
      throwRecover: 12,
    };
    const lock = locks[this.state];
    if (lock !== undefined) {
      this.vx = 0;
      if (this.stateFrame >= lock) {
        this.knockedDown = false;
        this.setState("idle");
      } else return;
    }
    if (this.state === "counter") {
      this.vx = 0;
      if (this.stateFrame >= 24) this.setState("counterRecover");
      return;
    }
    if (this.state === "hitstun" || this.state === "blockstun") {
      if (--this.stun <= 0) {
        if (this.knockedDown && this.airborne) this.stun = 1;
        else {
          this.setState(
            this.knockedDown && !this.airborne
              ? "getup"
              : this.airborne
                ? "air"
                : "idle",
          );
          this.combo = 0;
          this.comboAge = this.comboAirHits = 0;
          this.knockedDown = false;
        }
      }
    } else {
      if (
        this.state === "attack" &&
        this.move &&
        this.stateFrame >=
          this.move.startup + this.move.active + this.move.recovery
      )
        this.setState(this.airborne ? "air" : "idle");
      if (
        this.state === "jumpStart" &&
        this.stateFrame >=
          (this.data.locomotion?.jumpStartup ?? MOVEMENT_TIMING.jumpStartup)
      ) {
        this.vy = this.data.jump;
        this.vx =
          this.jumpDirection *
          (this.data.locomotion?.airSpeed ?? this.data.speed);
        this.setState("air");
      }
      if (
        this.state === "landing" &&
        this.stateFrame >=
          (this.data.locomotion?.landingTicks ?? MOVEMENT_TIMING.landing)
      )
        this.setState("idle");
      if (
        this.state === "dash" &&
        this.stateFrame >=
          (this.data.locomotion?.dashForward.length ?? MOVEMENT_TIMING.dash)
      ) {
        this.setState("idle");
        this.vx = 0;
      }
      // Locomotion is interruptible; attacks still require their cancel rules.
      const free = this.state !== "attack";
      if (free && this.state !== "dash" && !this.airborne)
        this.facing = opponent.x >= this.x ? 1 : -1;
      const canCancel = (name: string) => this.canCancel(name);
      const superRequested =
        !!this.data.superMoves &&
        !this.airborne &&
        this.buffer.actions.some((action) => action.button === "ultimate");
      if (
        superRequested &&
        (this.meter < roadConfig.cost || this.canStartSuper())
      ) {
        if (this.canStartSuper()) this.attack("road_roller");
        this.buffer.consume("ultimate");
        return;
      }
      if (this.data.specialMoves && !this.airborne && !superRequested) {
        // Supplied L has time-stop priority; recognised unavailable commands
        // are consumed rather than silently becoming a heavy normal.
        for (const button of ["heavy", "medium", "light"] as const) {
          const special = this.buffer.dioSpecial(
            button,
            dioBalance.commands.motionTicks,
            dioBalance.commands.finishTicks,
          );
          if (!special) continue;
          const id =
            special === "timeStop" ? "time_stop" : `${special}_${button}`;
          if (
            (special === "timeStop" &&
              !this.match?.temporal.canActivate(this.id)) ||
            this.canStartSpecial(id)
          ) {
            if (this.canStartSpecial(id)) this.attack(id);
            this.buffer.consumeSpecial(button);
            return;
          }
        }
      }
      if (
        !this.airborne &&
        (free || canCancel("special")) &&
        this.buffer.consume("ultimate") &&
        this.meter >= 100 &&
        this.data.moves.ultimate_start
      ) {
        this.attack("ultimate_start");
        this.buffer.consumeMotion();
        return;
      }
      if (
        free &&
        !this.airborne &&
        this.state !== "attack" &&
        this.buffer.consume("taunt") &&
        (this.data.id === "samurai" || !!this.data.lifecycle)
      ) {
        this.vx = 0;
        this.setState("taunt");
        return;
      }
      if (
        (free || canCancel("jump")) &&
        this.state !== "jumpStart" &&
        !this.airborne &&
        this.buffer.consume("jump")
      ) {
        if (canCancel("jump")) {
          // Preserve the immediate launcher chase used by aerial combos.
          this.vy = this.data.jump;
          this.airChaseTicks = this.data.airChaseTicks ?? 8;
          if (this.stand) {
            this.stand.holdCombo(this);
            this.setState("air", true);
          } else this.setState("air");
        } else {
          this.jumpDirection = input.direction;
          this.vx = 0;
          this.setState("jumpStart");
        }
      }
      if (free || this.state === "attack") {
        for (const b of ["throw", "light", "medium", "heavy"] as const) {
          if (b === "heavy" && superRequested) continue;
          if (
            this.data.specialMoves &&
            !this.airborne &&
            this.buffer.dioSpecial(b)
          )
            continue;
          const special =
            this.data.id === "samurai" && b !== "throw" && !this.airborne
              ? this.buffer.special()
              : undefined;
          if (!(free || canCancel(special ? "special" : b))) continue;
          if (b === "throw" && this.airborne) continue;
          const candidate = special
            ? `${special}_${b}`
            : b === "throw"
              ? "throw"
              : `${this.airborne ? "air" : input.down ? "crouch" : "stand"}_${b}`;
          const candidateMove = this.data.moves[candidate];
          if (
            this.state === "attack" &&
            this.move?.cancelMoves &&
            !special &&
            !this.move.cancelMoves.includes(candidate)
          )
            continue;
          if (!special && !candidateMove) continue;
          if (
            candidateMove?.stand &&
            !this.stand?.canBegin(canCancel(b) || this.stand?.s.mode === "link")
          )
            continue;
          if (this.buffer.consume(b)) {
            if (special === "counter") {
              this.setState("counter");
              this.vx = 0;
              this.buffer.consumeMotion();
              return;
            }
            this.attack(
              special
                ? `${special}_${b}`
                : b === "throw"
                  ? "throw"
                  : `${this.airborne ? "air" : input.down ? "crouch" : "stand"}_${b}`,
            );
            if (special) this.buffer.consumeMotion();
            break;
          }
        }
      }
      if (this.state !== "attack" && this.state !== "dash") {
        if (this.state === "jumpStart" || this.state === "landing") {
          this.vx = 0;
        } else if (
          !this.airborne &&
          input.direction !== 0 &&
          this.buffer.consume("dash")
        ) {
          this.dashDirection = input.direction;
          this.setState("dash");
        } else {
          if (this.airborne && this.data.locomotion) {
            if (input.direction)
              this.vx = input.direction * this.data.locomotion.airSpeed;
          } else
            this.vx =
              input.down && !this.airborne
                ? 0
                : input.direction *
                  (input.direction === this.facing
                    ? this.data.speed
                    : (this.data.locomotion?.backSpeed ?? this.data.speed));
          const next = this.airborne
            ? "air"
            : input.down
              ? "crouch"
              : input.direction
                ? "walk"
                : "idle";
          if (this.state !== next) this.setState(next);
        }
      }
      if (this.state === "dash") {
        const profile = this.data.locomotion;
        this.vx =
          this.dashDirection *
          (profile
            ? (this.dashDirection === this.facing
                ? profile.dashForward
                : profile.backdash)[this.stateFrame]
            : this.dashDirection === this.facing
              ? 14
              : 11);
      }
      if (this.state === "attack" && this.move) {
        const move = this.move;
        if (move.drive)
          this.vx =
            !this.connected &&
            this.stateFrame >= move.drive.from &&
            this.stateFrame < move.drive.to
              ? this.facing * move.drive.speed
              : 0;
        if (move.hopAt === this.stateFrame) this.vy = move.hopVelocity ?? 0;
      }
    }
    // A launcher jump cancel carries the swordsman forward briefly. This
    // closes the space opened by launch knockback without inflating the blade.
    if (this.airChaseTicks > 0) {
      if (this.airborne && (this.state === "air" || this.state === "attack")) {
        this.vx = this.facing * (this.data.airChaseSpeed ?? this.data.speed);
        if (--this.airChaseTicks === 0) this.vx = 0;
      } else this.airChaseTicks = 0;
    }
    const wasAirborne = this.airborne;
    if (wasAirborne) {
      this.vy += this.data.gravity;
    }
    this.x = Math.max(40, Math.min(1240, this.x + this.vx));
    this.y += this.vy;
    if (this.y >= FLOOR) {
      this.y = FLOOR;
      this.vy = 0;
      // Complete Dio's launched reaction on real floor contact. Do not mark
      // an airborne launcher victim downed early: that would prevent juggles.
      if (
        wasAirborne &&
        this.data.lifecycle &&
        this.state === "hitstun" &&
        this.hitLaunch
      )
        this.knockedDown = true;
      if (wasAirborne && this.knockedDown) this.stun = Math.max(this.stun, 24);
      if (
        wasAirborne &&
        (this.state === "air" ||
          (this.state === "attack" && this.moveId.startsWith("air_")))
      )
        this.setState("landing");
    }
    if (this.state === "hitstun" || this.state === "blockstun") this.vx *= 0.83;
    this.syncReactionClock(false);
  }
  /** Hit reactions have phases within one simulation state. Restart on apex
   * and ground contact, rather than skipping their opening frames by seeking
   * with the total elapsed hitstun. This clock also drives the hurtboxes. */
  syncReactionClock(advance: boolean) {
    if (this.state !== "hitstun") return;
    const phase = reactionFor(this)?.clip ?? "";
    if (phase !== this.reactionPhase) {
      this.reactionPhase = phase;
      this.reactionFrame = 0;
    } else if (advance) this.reactionFrame++;
  }
}
export interface HitEvent {
  audioOnly?: boolean;
  x: number;
  y: number;
  blocked: boolean;
  life: number;
  kind?:
    | "hit"
    | "guard"
    | "draw"
    | "crescent"
    | "counter"
    | "ultimate"
    | "power"
    | "roadImpact"
    | "roadPunch"
    | "roadExplosion";
  total?: number;
}
export interface CaptureSequence {
  kind: "ultimate" | "grab";
  attacker: number;
  victim: number;
  tick: number;
  scale: number;
}
export interface CombatHit {
  serial: number;
  frame: number;
  attacker: number;
  victim: number;
  move: string;
  damage: number;
  blocked: boolean;
  combo: number;
}
export interface MatchRules {
  training?: boolean;
  infiniteHealth?: [boolean, boolean];
}
export class Match {
  roadRoller?: RoadRollerState;
  temporal = new TemporalController();
  projectiles: KnifeProjectile[] = [];
  projectileSerial = 0;
  fighters: [Fighter, Fighter];
  frame = 0;
  combatFrame = 0;
  timer = 99 * 60;
  hitstop = 0;
  phase: "intro" | "fight" | "roundEnd" | "finished" = "intro";
  phaseFrames = 100;
  wins = [0, 0];
  round = 1;
  message = "ROUND 1";
  events: HitEvent[] = [];
  capture?: CaptureSequence;
  hits: CombatHit[] = [];
  hitSerial = 0;
  constructor(
    public data: CharacterData = character,
    public rules: MatchRules = {},
    public opponentData: CharacterData = data,
  ) {
    this.fighters = [
      new Fighter(data, 0, 400),
      new Fighter(opponentData, 1, 880),
    ];
    this.linkOpponents();
  }
  linkOpponents() {
    this.fighters[0].opponent = this.fighters[1];
    this.fighters[1].opponent = this.fighters[0];
    for (const fighter of this.fighters) fighter.match = this;
  }
  step(inputs: [InputFrame, InputFrame]) {
    this.frame++;
    this.hits = [];
    this.events = this.events.filter((e) => --e.life > 0);
    if (this.phase !== "fight") {
      if (this.phase === "finished") return;
      if (this.phase === "intro") {
        if (this.phaseFrames === 26) this.message = "LUTEM!";
        for (const f of this.fighters) {
          if (this.phaseFrames === 100) {
            f.setState("entrance");
            f.x =
              f.homeX - f.facing * (f.data.lifecycle?.entranceDistance ?? 48);
            f.buffer.clear();
          }
          f.stateFrame++;
          const entry = f.data.lifecycle;
          f.x =
            f.homeX -
            f.facing *
              Math.max(
                0,
                (entry?.entranceDistance ?? 48) -
                  f.stateFrame * (entry?.entranceSpeed ?? 2),
              );
        }
      } else {
        for (const f of this.fighters) {
          f.stateFrame++;
          if (
            f.state === "ko" &&
            f.stateFrame >= (f.data.lifecycle?.koTicks ?? 60)
          )
            f.setState("defeat");
        }
      }
      if (--this.phaseFrames <= 0) {
        if (this.phase === "intro") {
          this.phase = "fight";
          this.message = "";
          for (const f of this.fighters) {
            f.setState("idle");
            f.x = f.homeX;
            f.buffer.clear();
          }
        } else if (!this.rules.training && this.wins.some((w) => w >= 2)) {
          this.phase = "finished";
          this.message = this.wins[0] >= 2 ? "VOCÊ VENCEU" : "BOT VENCEU";
        } else {
          this.round++;
          this.projectiles = [];
          const meter = this.fighters.map((f) => f.meter);
          this.fighters = [
            new Fighter(this.data, 0, 400),
            new Fighter(this.opponentData, 1, 880),
          ];
          this.fighters.forEach((f, i) => (f.meter = meter[i]));
          this.linkOpponents();
          this.timer = 99 * 60;
          this.phase = "intro";
          this.phaseFrames = 100;
          this.message = `ROUND ${this.round}`;
          if (this.rules.training) {
            this.wins = [0, 0];
            this.phase = "fight";
            this.message = "";
            this.round = 1;
          }
        }
      }
      for (const f of this.fighters) f.stand?.tick(f);
      return;
    }
    if (this.roadRoller) {
      this.stepRoadRoller();
      return;
    }
    const timeWasActive = this.temporal.beginStep(
      this.hitstop === 0 && !this.capture,
    );
    if (this.hitstop > 0) {
      this.hitstop--;
      if (!this.capture)
        this.fighters.forEach(
          (f, i) =>
            !this.temporal.isFrozen(i) &&
            f.buffer.push(inputs[i], this.combatFrame, f.facing),
        );
      this.finishTemporalStep(timeWasActive);
      return;
    }
    if (this.capture) {
      this.stepCapture();
      for (const f of this.fighters) f.stand?.tick(f);
      this.finishTemporalStep(timeWasActive);
      return;
    }
    if (!this.rules.training && !this.temporal.active) this.timer--;
    this.combatFrame++;
    this.fighters.forEach((f, i) => {
      if (this.temporal.isFrozen(i)) return;
      const other = this.fighters[1 - i];
      f.guardIntent =
        inputs[i].direction === -f.facing &&
        !f.airborne &&
        Math.abs(f.x - other.x) < 200;
      f.tick(inputs[i], this.combatFrame, other);
    });
    for (const f of this.fighters)
      if (!this.temporal.isFrozen(f.id)) f.stand?.tick(f);
    this.stepSpecialReleases();
    for (const f of this.fighters)
      if (
        f.state === "attack" &&
        f.stateFrame === 0 &&
        f.move?.kind === "ultimate"
      )
        this.effect("power", f.x, f.y - 80, 20);
    const [a, b] = this.fighters;
    if (overlaps(a.pushbox(), b.pushbox()) && this.temporal.active) {
      // The frozen actor cannot be pushed. Clamp only the moving actor.
      const mover = this.fighters[this.temporal.s.owner],
        frozen = this.fighters[1 - this.temporal.s.owner];
      mover.x = frozen.x + (mover.x <= frozen.x ? -52 : 52);
      mover.x = Math.max(40, Math.min(1240, mover.x));
    } else if (overlaps(a.pushbox(), b.pushbox())) {
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      // Transfer the full separation to the free side at a wall; clamping
      // each actor independently leaves overlapping pushboxes in the corner.
      const center = Math.max(66, Math.min(1214, (left.x + right.x) / 2));
      left.x = center - 26;
      right.x = center + 26;
    }
    // Capture contacts before resolving so simultaneous attacks can trade.
    const contacts = this.fighters.map((f, i) => {
      if (this.temporal.isFrozen(i)) return null;
      const shapes = f.attackShapes();
      const target = this.fighters[1 - i];
      return shapes.length &&
        f.canConnect &&
        !target.knockedDown &&
        !target.invulnerable &&
        shapes.some((shape) =>
          (f.move?.kind === "grab"
            ? target.hurtboxes().slice(0, 2)
            : target.hurtboxes()
          ).some((hurt) => shapeHitsRect(shape, hurt)),
        ) &&
        !(
          f.move?.level === "throw" &&
          (target.airborne ||
            target.state === "hitstun" ||
            target.state === "blockstun")
        )
        ? {
            f,
            target,
            move: { ...f.move!, ...f.hitWindow },
            moveId: f.moveId,
            hitId: f.hitWindow?.id ?? 0,
            impact: f.move?.stand ? shapeBounds(shapes[0]) : undefined,
          }
        : null;
    });
    for (const c of contacts) {
      if (!c) continue;
      const { f, target, move: m, moveId } = c;
      if (m.super && f.health <= 0) continue;
      if (this.capture || this.roadRoller) continue;
      // A strike beats a simultaneous throw; do not capture an actor whose
      // already-sampled strike is about to resolve on this same simulation tick.
      if (
        m.kind === "grab" &&
        contacts.some(
          (other) => other && other.f === target && other.move.kind !== "grab",
        )
      )
        continue;
      f.connected = true;
      f.hitIds.push(c.hitId);
      if (
        !this.temporal.isFrozen(target.id) &&
        target.counterWindow &&
        m.level !== "low" &&
        m.level !== "throw" &&
        m.kind !== "ultimate" &&
        m.kind !== "roadRoller" &&
        (f.x - target.x) * target.facing > 0
      ) {
        f.setState("hitstun");
        f.stun = 12;
        f.reactionStrength = 1;
        target.facing = f.x >= target.x ? 1 : -1;
        target.attack("counter_strike");
        target.buffer.clear();
        this.hitstop = Math.max(this.hitstop, 8);
        this.effect("counter", target.x, target.y - 85, 16);
        continue;
      }
      if (m.kind === "grab") {
        this.beginCapture("grab", f, target);
        continue;
      }
      this.resolveImpact(f, target, m, moveId, c.impact);
    }
    if (this.roadRoller) return;
    this.stepProjectiles();
    for (const f of this.fighters) f.syncReactionClock(false);
    if (this.capture) {
      this.finishTemporalStep(timeWasActive);
      return;
    }
    this.checkRoundEnd();
    this.finishTemporalStep(timeWasActive);
  }
  private resolveImpact(
    f: Fighter,
    target: Fighter,
    m: Move,
    moveId: string,
    impact?: Rect,
    direction = f.facing,
  ) {
    const frozen = this.temporal.isFrozen(target.id);
    const guarding =
      target.input.direction === -target.facing &&
      !target.airborne &&
      ["idle", "walk", "crouch", "landing", "blockstun"].includes(
        target.state,
      ) &&
      (m.special !== "knives" || direction === -target.facing);
    const blocked =
      guarding &&
      m.level !== "throw" &&
      (m.level !== "low" || target.input.down) &&
      (m.level !== "high" || !target.input.down);
    let damage = blocked
      ? 0
      : Math.round(m.damage * Math.max(0.35, 1 - target.combo * 0.1));
    if (frozen && !blocked && !m.super) {
      damage = this.temporal.budget(damage);
      if (!damage) return;
    }
    const applied = this.damage(
      target,
      damage,
      (m.kind === "ultimate" || m.kind === "roadRoller") && !blocked ? 1 : 0,
    );
    const reaction: DeferredReaction = {
      blocked,
      stun: blocked ? m.blockstun : m.stun,
      vx: direction * m.push,
      vy: blocked ? 0 : m.launch,
      knockdown: !blocked && !!m.knockdown,
      strength: m.damage <= 50 ? 1 : m.damage <= 90 ? 2 : 3,
      launch: m.launch <= -9,
      crouched: target.crouching,
    };
    if (!blocked) {
      if (!target.combo) target.comboAge = target.comboAirHits = 0;
      target.combo++;
      if (target.airborne || m.launch < 0) target.comboAirHits++;
      const limit = f.data.combatLimits;
      if (
        limit &&
        (target.combo >= (m.comboHitLimit ?? limit.maxHits) ||
          target.comboAirHits >= limit.maxAirHits ||
          target.comboAge >= limit.maxTicks)
      ) {
        reaction.knockdown = true;
        reaction.vy = 10;
        reaction.stun = Math.max(reaction.stun, 30);
      }
      if (m.kind !== "ultimate")
        f.meter = Math.min(f.meterMaximum, f.meter + (m.meterGain ?? 10));
      target.meter = Math.min(target.meterMaximum, target.meter + 5);
      if (f.airborne && m.airHold !== undefined) f.vy = m.airHold;
    }
    if (frozen) this.temporal.defer(target.id, reaction);
    else this.applyReaction(target, reaction);
    this.recordHit(f, target, moveId, applied, blocked);
    this.hitstop = Math.max(
      this.hitstop,
      blocked
        ? Math.max(3, Math.floor((m.hitstop ?? 8) * 0.6))
        : (m.hitstop ?? 8),
    );
    this.effect(
      blocked
        ? "guard"
        : m.kind === "draw"
          ? "draw"
          : m.kind === "crescent"
            ? "crescent"
            : "hit",
      impact ? impact.x + impact.w / 2 : target.x,
      impact ? impact.y + impact.h / 2 : target.y - 80,
      16,
      blocked,
    );
    if (m.kind === "ultimate" && !blocked)
      this.beginCapture("ultimate", f, target);
    if (m.kind === "roadRoller" && !blocked) this.beginRoadRoller(f, target);
  }
  private applyReaction(target: Fighter, reaction: DeferredReaction) {
    target.hitCrouched = target.blockCrouched = reaction.crouched;
    target.reactionStrength = reaction.strength;
    target.hitLaunch = reaction.launch;
    target.setState(reaction.blocked ? "blockstun" : "hitstun");
    target.stun = reaction.stun;
    target.vx = reaction.vx;
    target.vy = reaction.vy;
    target.knockedDown = reaction.knockdown;
  }
  private finishTemporalStep(wasActive: boolean) {
    const pending = this.temporal.endStep(wasActive);
    if (pending)
      for (let i = 0; i < 2; i++) {
        this.fighters[i].buffer.clear();
        if (pending[i] && this.phase === "fight")
          this.applyReaction(this.fighters[i], pending[i]!);
      }
  }
  private stepSpecialReleases() {
    for (const f of this.fighters) {
      if (this.temporal.isFrozen(f.id) || f.state !== "attack") continue;
      const m = f.move!;
      if (
        m.special === "timeStop" &&
        f.stateFrame === m.startup &&
        this.temporal.activate(f.id)
      ) {
        this.fighters[1 - f.id].buffer.clear();
      }
      if (!m.projectile) continue;
      for (let i = 0; i < m.projectile.releases.length; i++) {
        if (
          m.projectile.releases[i] !== f.stateFrame ||
          this.projectiles.filter((p) => p.owner === f.id).length >=
            dioBalance.knives.maximumPerOwner
        )
          continue;
        const hand = poseAt(m, f.stateFrame)?.release;
        const x = f.x + (hand?.x ?? 40) * f.facing,
          y = f.y + (hand?.y ?? -95);
        const angle = m.projectile.angles[i];
        this.projectiles.push({
          id: ++this.projectileSerial,
          owner: f.id,
          move: f.moveId,
          x,
          y,
          previousX: x,
          previousY: y,
          vx: m.projectile.speed * Math.cos(angle) * f.facing,
          vy: m.projectile.speed * Math.sin(angle),
          facing: f.facing,
          age: 0,
          life: m.projectile.life,
          sprite: angle < 0 ? 0 : angle > 0 ? 2 : 1,
          damage: m.damage,
          stun: m.stun,
          blockstun: m.blockstun,
        });
      }
    }
  }
  private stepProjectiles() {
    if (this.temporal.active && dioBalance.timeStop.freezeAllProjectiles)
      return;
    this.projectiles = this.projectiles.filter((p) => {
      p.previousX = p.x;
      p.previousY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      if (
        --p.life <= 0 ||
        p.x < -30 ||
        p.x > 1310 ||
        p.y < -40 ||
        p.y > FLOOR + 20
      )
        return false;
      const target = this.fighters[1 - p.owner],
        owner = this.fighters[p.owner];
      if (
        target.knockedDown ||
        target.invulnerable ||
        !projectileHits(p, target.hurtboxes())
      )
        return true;
      const source = owner.data.specialMoves?.[p.move];
      if (source)
        this.resolveImpact(
          owner,
          target,
          { ...source, damage: p.damage, stun: p.stun, blockstun: p.blockstun },
          p.move,
          { x: p.x - 14, y: p.y - 3, w: 29, h: 6 },
          p.facing,
        );
      return false;
    });
  }
  private damage(target: Fighter, damage: number, minimum = 0) {
    if (this.rules.infiniteHealth?.[target.id]) return damage;
    const next = Math.max(minimum, target.health - damage),
      applied = target.health - next;
    target.health = next;
    return Math.max(0, applied);
  }
  private recordHit(
    attacker: Fighter,
    victim: Fighter,
    move: string,
    damage: number,
    blocked = false,
  ) {
    this.hits.push({
      serial: ++this.hitSerial,
      frame: this.combatFrame,
      attacker: attacker.id,
      victim: victim.id,
      move,
      damage,
      blocked,
      combo: victim.combo,
    });
  }
  private effect(
    kind: NonNullable<HitEvent["kind"]>,
    x: number,
    y: number,
    life: number,
    blocked = false,
  ) {
    this.events.push({ kind, x, y, life, total: life, blocked });
  }
  private beginCapture(
    kind: CaptureSequence["kind"],
    attacker: Fighter,
    victim: Fighter,
  ) {
    const center = Math.max(140, Math.min(1140, (attacker.x + victim.x) / 2));
    attacker.x = center - attacker.facing * 36;
    victim.x = center + attacker.facing * 36;
    attacker.y = victim.y = FLOOR;
    attacker.vx = attacker.vy = victim.vx = victim.vy = 0;
    victim.facing = -attacker.facing;
    victim.health = Math.max(1, victim.health);
    attacker.setState(kind === "grab" ? "grabbing" : "cinematic");
    victim.setState("grabbed");
    attacker.actionClip = kind === "ultimate" ? "ultimateRush" : "grabHold";
    victim.actionClip = kind === "ultimate" ? "damageMedium" : "grabbed";
    attacker.buffer.clear();
    victim.buffer.clear();
    this.capture = {
      kind,
      attacker: attacker.id,
      victim: victim.id,
      tick: 0,
      scale: Math.max(0.45, 1 - Math.max(0, victim.combo - 1) * 0.08),
    };
    this.hitstop = Math.max(this.hitstop, kind === "ultimate" ? 12 : 5);
  }
  private beginRoadRoller(a: Fighter, b: Fighter) {
    const bound = roadConfig.objectHalfWidth + roadConfig.objectMargin;
    this.roadRoller = {
      attacker: a.id,
      victim: b.id,
      tick: 0,
      facing: a.facing,
      scale: Math.max(
        roadConfig.minimumComboScale,
        1 - Math.max(0, b.combo - 1) * 0.08,
      ),
      originX: a.x,
      targetX: b.x,
      targetY: b.y,
      rollerX: Math.max(bound, Math.min(1280 - bound, b.x - a.facing * 95)),
      landingX: Math.max(60, Math.min(1220, b.x - a.facing * 125)),
      standOriginX: a.stand!.transform.x,
      standOriginY: a.stand!.transform.y,
    };
    a.setState("cinematic");
    b.setState("grabbed");
    a.vx = a.vy = b.vx = b.vy = 0;
    a.airChaseTicks = 0;
    b.airChaseTicks = 0;
    a.buffer.clear();
    b.buffer.clear();
    this.hitstop = 0;
    // A confirmed Super temporarily owns reactions and clocks. It preserves
    // every temporal use/cooldown and resumes an active stop afterwards.
    this.temporal.s.pending[b.id] = null;
    this.stageRoadRoller();
  }
  private stageRoadRoller() {
    const s = this.roadRoller!,
      scene = roadScene(s),
      a = this.fighters[s.attacker],
      b = this.fighters[s.victim];
    a.x = scene.attacker.x;
    a.y = scene.attacker.y;
    a.actionClip = scene.attacker.clip;
    a.stateFrame = scene.attacker.tick;
    a.facing = s.facing;
    b.x = scene.victim.x;
    b.y = scene.victim.y;
    b.actionClip = scene.victim.clip;
    b.stateFrame = scene.victim.tick;
    b.facing = -s.facing;
    const stand = a.stand!;
    stand.s.mode = "cinematic";
    stand.s.timeline = undefined;
    stand.s.moveId = "";
    stand.s.ownerLiftFrame = -1;
    stand.s.x = scene.stand.x;
    stand.s.y = scene.stand.y;
    stand.s.facing = s.facing;
    stand.s.depth = scene.stand.depth;
    stand.s.clip = scene.stand.clip;
    stand.s.clipTick = scene.stand.tick;
    if (s.tick >= roadConfig.phases.landing) b.stand?.tick(b);
  }
  private stepRoadRoller() {
    const s = this.roadRoller!,
      t = ++s.tick,
      a = this.fighters[s.attacker],
      b = this.fighters[s.victim];
    this.stageRoadRoller();
    let damage = 0,
      label = "";
    if (t === roadConfig.phases.impact) {
      damage = roadConfig.impactDamage;
      label = "road_impact";
    }
    if (roadConfig.punchTicks.includes(t)) {
      damage = roadConfig.punchDamage;
      label = "road_punch";
    }
    if (t === roadConfig.phases.explosion) {
      damage = roadConfig.finalDamage;
      label = "road_explosion";
    }
    if (damage) {
      const applied = this.damage(
        b,
        Math.round(damage * s.scale),
        label === "road_explosion" ? 0 : 1,
      );
      b.combo++;
      this.recordHit(a, b, label, applied);
      b.meter = Math.min(b.meterMaximum, b.meter + 2);
      this.events.push({
        kind:
          label === "road_impact"
            ? "roadImpact"
            : label === "road_explosion"
              ? "roadExplosion"
              : "roadPunch",
        audioOnly: true,
        x: b.x,
        y: 500,
        life: 8,
        total: 8,
        blocked: false,
      });
    }
    if (t >= roadConfig.duration) {
      a.x = s.landingX;
      a.y = FLOOR;
      a.vx = a.vy = 0;
      a.actionClip = "";
      a.setState("idle");
      a.stand!.s.mode = "follow";
      a.stand!.s.x = a.x - 30 * a.facing;
      a.stand!.s.y = FLOOR - 18;
      a.stand!.s.depth = 0;
      a.stand!.s.clip = "standIdle";
      a.stand!.s.clipTick = 0;
      a.stand!.s.timeline = undefined;
      a.stand!.s.returnClip = undefined;
      b.actionClip = "";
      b.setState("hitstun");
      b.y = FLOOR;
      b.vy = -5;
      b.vx = s.facing * 5;
      b.stun = 38;
      b.knockedDown = true;
      b.hitCrouched = false;
      b.hitLaunch = false;
      b.reactionStrength = 3;
      b.syncReactionClock(false);
      a.buffer.clear();
      b.buffer.clear();
      this.roadRoller = undefined;
      this.hitstop = 0;
      this.checkRoundEnd();
    }
  }
  private stepCapture() {
    const sequence = this.capture!;
    const a = this.fighters[sequence.attacker],
      b = this.fighters[sequence.victim];
    const tick = sequence.tick++;
    a.stateFrame = tick;
    b.stateFrame = tick;
    if (sequence.kind === "ultimate") {
      a.actionClip =
        tick < cinematics.ultimate.rushDuration
          ? "ultimateRush"
          : "ultimateFinish";
      a.stateFrame = tick < 48 ? tick : tick - 48;
      b.actionClip =
        tick >= cinematics.ultimate.finishTick ? "damageHeavy" : "damageMedium";
      b.stateFrame = tick % 15;
      // Native-pixel bobbing avoids cross-engine Math.sin differences in the
      // synchronized state. The finisher remains at its original height.
      b.y =
        FLOOR -
        (tick >= 54
          ? 18
          : cinematics.ultimate.bob[tick % cinematics.ultimate.bob.length]);
      const finish = tick === cinematics.ultimate.finishTick;
      if (cinematics.ultimate.hits.includes(tick) || finish) {
        const damage = Math.round(
          (finish
            ? cinematics.ultimate.finishDamage
            : cinematics.ultimate.damage) * sequence.scale,
        );
        const applied = this.damage(b, damage, finish ? 0 : 1);
        b.combo++;
        this.recordHit(
          a,
          b,
          finish ? "ultimate_finish" : "ultimate_cut",
          applied,
        );
        b.meter = Math.min(b.meterMaximum, b.meter + 3);
        this.effect("ultimate", b.x, b.y - 75, 12);
        this.hitstop = finish ? 15 : 3;
      }
      if (sequence.tick >= cinematics.ultimate.duration)
        this.endCapture(sequence, a, b);
    } else {
      a.actionClip = "grabHold";
      b.actionClip = "grabbed";
      if (tick === cinematics.grab.hitTick) {
        const applied = this.damage(b, cinematics.grab.damage);
        b.combo++;
        this.recordHit(a, b, "throw", applied);
        this.effect("hit", b.x, b.y - 75, 12);
        this.hitstop = 8;
        a.meter = Math.min(a.meterMaximum, a.meter + 10);
        b.meter = Math.min(b.meterMaximum, b.meter + 5);
      }
      if (sequence.tick >= cinematics.grab.duration)
        this.endCapture(sequence, a, b);
    }
  }
  private endCapture(sequence: CaptureSequence, a: Fighter, b: Fighter) {
    a.setState(
      sequence.kind === "ultimate" ? "ultimateRecover" : "throwRecover",
    );
    a.actionClip = "";
    b.setState("hitstun");
    b.actionClip = "";
    b.knockedDown = true;
    b.hitCrouched = false;
    b.hitLaunch = sequence.kind === "grab";
    b.reactionStrength = 3;
    b.stun = 35;
    b.vx = a.facing * 8;
    b.vy = sequence.kind === "ultimate" ? 12 : -6;
    b.syncReactionClock(false);
    a.buffer.clear();
    b.buffer.clear();
    this.capture = undefined;
    this.checkRoundEnd();
  }
  private checkRoundEnd() {
    const [a, b] = this.fighters;
    if (a.health <= 0 || b.health <= 0 || this.timer <= 0) {
      if (this.temporal.active) this.temporal.finish();
      this.projectiles = [];
      const winner = a.health === b.health ? -1 : a.health > b.health ? 0 : 1;
      if (winner < 0) {
        this.message = "EMPATE";
      } else {
        this.wins[winner]++;
        this.message = this.timer <= 0 ? "TEMPO ESGOTADO" : "K.O.";
      }
      this.fighters.forEach((f, i) => {
        f.vx = f.vy = 0;
        f.y = FLOOR;
        f.buffer.clear();
        f.setState(winner < 0 ? "idle" : i === winner ? "victory" : "ko");
      });
      this.phase = "roundEnd";
      this.phaseFrames = 150;
    }
  }
}
