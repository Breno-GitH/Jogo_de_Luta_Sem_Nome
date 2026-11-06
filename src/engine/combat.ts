import samurai from "../data/samurai.json";
import { CombatStand } from "./stand-combat";
import { TemporalController, type DeferredReaction } from "./temporal";
import { projectileHits, type KnifeProjectile } from "./projectiles";
import {
  gokuBalance,
  canStartGokuSpecial,
  canCancelGokuSpecial,
  gokuInvisible,
  tickGokuMove,
  beamOrigin,
  beamBox,
  type KiProjectile,
  type KiBeam,
} from "./goku-specials";
import dioBalance from "../data/dio-specials.json";
import { roadConfig, roadScene, type RoadRollerState } from "./road-roller";
import {
  canStartFury,
  furyConfig,
  furyScene,
  type FuryState,
} from "./goku-fury";
import { CommandBuffer } from "./input";
import { MOVEMENT_TIMING } from "./movement";
import { combatPace, pacedCharacter } from "./pace";
import cinematics from "../data/cinematics.json";
import { reactionBoxes, reactionFor } from "./lifecycle";
import { isSuperMove, poseAt, phaseAt } from "./moves";
import { luffyAttackLimbs, luffySpecialCommand } from "./luffy-specials";
import {
  isSasukeSpecial, sasukeSpecialBalance, sasukeSpecialCommand, sasukeSpecialContact,
  sasukeTechniques, type SasukeSpecialId,
} from "./sasuke-specials";
import {
  canAwaken, curseAwaken, curseMove, curseRevert, curseSpecialContact, curseSpecials,
  sasukeCurseMovement, sasukeCurseMoves, startCurse, tickSasukeAirBurst,
  tickSasukeCurse, winged, type SasukeCurseState,
} from "./sasuke-curse";
import { canStartKirin, kirinConfig, kirinId, kirinCurseOpener, kirinScene, type KirinState } from "./sasuke-kirin";
import { chidoriVelocity, fireDragonPoint, fireDragonVolumes, fireDragonWave, nagashiVolumes, sasukePolish } from "./sasuke-polish";
import { luffyGrabLimb } from "./luffy-secondary";
import { jetConfig, jetId, jetOpener, jetScene, type JetState } from "./luffy-jet-gigant";
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
export const character: CharacterData = pacedCharacter(samurai);
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
  hitConfirmed = false;
  reverseBeatUsed = false;
  hitIds: number[] = [];
  comboAge = 0;
  comboAirHits = 0;
  combo = 0;
  knockedDown = false;
  dashDirection = 1;
  jumpDirection = 0;
  airChaseTicks = 0;
  gokuTeleportLock = 0;
  gokuAirTeleportUsed = false;
  gokuAirTeleportsUsed = 0;
  gokuCastSerial = 0;
  sasukeCurse?: SasukeCurseState;
  kirinCursed?: boolean;
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
    return this.lookupMove(this.moveId);
  }
  private lookupMove(id: string) {
    if (id === kirinId && (this.moveId === id ? this.kirinCursed : winged(this)))
      return kirinCurseOpener;
    return curseMove(this, id) ?? this.data.moves[id] ??
      this.data.specialMoves?.[id] ?? this.data.superMoves?.[id];
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
    if (this.data.id === "goku") return canCancelGokuSpecial(this);
    return (
      !this.airborne &&
      !this.move?.special &&
      !this.move?.super &&
      (!["luffy", "sasuke"].includes(this.data.id) || this.hitConfirmed) &&
      this.canCancel("special")
    );
  }
  canStartSpecial(id: string) {
    if (this.data.id === "goku") return canStartGokuSpecial(this, id);
    const move = (winged(this) ? sasukeCurseMoves[id] : undefined) ?? this.data.specialMoves?.[id];
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
    if (this.data.id === "sasuke" && isSasukeSpecial(id) && this.match) {
      const shots = (winged(this) ? curseSpecials : sasukeTechniques)[id].shots;
      if (shots && this.match.kiProjectiles.filter(
        (p) => p.owner === this.id && p.state === "flight",
      ).length + shots.length > sasukeSpecialBalance.maximumProjectiles) return false;
    }
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
  gainMeter(amount: number) {
    this.meter = Math.min(
      this.meterMaximum,
      this.meter + amount * (this.data.meterGainScale ?? 1),
    );
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
    if (this.match?.cinematicActive) return false;
    if (this.data.id === "sasuke") return canStartKirin(this);
    if (this.data.id === "luffy")
      return (
        !!this.data.superMoves?.[jetId] &&
        this.meter >= jetConfig.cost &&
        !this.airborne &&
        !this.match?.capture &&
        (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(this.state) ||
          (this.hitConfirmed && this.canSuperCancel()))
      );
    if (this.data.id === "samurai") {
      const m = this.data.moves.ultimate_start;
      return (
        !!m &&
        this.meter >= (m.cost ?? 100) &&
        !this.airborne &&
        !this.match?.capture &&
        (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
          this.state,
        ) ||
          this.canSuperCancel())
      );
    }
    if (this.data.id === "goku") return canStartFury(this);
    return (
      !!this.data.superMoves?.road_roller &&
      this.meter >= roadConfig.cost &&
      !this.airborne &&
      !this.match?.capture &&
      (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
        this.state,
      ) ||
        this.canSuperCancel()) &&
      !!this.stand?.canBegin(this.canSuperCancel())
    );
  }
  hurtbox(): Rect {
    const boxes = this.hurtboxes();
    return boxes.length
      ? unionBounds(boxes)
      : { x: this.x, y: this.y, w: 0, h: 0 };
  }
  hurtboxes(): Rect[] {
    if (gokuInvisible(this)) return [];
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
    const limbs = luffyAttackLimbs(this);
    if (limbs.length)
      boxes = [...boxes, ...limbs.flatMap(limb => limb.limbHurtboxes.map(shapeBounds))];
    if (this.state === "attack") {
      const grip = luffyGrabLimb(this) ?? jetOpener(this);
      if (grip) boxes = [...boxes, ...grip.limbHurtboxes.map(shapeBounds)];
    }
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
      gokuInvisible(this) ||
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
    if (this.sasukeCurse?.phase === "ending") return false;
    const window = this.move?.cancelWindow;
    const reverse =
      name === "light" &&
      combatPace.cancel.reverseBeatOnHit &&
      this.hitConfirmed &&
      !this.reverseBeatUsed &&
      !this.airborne &&
      this.move?.rank === 2 &&
      !this.move?.special;
    if (
      !this.hitConfirmed &&
      (name === "jump" || (name === "special" && (this.move?.rank ?? 0) >= 3))
    )
      return false;
    return (
      this.state === "attack" &&
      this.connected &&
      (!!this.move?.cancels.includes(name) || reverse) &&
      (this.hitConfirmed ||
        this.stateFrame <=
          (this.move?.startup ?? 0) +
            (this.move?.active ?? 0) +
            combatPace.cancel.blockTailTicks) &&
      (!window ||
        (this.stateFrame >= window.fromTick &&
          this.stateFrame <= window.toTick))
    );
  }
  canCancelMove(id: string) {
    return (
      this.canCancel(id.split("_").at(-1)!) &&
      (id.endsWith("_light") ||
        !this.move?.cancelMoves ||
        this.move.cancelMoves.includes(id))
    );
  }
  pushbox(): Rect {
    return { x: this.x - 26, y: this.y - 90, w: 52, h: 90 };
  }
  hitbox(): Rect | undefined {
    const shapes = this.attackShapes();
    return shapes.length ? unionBounds(shapes.map(shapeBounds)) : undefined;
  }
  attackShapes(previousX = this.x): AttackShape[] {
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
    if (m.special === "chidori" && pose?.release) {
      const hand = pose.release;
      const touch = worldCapsule(
        { a: { x: hand.x - 17, y: hand.y + 4 }, b: hand, r: winged(this) ? 23 : 20 },
        this.x, this.y, this.facing,
      );
      if (previousX !== this.x) return [touch, {
        a: { x: touch.b.x + previousX - this.x, y: touch.b.y }, b: touch.b, r: touch.r,
      }];
      return [touch];
    }
    if (m.special === "nagashi")
      return nagashiVolumes(this.stateFrame - m.startup, winged(this))
        .map(shape => worldCapsule(shape, this.x, this.y, this.facing));
    if (m.special && isSasukeSpecial(m.special)) {
      const age = this.stateFrame - m.startup;
      const shapes = winged(this) && pose?.release
        ? curseSpecialContact(m.special, age, this.facing, this.x, pose.release)
        : sasukeSpecialContact(m.special, age, this.facing, this.x);
      return shapes.map(shape => worldCapsule(shape, this.x, this.y, this.facing));
    }
    const limbs = luffyAttackLimbs(this);
    if (limbs.length)
      return limbs.flatMap(limb => limb.hitboxes.map(shape => worldCapsule(shape, this.x, this.y, this.facing)));
    if (m.kind === "jetGigant")
      return jetOpener(this)?.hitboxes.map(shape => worldCapsule(shape, this.x, this.y, this.facing)) ?? [];
    if (m.kind === "grab") {
      if (this.data.id === "luffy") {
        const grip = luffyGrabLimb(this);
        return grip?.hitboxes.map(shape => worldCapsule(shape, this.x, this.y, this.facing)) ?? [];
      }
      return [worldRect(m.box, this.x, this.y, this.facing)];
    }
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
      this.kirinCursed = undefined;
      this.connected = false;
      this.hitConfirmed = false;
      this.hitIds = [];
    }
  }
  attack(id: string) {
    const phase = this.sasukeCurse?.phase;
    if (id === curseAwaken && !canAwaken(this)) return false;
    if (id === curseRevert ? phase !== "ending" : phase === "ending") return false;
    const m = this.lookupMove(id);
    if (!m || this.meter < (m.cost ?? 0)) return false;
    if (m.kind === "ultimate" && !this.canStartSuper()) return false;
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
    if (
      this.state === "attack" &&
      this.move?.rank === 2 &&
      id.endsWith("_light")
    )
      this.reverseBeatUsed = true;
    const superLink =
      m.kind === "gokuFury" &&
      combatPace.cancel.gokuSuperLink &&
      this.canSuperCancel() &&
      this.hitConfirmed &&
      this.opponent?.state === "hitstun";
    this.meter -= m.cost ?? 0;
    this.setState("attack", chain);
    this.moveId = id;
    this.kirinCursed = id === kirinId ? winged(this) : undefined;
    if (this.data.id === "goku" && m.special) {
      this.gokuCastSerial++;
      this.airChaseTicks = 0;
      if (m.special === "teleport") {
        this.gokuTeleportLock = gokuBalance.teleport[m.gokuStrength!].lockTicks;
        if (m.airTeleport || m.gokuStrength === "heavy") {
          this.gokuAirTeleportUsed = true;
          this.gokuAirTeleportsUsed++;
        }
      }
    }
    this.connected = false;
    this.hitConfirmed = false;
    this.hitIds = [];
    if (!this.airChaseTicks) this.vx = 0;
    if (m.stand) this.stand?.begin(id, m.stand, this, this.opponent?.x, chain);
    if (superLink && this.opponent) {
      this.opponent.stun = Math.max(this.opponent.stun, m.startup + 4);
      this.opponent.vx = 0;
    }
    return true;
  }
  tick(input: InputFrame, frame: number, opponent: Fighter) {
    if (this.data.id === "goku") {
      this.gokuTeleportLock = Math.max(0, this.gokuTeleportLock - 1);
      if (
        !this.airborne &&
        ["idle", "walk", "crouch"].includes(this.state) &&
        !opponent.combo
      ) {
        this.gokuAirTeleportUsed = false;
        this.gokuAirTeleportsUsed = 0;
      }
    }
    this.input = input;
    if (!opponent.combo && this.state !== "attack")
      this.reverseBeatUsed = false;
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
      throwRecover: this.data.grabSequence?.recoveryTicks ?? 12,
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
    if (tickSasukeAirBurst(this)) {
      // The burst owns horizontal movement until its final velocity sample.
    } else if (this.state === "hitstun" || this.state === "blockstun") {
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
          (this.data.locomotion?.airSpeed ?? this.data.speed) * sasukeCurseMovement(this);
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
      const superRequested = this.buffer.actions.some(
        (action) => action.button === "ultimate",
      );
      if (superRequested) {
        const id =
          this.data.id === "goku"
            ? "ssj1_fury"
            : this.data.id === "dio"
              ? "road_roller"
              : this.data.id === "luffy" ? jetId : this.data.id === "sasuke" ? kirinId : "ultimate_start";
        const move = this.data.moves[id] ?? this.data.superMoves?.[id];
        if (this.canStartSuper()) {
          this.attack(id);
          this.buffer.consume("ultimate");
          this.buffer.consumeMotion();
          return;
        }
        if (!move || this.meter < (move.cost ?? 100))
          this.buffer.consume("ultimate");
      }
      if (this.data.id === "goku" && this.data.specialMoves) {
        for (const button of ["heavy", "medium", "light"] as const) {
          const c = gokuBalance.commands,
            special = this.buffer.gokuSpecial(
              button,
              c.motionTicks,
              c.finishTicks,
              c.doubleDownTicks,
              c.minimumDownGapTicks,
            );
          if (!special) continue;
          const id =
            special === "teleport" && this.airborne
              ? button === "heavy"
                ? "teleport_air"
                : `teleport_air_${button}`
              : `${special}_${button}`;
          if (this.canStartSpecial(id)) {
            this.attack(id);
            this.buffer.consumeSpecial(button);
            return;
          }
          // Keep an eight-tick buffered special through a valid cancel window.
          // A recognised unavailable special must never become a normal.
          if (this.state !== "attack") {
            this.buffer.consumeSpecial(button);
            return;
          }
        }
      }
      if (this.data.id === "sasuke") {
        for (const button of ["heavy", "medium", "light"] as const) {
          const id = sasukeSpecialCommand(this.buffer, button);
          if (!id) continue;
          if (id === "curse") {
            this.buffer.consumeSpecial(button);
            startCurse(this);
            return;
          }
          if (this.attack(id)) {
            this.buffer.consumeSpecial(button);
            return;
          }
          if (free || this.move?.special) this.buffer.consumeSpecial(button);
          break;
        }
      }
      if (this.data.id === "luffy" && !this.airborne) {
        for (const button of ["heavy", "medium", "light"] as const) {
          const special = luffySpecialCommand(this.buffer, button);
          if (!special) continue;
          if (this.attack(`${special}_${button}`)) {
            this.buffer.consumeSpecial(button);
            return;
          }
          if (free || this.move?.special) this.buffer.consumeSpecial(button);
          break;
        }
      }
      if (this.data.id === "dio" && this.data.specialMoves && !this.airborne) {
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
          this.vy = Math.min(
            this.data.jump,
            Math.max(
              -combatPace.cancel.maximumChaseJumpSpeed,
              opponent.vy +
                (opponent.y - this.y) / combatPace.cancel.chaseCatchTicks,
            ),
          );
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
          if (this.data.id === "sasuke" && sasukeSpecialCommand(this.buffer, b)) continue;
          if (this.data.id === "luffy" && !this.airborne && luffySpecialCommand(this.buffer, b))
            continue;
          if (
            this.data.id === "dio" &&
            this.data.specialMoves &&
            !this.airborne &&
            this.buffer.dioSpecial(b)
          )
            continue;
          if (
            this.data.id === "goku" &&
            this.data.specialMoves &&
            this.buffer.gokuSpecial(
              b,
              gokuBalance.commands.motionTicks,
              gokuBalance.commands.finishTicks,
              gokuBalance.commands.doubleDownTicks,
              gokuBalance.commands.minimumDownGapTicks,
            )
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
            !candidate.endsWith("_light") &&
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
              this.vx = input.direction * this.data.locomotion.airSpeed * sasukeCurseMovement(this);
          } else
            this.vx =
              input.down && !this.airborne
                ? 0
                : input.direction *
                  (input.direction === this.facing
                    ? this.data.speed
                    : (this.data.locomotion?.backSpeed ?? this.data.speed)) * sasukeCurseMovement(this);
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
              : 11) * sasukeCurseMovement(this);
      }
      if (this.state === "attack" && this.move) {
        const move = this.move;
        if (move.special === "chidori")
          this.vx = this.connected ? 0 : this.facing * chidoriVelocity(this.stateFrame, winged(this));
        else if (move.drive)
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
        const speed = (this.data.airChaseSpeed ?? this.data.speed) * sasukeCurseMovement(this);
        const gap =
          (opponent.x - this.x) * this.facing - combatPace.cancel.chaseSpacing;
        this.vx = this.facing * Math.max(-speed, Math.min(speed, gap));
        if (--this.airChaseTicks === 0) {
          this.vx = 0;
          // A missed pursuit must not retain the boosted launch velocity and
          // carry the fighter offscreen; confirmed air hits use their own hold.
          if (this.vy < this.data.jump)
            this.vy = -combatPace.cancel.chaseExitUpSpeed;
        }
      } else this.airChaseTicks = 0;
    }
    tickGokuMove(this);
    const wasAirborne = this.airborne;
    if (
      wasAirborne &&
      !(
        this.state === "attack" &&
        this.move?.airTeleport &&
        this.stateFrame < this.move.startup + this.move.active
      )
    ) {
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
        (this.data.lifecycle || this.data.id === "goku") &&
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
  sasuke?: { kind: "chidori" | "goryuka"; cursed: boolean; facing: number };
  luffy?: { actor: number; move: string; direction: number; style: "kick" | "punch" | "rush" | "double" };
  strength?: number;
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
    | "roadExplosion"
    | "kirinCharge"
    | "kirinThunder";
  total?: number;
}
export interface CaptureSequence {
  kind: "ultimate" | "grab";
  attacker: number;
  victim: number;
  tick: number;
  scale: number;
  contactX?: number;
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
  fury?: FuryState;
  jetGigant?: JetState;
  kirin?: KirinState;
  get cinematicActive() { return !!(this.roadRoller || this.fury || this.jetGigant || this.kirin); }
  temporal = new TemporalController();
  projectiles: KnifeProjectile[] = [];
  kiProjectiles: KiProjectile[] = [];
  sasukeStormUntil = 0;
  sasukeStormLevel = 0;
  beams: KiBeam[] = [];
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
          this.kiProjectiles = [];
          this.beams = [];
          this.sasukeStormUntil = this.sasukeStormLevel = 0;
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
    if (this.fury || this.jetGigant || this.kirin) {
      this.stepStagedSuper();
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
    const beforeMovement = this.fighters.map(f => f.x);
    this.fighters.forEach((f, i) => {
      if (this.temporal.isFrozen(i)) return;
      const other = this.fighters[1 - i];
      f.guardIntent =
        inputs[i].direction === -f.facing &&
        !f.airborne &&
        Math.abs(f.x - other.x) < 200;
      tickSasukeCurse(f);
      f.tick(inputs[i], this.combatFrame, other);
    });
    for (const f of this.fighters)
      if (!this.temporal.isFrozen(f.id)) f.stand?.tick(f);
    this.stepSpecialReleases();
    for (const f of this.fighters)
      if (
        f.state === "attack" &&
        f.stateFrame === 0 &&
        (f.move?.kind === "ultimate" || f.move?.kind === "jetGigant" || f.move?.kind === "kirin")
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
      const shapes = f.attackShapes(beforeMovement[i]);
      const target = this.fighters[1 - i];
      if (!shapes.length || !f.canConnect || target.knockedDown || target.invulnerable ||
          (f.move?.level === "throw" &&
            (target.airborne || target.state === "hitstun" || target.state === "blockstun")))
        return null;
      const boxes = target.hurtboxes();
      const hurtboxes = f.move?.kind === "grab" ? boxes.slice(0, 2) : boxes;
      for (const shape of shapes) {
        const hurt = hurtboxes.find(box => shapeHitsRect(shape, box));
        if (!hurt) continue;
        let impact = f.move?.stand ? shapeBounds(shapes[0]) : undefined;
        if (f.data.id === "luffy" || f.move?.special === "chidori") {
          const bounds = shapeBounds(shape);
          const x = Math.max(hurt.x, bounds.x), y = Math.max(hurt.y, bounds.y);
          impact = {
            x, y,
            w: Math.min(hurt.x + hurt.w, bounds.x + bounds.w) - x,
            h: Math.min(hurt.y + hurt.h, bounds.y + bounds.h) - y,
          };
        }
        return {
          f, target, move: { ...f.move!, ...f.hitWindow },
          moveId: f.moveId, hitId: f.hitWindow?.id ?? 0, impact,
        };
      }
      return null;
    });
    for (const c of contacts) {
      if (!c) continue;
      const { f, target, move: m, moveId } = c;
      if (m.super && f.health <= 0) continue;
      if ((m.kind === "jetGigant" || m.kind === "kirin") && (f.state !== "attack" || f.moveId !== moveId)) continue;
      if (this.capture || this.cinematicActive) continue;
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
        m.kind !== "jetGigant" &&
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
      const direction = m.special === "nagashi" && target.x !== f.x
        ? Math.sign(target.x - f.x)
        : f.facing;
      this.resolveImpact(f, target, m, moveId, c.impact, direction);
    }
    if (this.cinematicActive) return;
    this.stepProjectiles();
    this.stepEnergy();
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
    curseFx = winged(f),
  ) {
    const frozen = this.temporal.isFrozen(target.id);
    const guarding =
      target.input.direction === -target.facing &&
      !target.airborne &&
      ["idle", "walk", "crouch", "landing", "blockstun"].includes(
        target.state,
      ) &&
      (!(["knives", "ki", "kamehameha"].includes(m.special ?? "") ||
        (m.special && isSasukeSpecial(m.special) && sasukeTechniques[m.special].shots)) ||
        direction === -target.facing);
    const blocked =
      guarding &&
      m.level !== "throw" &&
      !isSuperMove(m) &&
      (m.level !== "low" || target.input.down) &&
      (m.level !== "high" || !target.input.down);
    let damage = blocked
      ? 0
      : Math.round(
          m.damage *
            Math.max(
              combatPace.combo.minimumDamageScale,
              1 - target.combo * combatPace.combo.damageStep,
            ),
        );
    if (frozen && !blocked && !m.super) {
      damage = this.temporal.budget(damage);
      if (!damage) return;
    }
    const applied = this.damage(
      target,
      damage,
      ["ultimate", "roadRoller", "gokuFury", "jetGigant", "kirin"].includes(m.kind ?? "") && !blocked
        ? 1
        : 0,
    );
    const reaction: DeferredReaction = {
      blocked,
      stun: blocked ? m.blockstun : m.stun,
      vx:
        direction *
        m.push *
        (blocked
          ? 1
          : 1 +
            Math.max(0, target.combo - combatPace.combo.pushGrowthAfter) *
              combatPace.combo.pushGrowth),
      vy: blocked ? 0 : m.launch,
      knockdown: !blocked && !!m.knockdown,
      strength: m.damage <= 50 ? 1 : m.damage <= 90 ? 2 : 3,
      launch: m.launch <= -9,
      crouched:
        target.crouching ||
        (target.data.id === "luffy" && !target.airborne && !blocked && m.level === "low"),
    };
    if (!blocked) {
      if (f.state === "attack" && f.moveId === moveId) f.hitConfirmed = true;
      if (!target.combo) target.comboAge = target.comboAirHits = 0;
      target.combo++;
      if (target.airborne || m.launch < 0) target.comboAirHits++;
      if (target.airborne && !m.knockdown && !m.super)
        reaction.stun += combatPace.combo.airExtensionStun;
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
      if (m.kind !== "ultimate") f.gainMeter(m.meterGain ?? 10);
      target.gainMeter(5);
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
    const eventCount = this.events.length;
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
    const event = this.events[eventCount];
    if (event) {
      if (!blocked && (m.special === "chidori" || m.special === "goryuka"))
        event.sasuke = { kind: m.special, cursed: curseFx, facing: direction };
      if (f.data.id === "luffy" && !m.super && (m.rank > 1 || m.special)) {
        const style = m.special === "bazooka" ? "double"
          : m.special === "gatling" ? "rush"
          : /medium$|crouch_heavy|air_heavy/.test(moveId) && !m.special ? "kick" : "punch";
        event.luffy = { actor: f.id, move: moveId, direction, style };
      }
      event.strength =
        m.super ||
        m.kind === "ultimate" ||
        m.rank === 3 ||
        m.knockdown ||
        m.damage >= 90
          ? 3
          : m.rank === 2 || m.damage >= 55
            ? 2
            : 1;
      event.total = event.life =
        event.strength === 1 ? 10 : event.strength === 2 ? 13 : 16;
    }
    if (m.kind === "ultimate" && !blocked)
      this.beginCapture("ultimate", f, target);
    if (m.kind === "roadRoller" && !blocked) this.beginRoadRoller(f, target);
    if (!blocked && (m.kind === "gokuFury" || m.kind === "jetGigant" || m.kind === "kirin"))
      this.beginStagedSuper(f, target, m.kind);
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
      if (f.data.id === "goku") {
        this.spawnGokuSpecial(f);
        continue;
      }
      if (m.special && isSasukeSpecial(m.special)) {
        this.spawnSasukeSpecial(f, m, m.special);
        continue;
      }
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
  private spawnGokuSpecial(f: Fighter) {
    const m = f.move!;
    if (m.special === "ki" && m.projectile) {
      for (const tick of m.projectile.releases) {
        if (
          tick !== f.stateFrame ||
          this.kiProjectiles.filter(
            (p) => p.owner === f.id && p.state === "flight",
          ).length >= gokuBalance.projectiles.maximumPerOwner
        )
          continue;
        const point = beamOrigin(f);
        this.kiProjectiles.push({
          id: ++this.projectileSerial,
          owner: f.id,
          move: f.moveId,
          cast: f.gokuCastSerial,
          ...point,
          previousX: point.x,
          previousY: point.y,
          vx: m.projectile.speed * f.facing,
          vy: 0,
          facing: f.facing,
          radius: m.projectile.radius ?? 9,
          age: 0,
          life: m.projectile.life,
          state: "flight",
          impactAge: 0,
        });
      }
    }
    if (m.special === "kamehameha" && m.beam && f.stateFrame === m.startup) {
      const point = beamOrigin(f),
        maxLength = f.facing === 1 ? 1280 - point.x : point.x;
      this.beams.push({
        id: ++this.projectileSerial,
        owner: f.id,
        move: f.moveId,
        cast: f.gokuCastSerial,
        facing: f.facing,
        ...point,
        length: Math.max(0, Math.min(m.beam.range, maxLength)),
        radius: m.beam.radius,
        age: 0,
        life: m.active,
        state: "active",
        hitIds: [],
        impactAge: 0,
      });
    }
  }
  private spawnSasukeSpecial(f: Fighter, move: Move, id: SasukeSpecialId) {
    const age = f.stateFrame - move.startup;
    const origin = poseAt(move, f.stateFrame)?.release;
    if (!origin) return;
    const curse = winged(f);
    for (const shot of (curse ? curseSpecials : sasukeTechniques)[id].shots ?? []) {
      if (shot.at !== age) continue;
      const x = f.x + f.facing * origin.x, y = f.y + origin.y;
      const wave = id === "goryuka" ? fireDragonWave({ x, y }, f.facing, curse) : undefined;
      const fire = sasukePolish.goryuka;
      this.kiProjectiles.push({
        id: ++this.projectileSerial,
        owner: f.id,
        move: id,
        cast: 0,
        ...(curse ? { curse } : {}),
        ...(wave ? { wave } : {}),
        x, y, previousX: x, previousY: y,
        vx: (wave ? (curse ? fire.curse.speed : fire.base.speed) : shot.speed) * f.facing,
        vy: wave ? 0 : shot.rise,
        facing: f.facing,
        radius: wave ? fire.headRadius : shot.radius,
        age: 0,
        life: wave ? fire.maximumLife : shot.life,
        state: "flight",
        impactAge: 0,
      });
      const heat = kirinConfig.weather.contributions[id as keyof typeof kirinConfig.weather.contributions];
      if (shot.at === 0 && heat) {
        const level = this.sasukeStormUntil > this.combatFrame ? this.sasukeStormLevel : 0;
        this.sasukeStormLevel = Math.min(kirinConfig.weather.maximum, level + heat);
        this.sasukeStormUntil = this.combatFrame + sasukeSpecialBalance.stormTicks;
      }
    }
  }
  private stepFireDragon(p: KiProjectile) {
    const w = p.wave!;
    p.previousX = p.x;
    p.previousY = p.y;
    w.distance += Math.abs(p.vx);
    const point = fireDragonPoint(w, w.distance);
    p.x = point.x;
    p.y = point.y;
    p.age++;
    p.radius = Math.round(sasukePolish.goryuka.headRadius * Math.min(1, .48 + p.age * .095));
    if (--p.life <= 0 || w.distance > w.limit) return false;
    if (w.struck) return true;
    const target = this.fighters[1 - p.owner], owner = this.fighters[p.owner];
    if (target.invulnerable || target.knockedDown) return true;
    const boxes = target.hurtboxes();
    for (const shape of fireDragonVolumes(w, { x: p.previousX, y: p.previousY }, p.radius)) {
      const box = boxes.find(r => shapeHitsRect(shape, r));
      if (!box) continue;
      const move = p.curse ? sasukeCurseMoves[p.move] : owner.data.specialMoves?.[p.move];
      if (move) {
        w.struck = true;
        this.resolveImpact(owner, target, move, p.move, box, p.facing, !!p.curse);
      }
      break;
    }
    return true;
  }
  private stepEnergy() {
    if (!this.kiProjectiles.length && !this.beams.length) return;
    if (this.temporal.active && dioBalance.timeStop.freezeAllProjectiles)
      return;
    this.kiProjectiles = this.kiProjectiles.filter((p) => {
      if (p.wave) return this.stepFireDragon(p);
      if (p.state === "impact")
        return ++p.impactAge < gokuBalance.projectiles.impactTicks;
      p.previousX = p.x;
      p.previousY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      if (
        --p.life <= 0 ||
        p.x < -40 ||
        p.x > 1320 ||
        p.y < 0 ||
        p.y > FLOOR + 20
      )
        return false;
      const target = this.fighters[1 - p.owner],
        owner = this.fighters[p.owner],
        move = p.curse ? sasukeCurseMoves[p.move] : owner.data.specialMoves?.[p.move];
      if (!move || target.knockedDown || target.invulnerable) return true;
      const shape = {
        a: { x: p.previousX, y: p.previousY },
        b: { x: p.x, y: p.y },
        r: p.radius,
      };
      const hurt = target.hurtboxes().find((r) => shapeHitsRect(shape, r));
      if (hurt) {
        let impact = hurt;
        if (isSasukeSpecial(p.move)) {
          p.x = Math.max(hurt.x, Math.min(hurt.x + hurt.w, p.x));
          p.y = Math.max(hurt.y, Math.min(hurt.y + hurt.h, p.y));
          impact = { x: p.x, y: p.y, w: 0, h: 0 };
        } else if (owner.gokuCastSerial === p.cast && owner.moveId === p.move) {
          owner.connected = true;
        }
        this.resolveImpact(owner, target, move, p.move, impact, p.facing);
        p.state = "impact";
        p.impactAge = 0;
        p.vx = p.vy = 0;
      }
      return true;
    });
    this.beams = this.beams.filter((b) => {
      const owner = this.fighters[b.owner],
        target = this.fighters[1 - b.owner],
        move = owner.data.specialMoves?.[b.move];
      const valid =
        move?.beam &&
        owner.state === "attack" &&
        owner.moveId === b.move &&
        owner.gokuCastSerial === b.cast &&
        owner.attackPhase === "active";
      if (b.state === "active" && !valid) {
        b.state = "dissipate";
        b.age = 0;
        b.life = gokuBalance.projectiles.impactTicks;
      }
      if (b.state === "dissipate") {
        b.age++;
        return --b.life > 0;
      }
      const point = beamOrigin(owner);
      b.x = point.x;
      b.y = point.y;
      b.length = Math.max(
        0,
        Math.min(move!.beam!.range, b.facing === 1 ? 1280 - b.x : b.x),
      );
      const pulse = Math.floor(b.age / move!.beam!.interval);
      if (
        pulse < move!.beam!.hits &&
        !b.hitIds.includes(pulse) &&
        !target.invulnerable &&
        !target.knockedDown &&
        target.hurtboxes().some((r) => overlaps(beamBox(b), r))
      ) {
        b.hitIds.push(pulse);
        owner.connected = true;
        b.impactAge = b.age;
        this.resolveImpact(owner, target, move!, b.move, beamBox(b), b.facing);
      }
      b.age++;
      if (--b.life <= 0) {
        b.state = "dissipate";
        b.age = 0;
        b.life = gokuBalance.projectiles.impactTicks;
      }
      return true;
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
    const grab = kind === "grab" ? attacker.data.grabSequence : undefined;
    const contactX = grab?.startFromContact
      ? (victim.x - attacker.x) * attacker.facing
      : undefined;
    if (grab) {
      // The configurable universal throw keeps its owner anchored, including
      // at a wall. Only the captive follows the authored, bounded trajectory.
      if (contactX === undefined)
        victim.x = Math.max(40, Math.min(1240, attacker.x + attacker.facing * 72));
    } else {
      const center = Math.max(140, Math.min(1140, (attacker.x + victim.x) / 2));
      attacker.x = center - attacker.facing * 36;
      victim.x = center + attacker.facing * 36;
    }
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
      ...(contactX === undefined ? {} : { contactX }),
    };
    this.hitstop = Math.max(this.hitstop, kind === "ultimate" ? 12 : 5);
  }
  private beginStagedSuper(a: Fighter, b: Fighter, kind: "jetGigant" | "gokuFury" | "kirin") {
    const config = kind === "kirin" ? kirinConfig : kind === "jetGigant" ? jetConfig : furyConfig;
    const state: FuryState = {
      attacker: a.id,
      victim: b.id,
      tick: 0,
      facing: a.facing,
      originX: a.x,
      targetX: b.x,
      targetY: b.y,
      scale: Math.max(
        config.minimumComboScale,
        1 - Math.max(0, b.combo - 1) * 0.08,
      ),
    };
    if (kind === "jetGigant") this.jetGigant = { ...state, hold: 8, openingTip: jetOpener(a)!.tip };
    else if (kind === "kirin") this.kirin = {
      ...state, hold: 5, cursed: !!a.kirinCursed,
      storm: this.sasukeStormUntil > this.combatFrame ? this.sasukeStormLevel : 0,
    };
    else this.fury = state;
    a.setState("cinematic");
    b.setState("grabbed");
    a.vx = a.vy = b.vx = b.vy = 0;
    a.airChaseTicks = b.airChaseTicks = 0;
    a.buffer.clear();
    b.buffer.clear();
    this.hitstop = 0;
    // Preserve time-stop uses, remaining duration and cooldown; the cinematic
    // owns only the captive's deferred reaction until its controlled release.
    this.temporal.s.pending[b.id] = null;
    this.stageSuper();
  }
  private stageSuper() {
    const s = (this.kirin ?? this.jetGigant ?? this.fury)!,
      scene = this.kirin ? kirinScene(this.kirin) : this.jetGigant ? jetScene(this.jetGigant) : furyScene(s),
      a = this.fighters[s.attacker],
      b = this.fighters[s.victim];
    for (const [f, p] of [
      [a, scene.attacker],
      [b, scene.victim],
    ] as const) {
      f.x = p.x;
      f.y = p.y;
      f.facing = p.facing;
      f.actionClip = p.clip;
      f.stateFrame = p.tick;
    }
    // A Stand still belongs to the damaged principal. Its independent reaction
    // finishes and returns/dissipates without contributing collision volumes.
    b.stand?.tick(b);
  }
  private stepStagedSuper() {
    const jet = this.jetGigant, kirin = this.kirin;
    const held = kirin ?? jet;
    if (held && held.hold > 0) {
      held.hold--;
      return;
    }
    const config = kirin ? kirinConfig : jet ? jetConfig : furyConfig;
    const s = (kirin ?? jet ?? this.fury)!,
      t = ++s.tick,
      a = this.fighters[s.attacker],
      b = this.fighters[s.victim];
    this.stageSuper();
    if (kirin && (t === kirinConfig.phases.storm || t === kirinConfig.phases.reveal || t === kirinConfig.phases.dive))
      this.effect("kirinCharge", a.x, a.y - 130, 9);
    const hit = config.hits.find((h) => h.tick === t);
    if (hit) {
      const finish = hit.kind === "explosion" || hit.kind === "ground";
      if (held && "hold" in hit && typeof hit.hold === "number") held.hold = hit.hold;
      const applied = this.damage(b, Math.round(hit.damage * s.scale), finish ? 0 : 1);
      b.combo++;
      this.recordHit(a, b, `${kirin ? "kirin" : jet ? "jet" : "fury"}_${hit.kind}`, applied);
      b.gainMeter(2);
      this.effect(
        kirin ? "kirinThunder" : !jet && finish ? "roadExplosion" : jet && (finish || hit.kind === "gigant") ? "ultimate" : "hit",
        b.x,
        b.y - 78,
        finish ? 16 : 8,
      );
    }
    if (t >= config.duration) {
      a.y = b.y = FLOOR;
      a.vx = a.vy = b.vx = b.vy = 0;
      a.actionClip = b.actionClip = "";
      a.setState("idle");
      b.setState("hitstun");
      b.stun = 24;
      b.knockedDown = true;
      b.hitCrouched = b.hitLaunch = false;
      b.reactionStrength = 3;
      b.syncReactionClock(false);
      a.buffer.clear();
      b.buffer.clear();
      this.fury = this.jetGigant = this.kirin = undefined;
      if (kirin) this.sasukeStormUntil = this.sasukeStormLevel = 0;
      this.hitstop = 0;
      this.checkRoundEnd();
    }
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
      b.gainMeter(2);
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
        b.gainMeter(3);
        this.effect("ultimate", b.x, b.y - 75, 12);
        this.hitstop = finish ? 15 : 3;
      }
      if (sequence.tick >= cinematics.ultimate.duration)
        this.endCapture(sequence, a, b);
    } else {
      a.actionClip = "grabHold";
      b.actionClip = "grabbed";
      const grab = a.data.grabSequence ?? cinematics.grab;
      const track = a.data.grabSequence?.victimTrack;
      if (track?.length) {
        let i = 0;
        while (i + 1 < track.length && track[i + 1].tick <= tick) i++;
        const p = track[i],
          q = track[Math.min(i + 1, track.length - 1)],
          t =
            q.tick === p.tick
              ? 0
              : Math.min(1, (tick - p.tick) / (q.tick - p.tick));
        const fromX = i === 0 ? (sequence.contactX ?? p.x) : p.x;
        b.x = Math.max(
          40,
          Math.min(1240, a.x + a.facing * Math.round(fromX + (q.x - fromX) * t)),
        );
        b.y = FLOOR + Math.round(p.y + (q.y - p.y) * t);
        b.actionClip = p.clip;
        let start = i;
        while (start > 0 && track[start - 1].clip === p.clip) start--;
        b.stateFrame = tick - track[start].tick;
      }
      if (tick === grab.hitTick) {
        const applied = this.damage(b, grab.damage);
        b.combo++;
        this.recordHit(a, b, "throw", applied);
        this.effect("hit", b.x, b.y - 75, 12);
        this.hitstop = 8;
        a.gainMeter(10);
        b.gainMeter(5);
      }
      if (sequence.tick >= grab.duration) this.endCapture(sequence, a, b);
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
    const release =
      sequence.kind === "grab" ? a.data.grabSequence?.release : undefined;
    b.stun = release?.stun ?? 35;
    b.vx = a.facing * (release?.vx ?? 8);
    b.vy = release?.vy ?? (sequence.kind === "ultimate" ? 12 : -6);
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
      this.kiProjectiles = [];
      this.beams = [];
      this.sasukeStormUntil = 0;
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
        f.sasukeCurse = undefined;
        f.setState(winner < 0 ? "idle" : i === winner ? "victory" : "ko");
      });
      this.phase = "roundEnd";
      this.phaseFrames = 150;
    }
  }
}
