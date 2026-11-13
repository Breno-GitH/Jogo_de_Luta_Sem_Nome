import type { KaguneId } from "./kagune";
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
import { antiLightCombo, isLimitedLightNormal } from "./anti-light-combo";
import cinematics from "../data/cinematics.json";
import { reactionBoxes, reactionFor } from "./lifecycle";
import { isSuperMove, poseAt, phaseAt } from "./moves";
import { alienXConfig, alienXId, alienXScene, canStartAlienX, type AlienXState } from "./ben-alien-x";
import { luffyAttackLimbs, luffySpecialCommand } from "./luffy-specials";
import { xebecId, xebecSpecials } from "./xebec";
import { isXebecSpecial, xebecCharged, xebecProjectile, xebecRiposte, xebecSpecialCommand } from "./xebec-specials";
import { canStartPandemonium, pandemoniumConfig, pandemoniumId, pandemoniumScene, type PandemoniumState } from "./xebec-pandemonium";
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
import {
  canKaguneCapture, captureWindow, captureWindup, kaguneChoice, kaguneRoutes,
  kaguneVictimPosition, kanekiOffensiveKagunes, kanekiSpecialShapes, type KanekiCapture,
} from "./kaneki-combat";
import { benId, cancelOmnitrix, newOmnitrix, omnitrixCanBrowse, tickOmnitrix, type BenAlien, type OmnitrixState } from "./ben-omnitrix";
import { benForms, benGrabFor, nrgReleasedForm, type BenForm } from "./ben-forms";
import { benManeuverTarget, driveBenManeuver, flyNrg } from "./ben-rework";
import { feedbackConductorContact } from "./feedback-conductor";
import { clearStage7, drivePlanetoid, gravityAt, hitEchoClones, planetoid, gravityStoneLaunch, spawnGravityStones, tickEchoClones, tickGravityStone } from "./ben-stage7";
import { feedbackCablePaths, benFormBalance, benObjectMove, benObjectShape, benSpecialCommand,
  benProjectile, benStage6Balance, spectralPaths,
  type BenEffect, type BenField, type BenObject } from "./ben-moves";
import { canStartCentipede, centipedeConfig, centipedeContact, centipedeConversion, centipedeId, centipedePhaseCue, centipedeScene, type CentipedeCue, type CentipedeSource, type CentipedeState } from "./kaneki-centipede";
import { kanekiSpecialCommand, kanekiSpecialScene, kanekiTechnique, swordProfile } from "./kaneki-specials";
import {
  canResistChain, chainBoundX, chainBufferTicks, chainEscapeTicks, chainFinisher, chainFinishes,
  chainPick, chainPose, chainWindup, chainWindow, directChain, kaguneGrabLimit,
  resistanceButton, resistanceGoal, resistanceInterval,
  type Chain, type ChainRoute,
} from "./kaneki-chain";
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
  type Button,
  type InputFrame,
  type Move,
  type Rect,
  type State,
  type AttackShape,
} from "./types";
export const character: CharacterData = pacedCharacter(samurai);
export const FLOOR = 580;
type BenWall = { owner: number; object: BenObject; field: BenField };
function scaledBenBox(box: Rect, scale: number): Rect {
  return scale === 1 ? box : { x: box.x * scale, y: box.y * scale, w: box.w * scale, h: box.h * scale };
}

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
  kanekiCaptured?: boolean;
  kanekiThrowLink?: boolean;
  kanekiLimb?: KaguneId;
  kanekiBurrowX?: number;
  kanekiSpecialRecovery?: number;
  hitConfirmed = false;
  reverseBeatUsed = false;
  hitIds: number[] = [];
  comboAge = 0;
  comboAirHits = 0;
  combo = 0;
  lightHitsInCombo = 0;
  knockedDown = false;
  dashDirection = 1;
  jumpDirection = 0;
  airChaseTicks = 0;
  chill?: { build: number; ticks: number; freeze: number; immune: number; used: boolean };
  gokuTeleportLock = 0;
  gokuAirTeleportUsed = false;
  gokuAirTeleportsUsed = 0;
  gokuCastSerial = 0;
  sasukeCurse?: SasukeCurseState;
  omnitrix?: OmnitrixState;
  domination?: { charge: number; powered: boolean; awarded: boolean; spentFrame?: number };
  kirinCursed?: boolean;
  xebec?: {
    domination: number;
    credited: string[];
    comboGain: number;
    empowered: boolean;
  };
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
    if (data.id === benId) this.omnitrix = newOmnitrix();
    if (data.id === xebecId) this.domination = { charge: 0, powered: false, awarded: false };
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
  get benForm() {
    const active = this.omnitrix?.active;
    if (active === "nrg" && this.omnitrix?.nrgReleased) return nrgReleasedForm;
    return active && active !== "human" ? benForms[active] : undefined;
  }
  get benScale() {
    const growth = this.omnitrix?.active === "humungousaur" && this.omnitrix.growth;
    return growth ? benFormBalance.growth[growth.rank].scale : 1;
  }
  get movementData() { return this.benForm?.movement ?? this.data; }
  private get normalMoves() { return this.benForm?.moves ?? this.data.moves; }
  get grabSequence() { return this.benForm?.grab ?? this.data.grabSequence; }
  get stageInset() { return Math.max(40, (this.benForm?.width ?? 52) * this.benScale / 2); }
  get airborne() {
    return this.y < FLOOR || this.vy < 0;
  }
  get move(): Move | undefined {
    return (this.domination?.powered ? xebecSpecials.powered[this.moveId] : undefined) ??
      this.lookupMove(this.moveId);
  }
  private lookupMove(id: string) {
    if (id === kirinId && (this.moveId === id ? this.kirinCursed : winged(this)))
      return kirinCurseOpener;
    return curseMove(this, id) ?? this.normalMoves[id] ??
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
      (!["luffy", "sasuke", "kaneki", xebecId].includes(this.data.id) || this.hitConfirmed) &&
      this.canCancel("special")
    );
  }
  canStartSpecial(id: string) {
    if (this.data.id === "goku") return canStartGokuSpecial(this, id);
    const move = (winged(this) ? sasukeCurseMoves[id] : undefined) ?? this.data.specialMoves?.[id];
    if (
      !move ||
      (id === "xebecFissure" && this.match?.kiProjectiles.some(
        p => p.owner === this.id && p.move === id && p.state === "flight",
      )) ||
      this.airborne ||
      !(
        ["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
          this.state,
        ) || this.canSpecialCancel() ||
        (id === "xebecFissure" && this.state === "attack" && this.moveId === xebecCounterReply &&
          this.hitConfirmed && this.stateFrame < 17)
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
    if (this.moveId === xebecRiposte && this.state === "attack" && id !== "xebecRift") return false;
    if (id === "xebecRift" && this.match?.kiProjectiles.some(
      p => p.owner === this.id && p.state === "flight",
    )) return false;
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
    if (this.moveId === "xebecBreaker")
      return this.hitConfirmed && this.hitIds.includes(1) && this.canCancel("jump");
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
    if (this.domination) return canStartPandemonium(this);
    if (this.omnitrix) return canStartAlienX(this);
    if (this.data.id === "kaneki") return canStartCentipede(this);
    if (this.xebec)
      return this.meter >= pandemonium.cost && !this.airborne && !this.match?.capture &&
        (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(this.state) ||
          (this.hitConfirmed && this.canSuperCancel()));
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
    if (planetoid(this)) return [worldRect({ x: -50, y: -118, w: 105, h: 116 }, this.x, this.y, this.facing)];
    const lift = this.stand?.s.ownerLiftFrame ?? -1;
    const pose =
      this.state === "attack" && this.move
        ? poseAt(this.move, this.stateFrame)
        : undefined;
    const neutral = this.benForm?.hurtboxes ?? this.data.hurtboxes;
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
    const world = boxes.map(box => worldRect(scaledBenBox(box, this.benScale), this.x, this.y, this.facing));
    if (this.data.id === "kaneki" && this.state === "attack") {
      for (const limb of kanekiOffensiveKagunes(this, FLOOR)) {
        for (let i = 12; i < limb.spine.length; i += 4) {
          const a = limb.spine[i - 4], b = limb.spine[i];
          if ((b.x - this.x) * this.facing < 37 || (limb.floorClip !== undefined && Math.max(a.y, b.y) >= FLOOR)) continue;
          world.push(shapeBounds({ a, b, r: limb.radius[i - 2] + 1 }));
        }
      }
    }
    return world;
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
  get benPhase() {
    const phase = this.state === "attack" ? this.move?.ben?.phase : undefined;
    return phase && this.stateFrame >= phase.from && this.stateFrame < phase.to ? phase : undefined;
  }
  get invulnerable() {
    return (
      gokuInvisible(this) ||
      this.state === "getup" ||
      Boolean(this.benPhase && !this.benPhase.physicalOnly) ||
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
    if (this.benForm && !this.hitConfirmed) return false;
    if (name === "jump" && this.moveId === "xebecBreaker" && !this.hitIds.includes(2)) return false;
    if (this.sasukeCurse?.phase === "ending") return false;
    const window = this.move?.cancelWindow;
    const reverse =
      name === "light" && !this.benForm &&
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
  pushbox(form = this.benForm, x = this.x, scale = this.benScale): Rect {
    const w = (form?.width ?? 52) * scale, h = (form?.pushHeight ?? 90) * scale;
    return { x: x - w / 2, y: this.y - h, w, h };
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
    if (m.ben?.leap && (this.airborne || !this.omnitrix?.landingStrike)) return [];
    const pose = poseAt(m, this.stateFrame);
    if (this.data.id === "kaneki") {
      if (m.kind === centipedeId) return centipedeContact(this);
      const special = kanekiSpecialShapes(this, FLOOR);
      if (special) return special;
      const limbs = kanekiOffensiveKagunes(this, FLOOR);
      if (limbs.length) return limbs.map(limb => ({
        a: limb.spine[limb.spine.length - 5], b: limb.tip,
        r: this.moveId === "throw" ? 16 : 13,
      }));
    }
    if (m.hitWindows && !this.hitWindow) return [];
    if (this.domination && m.hitWindows && this.hitWindow?.id === 1 && !this.hitConfirmed) return [];
    if (m.ben?.spectralReach) return spectralPaths(m, this.stateFrame).flatMap(path =>
      path.slice(2, -1).map((a, i) => worldCapsule({ a, b: path[i + 3], r: 12 }, this.x, this.y, this.facing)),
    );
    if (m.ben && (m.ben.field || !m.box.w && !m.ben.cable || (m.ben.confirmHits && this.hitWindow?.id && !this.hitConfirmed))) return [];
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
    if (m.ben?.technique === "conductor") return feedbackConductorContact(m, this.stateFrame)
      .map(shape => worldCapsule(shape, this.x, this.y, this.facing));
    if (m.ben?.cable) return feedbackCablePaths(m.ben.cable, this.stateFrame, m).flatMap(points =>
      points.slice(-4, -1).map((a, i) => worldCapsule(
        { a, b: points[points.length - 3 + i], r: 12 }, this.x, this.y, this.facing,
      )),
    );
    if (m.kind === "grab") {
      if (this.data.id === "luffy") {
        const grip = luffyGrabLimb(this);
        return grip?.hitboxes.map(shape => worldCapsule(shape, this.x, this.y, this.facing)) ?? [];
      }
      return [worldRect(scaledBenBox(m.box, this.benScale), this.x, this.y, this.facing)];
    }
    if (m.kind === pandemoniumId && this.domination && this.stateFrame >= m.startup) {
      return [worldCapsule({ a: { x: 29, y: -126 }, b: { x: 119, y: -118 }, r: 24 }, this.x, this.y, this.facing)];
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
          : [worldRect(scaledBenBox(m.box, this.benScale), this.x, this.y, this.facing)];
    if (m.ben?.effect === "tail") {
      const { x, y, w, h } = scaledBenBox(m.box, this.benScale);
      const radius = Math.min(14, h / 3);
      return [worldCapsule({ a: { x: x + radius, y: y + radius },
        b: { x: x + w - radius, y: y + h - radius }, r: radius }, this.x, this.y, this.facing)];
    }
    if ((m.ben || this.domination) && m.drive && previousX !== this.x) {
      return body.map(shape => {
        const rect = shapeBounds(shape);
        const delta = previousX - this.x;
        return { ...rect, x: rect.x + Math.min(0, delta), w: rect.w + Math.abs(delta) };
      });
    }
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
    if (this.benForm && this.omnitrix) {
      if (s !== "attack") {
        delete this.omnitrix.maneuverX;
        delete this.omnitrix.landingStrike;
      }
      if (s === "crouch") this.omnitrix.crouchExit = 0;
      else if (this.state === "crouch" && (s === "idle" || s === "walk")) this.omnitrix.crouchExit = 5;
    }
    this.state = s;
    if (this.omnitrix && !omnitrixCanBrowse(s)) cancelOmnitrix(this.omnitrix);
    this.stand?.react(this);
    this.stateFrame = 0;
    this.reactionPhase = "";
    this.reactionFrame = 0;
    if (s !== "attack") {
      this.kanekiThrowLink = undefined;
      this.kanekiLimb = undefined;
      this.kanekiBurrowX = undefined;
      if (s !== "throwRecover") this.kanekiSpecialRecovery = undefined;
      this.moveId = "";
      if (this.domination) this.domination.powered = false;
      this.kirinCursed = undefined;
      if (this.xebec) this.xebec.empowered = false;
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
    if (!m || this.meter < (m.cost ?? 0) || this.omnitrix?.transition) return false;
    const watch = this.omnitrix;
    const ben = m.ben;
    if (ben?.grow && watch?.growthCooldown) return false;
    if (ben?.nrgMode === "release" && watch?.nrgCooldown) return false;
    if (ben?.echoSplit && (watch?.echoCooldown || (watch?.echoClones?.length ?? 0) >= 2)) return false;
    if (ben?.technique === "ghostPhase" && watch?.ghostCooldown) return false;
    if (ben?.airUse === "flight" && watch?.flightUsed || ben?.airUse === "dive" && watch?.diveUsed) return false;
    if (m.ben?.technique && this.omnitrix) {
      if (this.opponent?.combo && this.omnitrix.usedSpecials.includes(m.ben.technique)) return false;
      if (m.ben.field && this.omnitrix.objects.some(object => benObjectMove(object.id)?.ben?.field?.type === m.ben?.field?.type)) return false;
      if (this.opponent?.combo) this.omnitrix.usedSpecials.push(m.ben.technique);
    }
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
    const pandemoniumLink = m.kind === pandemoniumId && this.moveId === "xebecBreaker" &&
      this.canSuperCancel() && this.opponent?.state === "hitstun";
    const superLink =
      m.kind === "gokuFury" &&
      combatPace.cancel.gokuSuperLink &&
      this.canSuperCancel() &&
      this.hitConfirmed &&
      this.opponent?.state === "hitstun";
    this.meter -= m.cost ?? 0;
    const kaneki = this.data.id === "kaneki";
    const technique = kaneki ? kanekiTechnique(id) : undefined;
    const captureLink = kaneki && (id === "throw" || !!technique) &&
      this.state === "attack" && this.hitConfirmed;
    this.setState("attack", chain);
    this.kanekiThrowLink = captureLink || undefined;
    this.kanekiLimb = technique?.family === "fourSwords" ? "lowerRear"
      : technique?.family === "rinkakuRush" ? "upperFront"
      : kaneki && (id === "throw" || technique?.family === "kaguneGrab")
        ? (this.input.down ? "lowerRear" : "lowerFront")
        : kaneki && id === "air_heavy" ? (this.vy > 0 ? "upperFront" : "upperRear") : undefined;
    if (technique?.family === "fourSwords") {
      const gap = ((this.opponent?.x ?? this.x + this.facing * technique.reach) - this.x) * this.facing;
      this.kanekiBurrowX = Math.max(8, Math.min(1272, this.x + this.facing *
        Math.max(42, Math.min(technique.reach, gap - 7))));
    } else this.kanekiBurrowX = undefined;
    this.moveId = id;
    if (this.domination) {
      const resource = this.domination;
      resource.powered = id === xebecRiposte ? resource.powered : xebecCharged(id) && resource.charge === 100;
      resource.awarded = false;
      if (resource.powered && id !== xebecRiposte) {
        resource.charge = 0;
        resource.spentFrame = this.match?.frame;
      }
    }
    if (watch) {
      if ((ben?.burrow || ben?.leap) && this.opponent) watch.maneuverX = benManeuverTarget(this, this.opponent, m);
      delete watch.landingStrike;
      if (ben?.nightmare) watch.ghostCooldown = (id.endsWith("_medium") ? 133 : 86) + m.startup + m.active + m.recovery;
      if (ben?.airUse === "flight") watch.flightUsed = true;
      if (ben?.airUse === "dive") watch.diveUsed = true;
    }
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
    if (pandemoniumLink && this.opponent) {
      // Catch the launched opponent only while the opening blade can reach them.
      this.opponent.vy = Math.max(this.opponent.vy, -8);
    }
    if (superLink && this.opponent) {
      this.opponent.stun = Math.max(this.opponent.stun, m.startup + 4);
      this.opponent.vx = 0;
    }
    return true;
  }
  private bufferedBenSpecial(button: Button) {
    const watch = this.omnitrix;
    if (!watch || !this.benForm) return;
    const id = benSpecialCommand(watch.nrgReleased ? "nrgReleased" : watch.active, this.buffer, button);
    if (id && (!this.airborne || this.lookupMove(id)?.ben?.air)) return id;
  }

  tick(input: InputFrame, frame: number, opponent: Fighter) {
    const chill = this.chill;
    if (chill) {
      if (chill.immune > 0) chill.immune--;
      if (chill.freeze > 0) chill.freeze--;
      if (chill.ticks > 0) chill.ticks--;
      else chill.build = Math.max(0, chill.build - 2);
      if (!this.combo) chill.used = false;
      if (!chill.build && !chill.immune && !chill.used) this.chill = undefined;
    }
    if (this.omnitrix) {
      const combatButton = (button: Button) => button !== "heavy" &&
        (!this.omnitrix!.transition || !["light", "medium", "throw"].includes(button));
      this.buffer.actions = this.buffer.actions.filter(action => combatButton(action.button));
      input = { ...input, pressed: input.pressed.filter(combatButton) };
    }
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
    if (this.xebec && !opponent.combo) {
      this.xebec.credited.length = 0;
      this.xebec.comboGain = 0;
    }
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
      throwRecover: this.kanekiSpecialRecovery ?? this.grabSequence?.recoveryTicks ?? 12,
    };
    const lock = locks[this.state];
    if (lock !== undefined) {
      this.vx = 0;
      if (this.state === "throwRecover" && this.kanekiSpecialRecovery !== undefined && this.airborne) {
        this.vy += this.movementData.gravity;
        this.y = Math.min(FLOOR, this.y + this.vy);
        if (this.y === FLOOR) this.vy = 0;
      }
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
          this.comboAge = this.comboAirHits = this.lightHitsInCombo = 0;
          this.knockedDown = false;
        }
      }
    } else {
      if (
        this.state === "attack" &&
        this.move &&
        this.stateFrame >=
          this.move.startup + this.move.active + this.move.recovery +
            (this.hitConfirmed ? 0 : this.move.xebec?.whiffExtra ?? 0)
      )
        this.setState(this.airborne ? "air" : "idle");
      if (
        this.state === "jumpStart" &&
        this.stateFrame >=
          (this.movementData.locomotion?.jumpStartup ?? MOVEMENT_TIMING.jumpStartup)
      ) {
        this.vy = this.movementData.jump;
        this.vx =
          this.jumpDirection *
          (this.movementData.locomotion?.airSpeed ?? this.movementData.speed) * sasukeCurseMovement(this);
        this.setState("air");
      }
      if (
        this.state === "landing" &&
        this.stateFrame >=
          (this.movementData.locomotion?.landingTicks ?? MOVEMENT_TIMING.landing)
      )
        this.setState("idle");
      if (
        this.state === "dash" &&
        this.stateFrame >=
          (this.movementData.locomotion?.dashForward.length ?? MOVEMENT_TIMING.dash)
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
              : this.omnitrix ? alienXId : this.data.id === "luffy" ? jetId : this.data.id === "sasuke" ? kirinId : this.data.id === "kaneki" ? centipedeId : this.domination ? pandemoniumId : "ultimate_start";
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
      if (this.benForm) {
        for (const button of ["medium", "light"] as const) {
          const id = this.bufferedBenSpecial(button);
          if (!id) continue;
          if ((free || canCancel("special") && (!this.move?.cancelMoves || this.move.cancelMoves.includes(id))) && this.attack(id)) {
            this.buffer.consumeSpecial(button);
            return;
          }
          if (free) this.buffer.consumeSpecial(button);
        }
      }
      if (this.data.id === "kaneki") {
        for (const button of ["heavy", "medium", "light"] as const) {
          const technique = kanekiSpecialCommand(this.buffer, button);
          if (!technique) continue;
          if (this.attack(technique.id)) {
            this.buffer.consumeSpecial(button);
            return;
          }
          if (free) this.buffer.consumeSpecial(button);
        }
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
      if (this.data.id === xebecId) {
        for (const button of ["heavy", "medium", "light"] as const) {
          const id = xebecSpecialCommand(this.buffer, button);
          if (!id) continue;
          if (this.attack(id)) {
            this.buffer.consumeSpecial(button);
            return;
          }
          if (free || this.move?.special) this.buffer.consumeSpecial(button);
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
            this.movementData.jump,
            Math.max(
              -combatPace.cancel.maximumChaseJumpSpeed,
              opponent.vy +
                (opponent.y - this.y) / combatPace.cancel.chaseCatchTicks,
            ),
          );
          this.airChaseTicks = this.move?.ben?.cable === "upper" || this.moveId === "frostBreath_medium" ? 15 : this.data.airChaseTicks ?? 8;
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
          if (this.bufferedBenSpecial(b)) continue;
          if (this.data.id === "kaneki" && kanekiSpecialCommand(this.buffer, b)) continue;
          if (this.data.id === "sasuke" && sasukeSpecialCommand(this.buffer, b)) continue;
          if (this.data.id === xebecId && b !== "throw" && xebecSpecialCommand(this.buffer, b)) continue;
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
          if (b === "throw" && (this.airborne ||
            (this.data.id === "kaneki" && this.state === "attack" && !this.hitConfirmed))) continue;
          const candidate = special
            ? `${special}_${b}`
            : b === "throw"
              ? "throw"
              : `${this.airborne ? "air" : input.down ? "crouch" : "stand"}_${b}`;
          const candidateMove = this.normalMoves[candidate];
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
          if (this.airborne && this.movementData.locomotion) {
            if (input.direction)
              this.vx = input.direction * this.movementData.locomotion.airSpeed * sasukeCurseMovement(this);
          } else
            this.vx =
              input.down && !this.airborne
                ? 0
                : input.direction *
                  (input.direction === this.facing
                    ? this.movementData.speed
                    : (this.movementData.locomotion?.backSpeed ?? this.movementData.speed)) * sasukeCurseMovement(this);
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
        const profile = this.movementData.locomotion;
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
            (!this.connected || this.hitConfirmed && move.ben?.follow) &&
            this.stateFrame >= move.drive.from &&
            this.stateFrame < move.drive.to
              ? this.facing * (this.connected && move.ben?.follow ? move.ben.follow : move.drive.speed)
              : 0;
        if (move.hopAt === this.stateFrame)
          this.vy = move.hopVelocity ?? 0;
        drivePlanetoid(this);
        const age = this.stateFrame;
        if (move.ben?.aerialMotion === "dive") {
          if (age === 3 && !this.airborne) this.vy = -8;
          if (age === move.startup) this.vy = 6;
        } else if (move.ben?.aerialMotion === "glide" && age >= move.startup && age < move.startup + move.active) {
          if (age === move.startup) this.vy = this.y > FLOOR - 160 ? -5 : 0;
          if (this.y < FLOOR - 192) this.vy = Math.max(0, this.vy);
          this.vy = Math.min(1.4, this.vy);
          if (!move.drive) this.vx = input.direction * 5.2;
        }
        if (move.ben?.leap || move.ben?.burrow) driveBenManeuver(this, opponent, move);
      }
    }
    // A launcher jump cancel carries the swordsman forward briefly. This
    // closes the space opened by launch knockback without inflating the blade.
    if (this.airChaseTicks > 0) {
      if (this.airborne && (this.state === "air" || this.state === "attack")) {
        const speed = (this.data.airChaseSpeed ?? this.movementData.speed) * sasukeCurseMovement(this);
        const gap =
          (opponent.x - this.x) * this.facing - combatPace.cancel.chaseSpacing;
        this.vx = this.facing * Math.max(-speed, Math.min(speed, gap));
        if (--this.airChaseTicks === 0) {
          this.vx = 0;
          // A missed pursuit must not retain the boosted launch velocity and
          // carry the fighter offscreen; confirmed air hits use their own hold.
          if (this.vy < this.movementData.jump)
            this.vy = -combatPace.cancel.chaseExitUpSpeed;
        }
      } else this.airChaseTicks = 0;
    }
    tickGokuMove(this);
    flyNrg(this, input);
    if (this.benScale > 1 && this.state === "walk") this.vx *= 1 / Math.sqrt(this.benScale);
    const wasAirborne = this.airborne;
    if (
      wasAirborne &&
      !(
        this.state === "attack" &&
        this.move?.airTeleport &&
        this.stateFrame < this.move.startup + this.move.active
      )
    ) {
      this.vy += this.movementData.gravity;
    }
    if (this.chill?.freeze) this.vx = 0;
    this.x = Math.max(this.stageInset, Math.min(1280 - this.stageInset, this.x + this.vx));
    this.y += this.vy;
    if (this.y >= FLOOR) {
      this.y = FLOOR;
      this.vy = 0;
      if (wasAirborne && this.state === "attack" && this.move?.ben?.leap) {
        this.stateFrame = this.move.startup;
        this.omnitrix!.landingStrike = true;
        this.vx = 0;
      }
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
          (this.state === "attack" && (this.moveId.startsWith("air_") || this.move?.ben?.land)))
      ) {
        const armor = this.omnitrix?.active === "nrg" && !this.omnitrix.nrgReleased;
        const drop = armor && this.state === "attack" && this.moveId === "air_medium";
        this.setState("landing");
        if (armor) this.actionClip = drop ? "nrgDropLanding" : "";
      }
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
  xebec?: { rank: number; facing: number; move: string; empowered: boolean };
  sasuke?: { kind: "chidori" | "goryuka"; cursed: boolean; facing: number };
  luffy?: { actor: number; move: string; direction: number; style: "kick" | "punch" | "rush" | "double" };
  strength?: number;
  audioOnly?: boolean;
  knuckleFrame?: number;
  centipede?: { cue: CentipedeCue; frame: number };
  chain?: ChainRoute;
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
    | "kirinThunder"
    | "knuckleSnap"
    | "chainBind"
    | "chainEscape"
    | "chainWhoosh"
    | "chainImpact"
    | "centipede";
  total?: number;
  ben?: BenEffect;
}
export interface CaptureSequence {
  kind: "ultimate" | "grab";
  attacker: number;
  victim: number;
  tick: number;
  scale: number;
  contactX?: number;
  contactY?: number;
  ben?: { moveId: string; origin: number; direction: number; contactFrame?: number };
  kaneki?: KanekiCapture;
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
  centipede?: CentipedeState;
  alienX?: AlienXState;
  pandemonium?: PandemoniumState;
  get cinematicActive() { return !!(this.roadRoller || this.fury || this.jetGigant || this.kirin || this.centipede || this.alienX || this.pandemonium); }
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
    this.fighters.forEach((fighter, seat) => {
      const watch = fighter.omnitrix;
      if (!watch) return;
      if (this.cinematicActive || this.capture || this.temporal.isFrozen(seat) ||
          fighter.knockedDown || !omnitrixCanBrowse(fighter.state)) {
        cancelOmnitrix(watch);
        return;
      }
      const rival = this.fighters[1 - seat];
      if (!rival.combo) {
        watch.usedSpecials.length = 0;
        watch.comboSwap = false;
      }
      const inAttack = fighter.state === "attack";
      const canConfirm = !this.hitstop && (!rival.combo || !watch.comboSwap || !!watch.transition) &&
        (!inAttack || !!watch.transition || fighter.canCancel("omnitrix"));
      tickOmnitrix(watch, inputs[seat], canConfirm, to => {
        if (!this.placeBenForm(fighter, rival, to)) return false;
        if (rival.combo) watch.comboSwap = true;
        fighter.buffer.clear();
        return true;
      });
    });
    if (this.fury || this.jetGigant || this.kirin || this.centipede || this.alienX || this.pandemonium) {
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
    const chainCapture = this.capture;
    const longGrab = chainCapture?.kaneki?.chain;
    if (chainCapture && longGrab?.origin === "kaguneGrab" && this.frame - longGrab.started >= kaguneGrabLimit) {
      const a = this.fighters[chainCapture.attacker], b = this.fighters[chainCapture.victim];
      if (!longGrab.landed && b.combo < a.data.combatLimits!.maxHits) {
        this.kanekiChainDamage(chainCapture, a, b, "kaguneTimeout", 48, b.airborne, true);
        this.effect("hit", b.x, b.y - 68, 12);
      }
      this.hitstop = 0;
      this.releaseKanekiChain(a, b, 15, 7, -3);
      this.finishTemporalStep(timeWasActive);
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop--;
      const capture = this.capture;
      const held = capture?.kaneki;
      if (capture && held?.chain) {
        this.bufferChainChoice(held, capture.tick, inputs[capture.attacker], inputs[capture.victim]);
        if ((held.chain.resistance ?? 0) >= resistanceGoal)
          this.escapeKanekiChain(this.fighters[capture.attacker], this.fighters[capture.victim]);
      } else if (capture && held && !held.route && !held.specialId) {
        held.pending ??= kaguneChoice(inputs[capture.attacker].pressed);
      }
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
      this.stepCapture(inputs);
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
      const well = f.airborne && !["hitstun", "blockstun", "ko", "getup"].includes(f.state) && !this.temporal.isFrozen(other.id)
        ? gravityAt(other, f.x, f.y, FLOOR) : undefined;
      if (well && !this.benWalls().some(w => this.benWallBetween(w, well.x, f.x,
        { x: Math.min(well.x, f.x), y: f.y - 60, w: Math.abs(well.x - f.x), h: 62 })))
        f.vy = Math.min(14, f.vy + .72);
      f.guardIntent =
        inputs[i].direction === -f.facing &&
        !f.airborne &&
        Math.abs(f.x - other.x) < 200;
      tickSasukeCurse(f);
      const fallingDrop = f.y < FLOOR && f.state === "attack" && !!(f.move?.ben?.landingImpact || f.move?.ben?.leap);
      f.tick(inputs[i], this.combatFrame, other);
      this.tickBenAbilities(f, other, fallingDrop);
      if (!f.combo) f.kanekiCaptured = undefined;
    });
    for (const f of this.fighters)
      if (!this.temporal.isFrozen(f.id)) f.stand?.tick(f);
    this.stepSpecialReleases(false);
    for (const f of this.fighters)
      if (
        f.state === "attack" &&
        f.stateFrame === 0 &&
        (f.move?.kind === "ultimate" || f.move?.kind === "jetGigant" || f.move?.kind === "kirin" || f.move?.kind === alienXId)
      )
        this.effect("power", f.x, f.y - 80, 20);
      else if (f.state === "attack" && f.stateFrame === 0 && f.moveId === centipedeId)
        this.centipedeEffect("activation", f.x, f.y - 74, 21);
    const [a, b] = this.fighters;
    const crystalWalls = this.benWalls();
    for (const f of this.fighters) {
      if (this.temporal.isFrozen(f.id)) continue;
      this.stopAtBenWalls(f, beforeMovement[f.id], crystalWalls);
      if (f.move?.kind !== "grab") {
        const shapes = f.attackShapes(beforeMovement[f.id]);
        if (shapes.length) this.damageBenWalls(shapes, f.move?.damage ?? 0, crystalWalls,
          `${f.id}:${this.combatFrame - f.stateFrame}:${f.hitWindow?.id ?? 0}`, f.id);
      }
    }
    for (const f of this.fighters) {
      const target = this.fighters[1 - f.id];
      if (!f.xebec || !f.move?.drive || f.state !== "attack" || this.temporal.isFrozen(f.id)) continue;
      const side = Math.sign(beforeMovement[target.id] - beforeMovement[f.id]);
      if (side && side * (target.x - f.x) <= 0) {
        const gap = (f.pushbox().w + target.pushbox().w) / 2;
        f.x = Math.max(f.stageInset, Math.min(1280 - f.stageInset, target.x - side * gap));
        f.vx = 0;
        this.stopAtBenWalls(f, beforeMovement[f.id], crystalWalls);
      }
    }
    if (overlaps(a.pushbox(), b.pushbox()) && this.temporal.active) {
      // The frozen actor cannot be pushed. Clamp only the moving actor.
      const mover = this.fighters[this.temporal.s.owner],
        frozen = this.fighters[1 - this.temporal.s.owner];
      const gap = (mover.pushbox().w + frozen.pushbox().w) / 2;
      mover.x = frozen.x + (mover.x <= frozen.x ? -gap : gap);
      mover.x = Math.max(mover.stageInset, Math.min(1280 - mover.stageInset, mover.x));
    } else if (overlaps(a.pushbox(), b.pushbox()) && !this.benCrossing(a, b) && !this.benCrossing(b, a)) {
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      // Transfer the full separation to the free side at a wall; clamping
      // each actor independently leaves overlapping pushboxes in the corner.
      const leftHalf = left.pushbox().w / 2, rightHalf = right.pushbox().w / 2;
      const center = Math.max(left.stageInset + leftHalf, Math.min(1280 - right.stageInset - rightHalf, (left.x + right.x) / 2));
      left.x = center - leftHalf;
      right.x = center + rightHalf;
    }
    for (const f of this.fighters)
      if (!this.temporal.isFrozen(f.id)) this.stopAtBenWalls(f, beforeMovement[f.id], crystalWalls);
    this.stepSpecialReleases(true);
    // Capture contacts before resolving so simultaneous attacks can trade.
    const contacts = this.fighters.map((f, i) => {
      if (this.temporal.isFrozen(i)) return null;
      const shapes = f.attackShapes(beforeMovement[i]);
      const target = this.fighters[1 - i];
      if (shapes.length && f.canConnect && f.move?.damage && f.move.kind !== "grab")
        this.strikeEchoClones(f, target, shapes, crystalWalls);
      const groundedGrab = f.move?.level === "throw" || f.move?.ben?.captureStrike;
      const illegalGrab = groundedGrab && (f.data.id === "kaneki"
        ? !canKaguneCapture(f, target, "ground")
        : target.airborne || target.state === "blockstun" ||
          target.state === "hitstun" && !(f.move?.ben?.commandGrab && target.combo > 0 && target.combo <= 2 && f.omnitrix?.usedSpecials.includes(f.move?.ben?.technique ?? "quad")));
      const phasedPhysical = target.benPhase?.physicalOnly && f.move && !f.move.ben?.field &&
        !f.move.stand && !isSuperMove(f.move) && f.move.level !== "throw";
      if (!shapes.length || !f.canConnect || target.knockedDown || target.invulnerable || phasedPhysical || illegalGrab)
        return null;
      const boxes = target.hurtboxes();
      const hurtboxes = f.move?.kind === "grab" && f.data.id !== "kaneki" ? boxes.slice(0, 2) : boxes;
      for (const shape of shapes) {
        if (crystalWalls.some(w => this.benWallBetween(w, f.x, target.x, shape))) continue;
        const rushTip = f.move?.special === "rinkakuRush" && "a" in shape;
        if (rushTip && !canKaguneCapture(f, target, "ground")) continue;
        const validBoxes = rushTip || f.move?.special === "kaguneGrab" ? boxes.slice(0, 2) : hurtboxes;
        const hurt = validBoxes.find(box => shapeHitsRect(shape, box));
        if (!hurt) continue;
        let impact = f.move?.stand ? shapeBounds(shapes[0]) : undefined;
        if (f.data.id === "luffy" || f.data.id === "kaneki" || f.move?.special === "chidori" || f.domination || f.move?.ben) {
          const bounds = shapeBounds(shape);
          const x = Math.max(hurt.x, bounds.x), y = Math.max(hurt.y, bounds.y);
          impact = {
            x, y,
            w: Math.min(hurt.x + hurt.w, bounds.x + bounds.w) - x,
            h: Math.min(hurt.y + hurt.h, bounds.y + bounds.h) - y,
          };
        }
        return {
          f, target, move: { ...f.move!, ...f.hitWindow,
            ...(rushTip ? { kind: "grab", level: "throw" } as const : {}) },
          moveId: f.moveId, hitId: f.hitWindow?.id ?? 0, impact,
        };
      }
      return null;
    });
    const collisions = contacts.map(contact => contact &&
      this.canCounterWithXebec(contact.target, contact.f, contact.move));
    for (const c of contacts) {
      if (!c) continue;
      if (collisions[c.f.id]) {
        this.counterWithXebec(c.target, c.f);
        continue;
      }
      const { f, target, move: m, moveId } = c;
      if (m.super && f.health <= 0) continue;
      if ((m.kind === "jetGigant" || m.kind === "kirin" || m.kind === centipedeId || m.kind === alienXId || m.kind === pandemoniumId) && (f.state !== "attack" || f.moveId !== moveId)) continue;
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
      if (this.counterWithArmor(target, f, m, moveId, c.impact) ||
          this.counterWithFeedback(target, f, m) || this.counterWithXebec(target, f, m)) continue;
      if (
        !this.temporal.isFrozen(target.id) &&
        target.counterWindow &&
        m.level !== "low" &&
        m.level !== "throw" &&
        m.kind !== "ultimate" &&
        m.kind !== "roadRoller" &&
        m.kind !== "jetGigant" &&
        m.kind !== centipedeId && m.kind !== alienXId &&
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
        if (m.ben?.captureStrike && this.benBlocked(target, m, f.facing)) {
          this.resolveImpact(f, target, { ...m, level: "mid", blockstun: 11, push: 4 }, moveId, c.impact);
          continue;
        }
        this.beginCapture("grab", f, target);
        continue;
      }
      if (f.data.id === "kaneki" && moveId === "air_heavy" && canKaguneCapture(f, target, "air") &&
          !contacts.some(other => other?.f === target)) {
        this.beginCapture("grab", f, target, "air");
        continue;
      }
      const direction = (m.special === "nagashi" || m.special === "xebecIntimidation") && target.x !== f.x
        ? Math.sign(target.x - f.x)
        : f.facing;
      const swordCapture = m.special === "fourSwords" &&
        target.combo <= f.data.combatLimits!.maxHits - 4 &&
        canKaguneCapture(f, target, "ground") &&
        !contacts.some(other => other?.f === target);
      this.resolveImpact(f, target, m, moveId, c.impact, direction, winged(f), swordCapture);
    }
    if (this.cinematicActive) return;
    if ((this.capture as CaptureSequence | undefined)?.kaneki?.specialId) {
      this.finishTemporalStep(timeWasActive);
      return;
    }
    this.stepProjectiles();
    this.stepEnergy();
    if (!this.capture) this.stepBenObjects();
    for (const f of this.fighters) f.syncReactionClock(false);
    if (this.capture) {
      this.finishTemporalStep(timeWasActive);
      return;
    }
    this.checkRoundEnd();
    this.finishTemporalStep(timeWasActive);
  }
  private canCounterWithXebec(defender: Fighter, attacker: Fighter, incoming: Move) {
    const guard = defender.move;
    return defender.moveId === "xebecCollision" && defender.state === "attack" && !!guard &&
      defender.stateFrame >= guard.startup && defender.stateFrame < guard.startup + guard.active &&
      !this.temporal.isFrozen(defender.id) && incoming.kind !== "grab" && incoming.level !== "throw" &&
      !isSuperMove(incoming) && !incoming.ben?.captureStrike && !incoming.ben?.field &&
      !["xebecPressure", "xebecIntimidation", "nagashi"].includes(incoming.special ?? "") &&
      Math.abs(attacker.x - defender.x) <= 140 && (attacker.x - defender.x) * defender.facing > 0;
  }
  private counterWithXebec(defender: Fighter, attacker: Fighter) {
    attacker.setState("hitstun");
    attacker.stun = 13;
    attacker.vx = attacker.vy = 0;
    attacker.reactionStrength = 2;
    defender.moveId = xebecCounterReply;
    defender.stateFrame = 0;
    defender.hitIds = [];
    defender.buffer.clear();
    this.hitstop = Math.max(this.hitstop, 8);
    this.effect("counter", (defender.x + attacker.x) / 2, defender.y - 95, 16);
  }
  private gainDomination(f: Fighter, move: Move, id: string) {
    const haki = f.xebec;
    if (!haki || move.super) return;
    if (id === xebecExtraShock) id = "xebecRupture";
    if (haki.credited.includes(id)) return;
    const value = id === xebecCounterReply ? 30 : move.special ? 18 : move.rank === 3 ? 15 : 0;
    const gain = Math.min(value, (id === xebecCounterReply ? 42 : 30) - haki.comboGain);
    if (gain <= 0) return;
    haki.credited.push(id);
    haki.comboGain += gain;
    haki.domination = Math.min(dominationMaximum, haki.domination + gain);
  }
  private benBlocked(target: Fighter, m: Move, direction: number) {
    return target.input.direction === -target.facing && !target.airborne &&
      ["idle", "walk", "crouch", "landing", "blockstun"].includes(target.state) &&
      (!m.ben?.field || direction === -target.facing);
  }

  private resolveImpact(
    f: Fighter,
    target: Fighter,
    m: Move,
    moveId: string,
    impact?: Rect,
    direction = f.facing,
    curseFx = winged(f),
    swordCapture = false,
  ) {
    const limitedLight = isLimitedLightNormal(f.data.id, moveId);
    // After the third normal-light hit, further J attacks cannot re-hit the
    // victim until they recover. This also protects cornered opponents.
    if (limitedLight && target.combo > 0 && target.lightHitsInCombo >= antiLightCombo.maxHits) return;
    const frozen = this.temporal.isFrozen(target.id);
    const guarding =
      target.input.direction === -target.facing &&
      !target.airborne &&
      ["idle", "walk", "crouch", "landing", "blockstun"].includes(
        target.state,
      ) &&
      (!(m.ben?.field || ["knives", "ki", "kamehameha", "xebecFissure"].includes(m.special ?? "") || moveId === xebecExtraShock ||
        (m.special && isSasukeSpecial(m.special) && sasukeTechniques[m.special].shots)) ||
        direction === -target.facing || m.ben?.field?.type === "sonicAssist");
    const blocked =
      guarding &&
      m.level !== "throw" &&
      (!isSuperMove(m) || m.kind === pandemoniumId) &&
      (m.level !== "low" || target.input.down) &&
      (m.level !== "high" || !target.input.down);
    let damage = blocked
      ? 0
      : Math.round(
          m.damage * (m.ben && !m.ben.field && f.benScale > 1 ? 1.07 : 1) *
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
      (swordCapture || ["ultimate", "roadRoller", "gokuFury", "jetGigant", "kirin", centipedeId, alienXId, pandemoniumId].includes(m.kind ?? "")) && !blocked
        ? 1
        : 0,
    );
    const reaction: DeferredReaction = {
      blocked,
      stun: blocked ? m.blockstun : m.stun,
      vx:
        direction *
        (blocked ? m.blockPush ?? (m.ben?.field?.gravityMode === "pull" ? 3 : m.push) : m.push) * (m.ben && !m.ben.field && f.benScale > 1 ? 1.08 : 1) *
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
      if (applied > 0) this.gainDomination(f, m, moveId);
      if (f.state === "attack" && f.moveId === moveId) {
        if (!f.hitConfirmed && applied > 0 && m.ben?.chargeGain && f.omnitrix?.active === "feedback")
          this.gainFeedbackCharge(f.omnitrix, m.ben.chargeGain, "contact");
        f.hitConfirmed = true;
        if (m.ben?.field) f.connected = true;
      }
      if (m.ben?.technique && f.omnitrix && !f.omnitrix.usedSpecials.includes(m.ben.technique))
        f.omnitrix.usedSpecials.push(m.ben.technique);
      if (m.ben?.cold && applied > 0 && !frozen && target.health > 0) {
        const chill = target.chill ??= { build: 0, ticks: 0, freeze: 0, immune: 0, used: false };
        if (!chill.immune && !chill.used) {
          const cap = benStage6Balance.frostLimit - Number(reaction.knockdown);
          chill.build = Math.min(cap, chill.build + m.ben.cold);
          chill.ticks = benStage6Balance.frostHold;
          if (chill.build === benStage6Balance.frostLimit) {
            chill.build = 0;
            chill.immune = benStage6Balance.frostImmunity;
            chill.freeze = benStage6Balance.freezeTicks;
            chill.used = true;
            reaction.stun = Math.max(reaction.stun, benStage6Balance.freezeTicks + 3);
            reaction.vx = 0;
          }
        }
      }
      if (!target.combo) {
        target.comboAge = target.comboAirHits = 0;
        target.lightHitsInCombo = 0;
      }
      target.combo++;
      if (target.airborne || m.launch < 0) target.comboAirHits++;
      if (limitedLight) {
        target.lightHitsInCombo++;
        if (target.lightHitsInCombo >= antiLightCombo.maxHits) {
          // Force a genuine knock-away rather than only damage scaling.
          // The knockdown and light-hit lockout together stop corner loops.
          reaction.vx = direction * antiLightCombo.push;
          reaction.vy = antiLightCombo.launch;
          reaction.stun = Math.max(reaction.stun, antiLightCombo.stun);
          reaction.launch = true;
          reaction.knockdown = true;
          reaction.strength = 3;
        }
      }
      if (target.airborne && !m.knockdown && !m.super)
        reaction.stun += combatPace.combo.airExtensionStun;
      if (m.ben && target.combo > 4) reaction.stun = Math.max(9, reaction.stun - (target.combo - 4) * 3);
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
      if (m.kind !== "ultimate" && m.kind !== alienXId && m.kind !== pandemoniumId) f.gainMeter(m.meterGain ?? 10);
      const resource = f.domination;
      if (resource && moveId !== pandemoniumId && moveId !== "xebecAftershock") {
        const projectile = moveId === "xebecRift";
        if (projectile || (!resource.awarded && !resource.powered && f.moveId === moveId)) {
          const gain = moveId === xebecRiposte ? 26 : isXebecSpecial(moveId) ? 18 : m.rank === 3 ? 14 : 0;
          resource.charge = Math.min(100, resource.charge + gain);
          if (!projectile) resource.awarded = true;
        }
      }
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
      if (f.domination) event.xebec = { rank: m.rank, facing: direction };
      if (m.ben && !blocked) event.ben = m.ben.effect;
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
    if (swordCapture && !blocked) this.beginCapture("grab", f, target);
    if (m.kind === "ultimate" && !blocked)
      this.beginCapture("ultimate", f, target);
    if (m.kind === "roadRoller" && !blocked) this.beginRoadRoller(f, target);
    if (!blocked && (m.kind === "gokuFury" || m.kind === "jetGigant" || m.kind === "kirin" || m.kind === centipedeId || m.kind === alienXId || m.kind === pandemoniumId))
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
  private stepSpecialReleases(xebecOnly: boolean) {
    for (const f of this.fighters) {
      if (this.temporal.isFrozen(f.id) || f.state !== "attack") continue;
      const m = f.move!;
      if (xebecOnly) {
        if (!f.xebec) continue;
        if (f.moveId === "xebecFissure" && f.stateFrame === m.startup) {
          const point = poseAt(m, f.stateFrame)?.release;
          if (point) this.spawnXebecWave(f, f.moveId, point.x, point.y);
        } else if (f.moveId === "xebecRupture" && f.xebec.empowered &&
          f.stateFrame === m.hitWindows?.[1]?.fromTick && !f.airborne) {
          this.spawnXebecWave(f, xebecExtraShock, 58, -20);
        }
        continue;
      }
      if (f.xebec) continue;
      if (f.data.id === "goku") {
        this.spawnGokuSpecial(f);
        continue;
      }
      if (m.special && isSasukeSpecial(m.special)) {
        this.spawnSasukeSpecial(f, m, m.special);
        continue;
      }
      const hakiShot = f.domination && (f.stateFrame === m.startup && f.moveId === "xebecRift" ? f.moveId :
        f.domination.powered && f.moveId === "xebecRupture" && f.stateFrame === m.startup + m.active ? "xebecAftershock" : undefined);
      const release = hakiShot && xebecProjectile(hakiShot);
      if (release && hakiShot) {
        const { speed, radius, life } = release;
        const x = f.x + f.facing * release.x;
        const y = f.y + release.y;
        this.kiProjectiles.push({
          id: ++this.projectileSerial, owner: f.id, move: hakiShot, cast: 0,
          x, y, previousX: x, previousY: y, vx: speed * f.facing, vy: 0,
          facing: f.facing, radius, age: 0, life, state: "flight", impactAge: 0,
        });
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
      const tip = p.facing * 14;
      const shape = { a: { x: p.previousX - tip, y: p.previousY }, b: { x: p.x + tip, y: p.y }, r: 2 };
      const walls = this.benWalls();
      if (this.damageBenWalls([shape], p.damage, walls, `knife:${p.id}`, p.owner) ||
          this.strikeEchoClones(owner, target, [shape], walls)) return false;
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
    const shapes = fireDragonVolumes(w, { x: p.previousX, y: p.previousY }, p.radius);
    const target = this.fighters[1 - p.owner], owner = this.fighters[p.owner];
    const move = p.move === "xebecAftershock" ? xebecSpecials.aftershock : p.curse ? sasukeCurseMoves[p.move] : owner.data.specialMoves?.[p.move];
    if (move && this.damageBenWalls(shapes, move.damage, this.benWalls(), `dragon:${p.id}`, p.owner)) return false;
    if (target.invulnerable || target.knockedDown) return true;
    const boxes = target.hurtboxes();
    for (const shape of shapes) {
      const box = boxes.find(r => shapeHitsRect(shape, r));
      if (!box) continue;
      if (move) {
        if (this.absorbBen(target, 2, move.damage, p.facing)) return false;
        w.struck = true;
        this.resolveImpact(owner, target, move, p.move, box, p.facing, !!p.curse);
      }
      break;
    }
    return true;
  }
  private spawnXebecWave(f: Fighter, move: keyof typeof xebecProjectile, offsetX: number, offsetY: number) {
    const { speed, radius, life } = xebecProjectile[move];
    const x = f.x + f.facing * offsetX, y = f.y + offsetY;
    this.kiProjectiles.push({
      id: ++this.projectileSerial, owner: f.id, move, cast: 0,
      x, y, previousX: x, previousY: y, vx: speed * f.facing, vy: 0,
      facing: f.facing, radius, age: 0, life, state: "flight", impactAge: 0,
    });
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
        move = p.move === "xebecAftershock" ? xebecSpecials.aftershock : p.curse ? sasukeCurseMoves[p.move] : owner.data.specialMoves?.[p.move];
      if (!move) return true;
      const shape = {
        a: { x: p.previousX, y: p.previousY },
        b: { x: p.x, y: p.y },
        r: p.radius,
      };
      const walls = this.benWalls();
      if (this.damageBenWalls([shape], move.damage, walls, `energy:${p.id}`, p.owner) ||
          this.strikeEchoClones(owner, target, [shape], walls)) return false;
      if (target.knockedDown || target.invulnerable) return true;
      const hurt = target.hurtboxes().find((r) => shapeHitsRect(shape, r));
      if (hurt) {
        const energy = move.special === "ki" || move.special === "hosenka" || move.special === "gokakyu";
        if (energy && this.absorbBen(target, p.radius >= 22 ? 2 : 1, move.damage, p.facing)) return false;
        let impact = hurt;
        if (isSasukeSpecial(p.move) || xebecProjectile(p.move)) {
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
      const box = beamBox(b);
      const walls = this.benWalls();
      const wall = walls.find(w => w.owner !== b.owner && this.benWallSolid(w) &&
        (w.object.x - b.x) * b.facing > 0 && (target.x - w.object.x) * b.facing > 0 &&
        shapeHitsRect(box, shapeBounds(benObjectShape(w.object, w.field))));
      if (wall) {
        this.damageBenWalls([box], move!.damage, [wall], `beam:${b.id}:${pulse}`, b.owner);
        b.length = Math.min(b.length, Math.abs(wall.object.x - b.x));
      }
      if (
        pulse < move!.beam!.hits &&
        !b.hitIds.includes(pulse) && !wall &&
        !target.invulnerable &&
        !target.knockedDown &&
        target.hurtboxes().some((r) => overlaps(beamBox(b), r))
      ) {
        b.hitIds.push(pulse);
        owner.connected = true;
        b.impactAge = b.age;
        if (this.absorbBen(target, 2, move!.damage, b.facing)) {
          b.state = "dissipate";
          b.age = 0;
          b.life = gokuBalance.projectiles.impactTicks;
          return true;
        }
        this.resolveImpact(owner, target, move!, b.move, box, b.facing);
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
  private benCrossing(fighter: Fighter, rival: Fighter) {
    const move = fighter.state === "attack" ? fighter.move : undefined;
    if (move?.ben?.burrow && fighter.benPhase) return true;
    if (!move?.ben?.cross || !move.drive || fighter.stateFrame < move.drive.from || fighter.stateFrame >= move.drive.to) return false;
    const gap = (fighter.pushbox().w + rival.pushbox().w) / 2;
    const exit = rival.x + fighter.facing * gap;
    return exit >= fighter.stageInset && exit <= 1280 - fighter.stageInset;
  }

  private tickBenAbilities(f: Fighter, other: Fighter, landedFromDrop: boolean) {
    const watch = f.omnitrix;
    if (!watch) return;
    if (watch.absorbCooldown) watch.absorbCooldown--;
    if (watch.absorbWindow) watch.absorbWindow--;
    if (watch.active === "feedback") {
      const guard = f.input.direction === -f.facing && !f.airborne && ["idle", "walk", "crouch"].includes(f.state);
      if (guard && !watch.guardHeld && !watch.absorbCooldown) watch.absorbWindow = 5;
      if (!guard) watch.absorbWindow = 0;
      watch.guardHeld = guard;
    }
    if (watch.growthCooldown > 0) watch.growthCooldown--;
    if (watch.ghostCooldown) watch.ghostCooldown--;
    if (watch.nrgCooldown) watch.nrgCooldown--;
    if (watch.echoCooldown) watch.echoCooldown--;
    const current = f.state === "attack" ? f.move : undefined;
    if (!f.airborne && !current?.ben?.airUse && !current?.ben?.lift) {
      delete watch.flightUsed;
      delete watch.flightTicks;
      delete watch.flightVX;
      delete watch.flightVY;
      delete watch.diveUsed;
    }
    if (watch.nrgReleased) {
      watch.nrgTicks = Math.max(0, (watch.nrgTicks ?? 0) - 1);
      if (!watch.nrgTicks && !watch.transition && ["idle", "walk", "crouch", "landing", "air"].includes(f.state))
        f.attack("nrgSeal_medium");
    }
    if (current?.ben?.nrgMode && !f.airborne && f.stateFrame >= current.startup && f.stateFrame < current.startup + current.active + current.recovery) {
      const release = current.ben.nrgMode === "release";
      const next = release ? nrgReleasedForm : benForms.nrg!;
      if (this.placeBenBody(f, other, next, !release)) {
        watch.objects.length = 0;
        watch.nrgReleased = release;
        delete watch.flightTicks;
        watch.nrgTicks = release ? benStage6Balance.nrgDuration : 0;
        if (!release) watch.nrgCooldown = benStage6Balance.nrgCooldown;
        f.buffer.clear();
        f.attack(release ? "nrgEmergence" : "nrgLock");
        this.effect("power", f.x, f.y - 95, 20);
        this.events.at(-1)!.ben = "thermal";
      } else watch.noSpace = 35;
    }
    if (watch.growth && --watch.growth.ticks === 0) delete watch.growth;
    if (watch.chargeTicks > 0 && --watch.chargeTicks === 0) watch.charge = 0;
    if (watch.absorbFlash > 0) watch.absorbFlash--;
    if (watch.chargeCue && --watch.chargeCue.ticks === 0) delete watch.chargeCue;
    if (landedFromDrop && f.y === FLOOR) {
      this.effect("hit", f.x, FLOOR - 4, 15);
      this.events.at(-1)!.ben = "colossus";
    }
    const move = f.state === "attack" ? f.move : undefined;
    const rank = move?.ben?.grow;
    if (!rank || !move || f.stateFrame !== move.startup) return;
    const growth = benFormBalance.growth[rank];
    const larger = f.pushbox(f.benForm, f.x, growth.scale);
    if (larger.x < 0 || larger.x + larger.w > 1280 || overlaps(larger, other.pushbox()) ||
        this.benWalls().some(w => this.benWallSolid(w) && shapeHitsRect(benObjectShape(w.object, w.field), larger))) {
      watch.noSpace = 35;
      return;
    }
    watch.growth = { rank, ticks: growth.ticks };
    watch.growthCooldown = growth.ticks + growth.cooldown;
    this.effect("power", f.x, FLOOR - 11, 20);
    this.events.at(-1)!.ben = "colossus";
  }

  private benWalls(): BenWall[] {
    const walls: BenWall[] = [];
    for (const owner of this.fighters) for (const object of owner.omnitrix?.objects ?? []) {
      const field = benObjectMove(object.id)?.ben?.field;
      if (field?.type === "wall") walls.push({ owner: owner.id, object, field });
    }
    return walls;
  }

  private benWallSolid({ object, field }: BenWall) {
    return !object.spent && object.age >= 3 && object.age < field.life - 7;
  }

  private benWallBetween(w: BenWall, x: number, otherX: number, attack: AttackShape) {
    return this.benWallSolid(w) && (x - w.object.x) * (otherX - w.object.x) < 0 &&
      shapeHitsRect(attack, shapeBounds(benObjectShape(w.object, w.field)));
  }

  private stopAtBenWalls(f: Fighter, priorX: number, walls: BenWall[]) {
    for (const w of walls) {
      if (!this.benWallSolid(w)) continue;
      const wall = shapeBounds(benObjectShape(w.object, w.field));
      const body = f.pushbox();
      if (body.y >= wall.y + wall.h || f.y <= wall.y) continue;
      const left = priorX < w.object.x;
      const limit = left ? wall.x - body.w / 2 : wall.x + wall.w + body.w / 2;
      if (left ? f.x <= limit : f.x >= limit) continue;
      f.x = limit;
      if ((left ? 1 : -1) * f.vx > 0) f.vx = 0;
    }
  }

  private damageBenWalls(shapes: AttackShape[], damage: number, walls: BenWall[], key: string, owner: number) {
    let stopped = false;
    for (const w of walls) {
      if (w.owner === owner || !this.benWallSolid(w) || !damage) continue;
      if (!shapes.some(shape => shapeHitsRect(shape, shapeBounds(benObjectShape(w.object, w.field))))) continue;
      stopped = true;
      if (w.object.hitKeys!.includes(key)) continue;
      w.object.hitKeys!.push(key);
      w.object.durability! -= damage;
      this.effect("hit", w.object.x, FLOOR - w.field.height * .52, 12);
      this.events.at(-1)!.ben = "crystal";
      if (w.object.durability! <= 0) {
        w.object.spent = true;
        w.object.age = Math.max(w.object.age, w.field.life - 8);
      }
    }
    return stopped;
  }

  private counterWithArmor(defender: Fighter, attacker: Fighter, incoming: Move, id: string, contact?: Rect) {
    const watch = defender.omnitrix;
    if (watch?.active !== "nrg" || watch.nrgReleased || !defender.move?.ben?.armorCounter ||
        defender.attackPhase !== "active" || defender.airborne || attacker.health <= 0 ||
        this.temporal.isFrozen(defender.id) || this.temporal.isFrozen(attacker.id) ||
        incoming.kind === "grab" || incoming.level === "throw" || isSuperMove(incoming) ||
        incoming.stand || incoming.projectile || incoming.beam || incoming.ben?.field ||
        incoming.ben?.cable || incoming.ben?.spectralReach ||
        incoming.special === "nagashi" || incoming.special === "chidori" || incoming.special === "goryuka" ||
        (attacker.x - defender.x) * defender.facing <= 0 ||
        Math.abs(attacker.x - defender.x) > 124 || Math.abs(attacker.y - defender.y) > 70) return false;
    if (!defender.attack("nrgCounterShove")) return false;
    defender.buffer.clear();
    const damage = this.damage(defender, Math.round(incoming.damage * .25));
    this.recordHit(attacker, defender, id, damage);
    this.effect("counter", contact ? contact.x + contact.w / 2 : defender.x + defender.facing * 37,
      contact ? contact.y + contact.h / 2 : defender.y - 95, 12);
    this.events.at(-1)!.ben = "metal";
    this.hitstop = Math.max(this.hitstop, 5);
    if (defender.health > 0) {
      // Brief recoil at the point of contact. The shove itself has its own
      // startup and hitbox and uses the normal damage and push rules.
      attacker.setState("hitstun");
      attacker.stun = 9;
      attacker.vx = 0;
      attacker.hitCrouched = false;
      attacker.hitLaunch = false;
      attacker.reactionStrength = 1;
      attacker.syncReactionClock(false);
    }
    return true;
  }

  private counterWithXebec(defender: Fighter, attacker: Fighter, incoming: Move) {
    if (!defender.domination || defender.moveId !== "xebecCollision" ||
        defender.attackPhase !== "active" || attacker.health <= 0 ||
        this.temporal.isFrozen(defender.id) || this.temporal.isFrozen(attacker.id) ||
        incoming.level === "throw" || incoming.kind === "grab" || isSuperMove(incoming) ||
        incoming.stand || incoming.projectile || incoming.beam || incoming.ben?.field ||
        incoming.ben?.cable || incoming.ben?.spectralReach ||
        (attacker.x - defender.x) * defender.facing <= 0 ||
        Math.abs(attacker.x - defender.x) > 105 || Math.abs(attacker.y - defender.y) > 66) return false;
    if (!defender.attack(xebecRiposte)) return false;
    defender.buffer.clear();
    this.applyReaction(attacker, {
      blocked: false, stun: 12, vx: 0, vy: 0, knockdown: false,
      strength: 2, launch: false, crouched: false,
    });
    this.hitstop = Math.max(this.hitstop, 6);
    this.effect("counter", defender.x + defender.facing * 43, defender.y - 103, 15);
    return true;
  }

  private counterWithFeedback(defender: Fighter, attacker: Fighter, incoming: Move) {
    if (defender.omnitrix?.active !== "feedback" || !defender.move?.ben?.counter ||
        defender.attackPhase !== "active" || defender.airborne || attacker.health <= 0 ||
        this.temporal.isFrozen(defender.id) || this.temporal.isFrozen(attacker.id) ||
        incoming.kind === "grab" || incoming.level === "throw" || isSuperMove(incoming) ||
        incoming.ben?.cable || incoming.ben?.field || incoming.special === "nagashi" ||
        incoming.special === "chidori" || incoming.stand ||
        (attacker.x - defender.x) * defender.facing <= 0 ||
        Math.abs(attacker.x - defender.x) > 114 ||
        Math.abs(attacker.y - defender.y) > 112) return false;
    if (!defender.attack("feedback_counter")) return false;
    defender.buffer.clear();
    defender.connected = true;
    this.resolveImpact(defender, attacker, defender.move!, "feedback_counter");
    return true;
  }

  private gainFeedbackCharge(watch: OmnitrixState, gain: number, kind: "absorb" | "contact") {
    const amount = Math.min(gain, benFormBalance.energy.capacity - watch.charge);
    watch.charge += amount;
    if (amount > 0 || kind === "absorb") watch.chargeTicks = benFormBalance.energy.retention;
    if (amount > 0 || kind === "absorb") watch.chargeCue = { kind, amount, ticks: 29 };
  }

  private absorbBen(target: Fighter, strength: 1 | 2, damage: number, direction: number) {
    const watch = target.omnitrix, rank = target.move?.ben?.absorb;
    if (watch?.active !== "feedback" || this.temporal.isFrozen(target.id) ||
        direction !== -target.facing || target.health <= 0 || this.capture) return false;
    const legacy = rank && strength <= rank && target.attackPhase === "active" && !target.connected;
    if (!legacy && (!watch.absorbWindow || watch.absorbCooldown || !watch.guardHeld)) return false;
    this.gainFeedbackCharge(watch, Math.max(25, Math.round(damage * .72)), "absorb");
    if (legacy) {
      const move = target.move!;
      target.connected = true;
      target.stateFrame = move.startup + move.active + move.recovery - 12;
    }
    watch.absorbWindow = 0;
    watch.absorbCooldown = 35;
    watch.absorbFlash = 18;
    this.effect("power", target.x + target.facing * 28, target.y - 98, 18);
    this.events.at(-1)!.ben = "electric";
    return true;
  }

  private strikeEchoClones(owner: Fighter, target: Fighter, shapes: AttackShape[], walls: BenWall[]) {
    if (this.temporal.isFrozen(target.id)) return false;
    return hitEchoClones(target, shapes, FLOOR,
      (shape, x) => !walls.some(w => this.benWallBetween(w, owner.x, x, shape)));
  }

  private stepBenObjects() {
    for (const owner of this.fighters) {
      const watch = owner.omnitrix;
      if (!watch || this.temporal.isFrozen(owner.id)) continue;
      const target = this.fighters[1 - owner.id];
      const move = owner.state === "attack" ? owner.move : undefined;
      const cast = move?.ben?.field;
      if (cast?.gravityMode === "repel" && owner.stateFrame === move!.startup - (owner.moveId.endsWith("_medium") ? 12 : 6))
        spawnGravityStones(owner, this.combatFrame, FLOOR);
      if (cast && move && owner.stateFrame === move.startup) this.spawnBenField(owner, target, cast);
      const walls = this.benWalls();
      tickEchoClones(owner, target, this.combatFrame, FLOOR, x => walls.some(w => this.benWallSolid(w) &&
        (Math.abs(w.object.x - x) <= w.field.width / 2 + 19 ||
          this.benWallBetween(w, owner.x, x, { x: Math.min(owner.x, x), y: FLOOR - 95, w: Math.abs(x - owner.x), h: 95 }))));
      watch.objects = watch.objects.filter((object, index) => {
        const projectile = benObjectMove(object.id);
        const field = projectile?.ben?.field;
        if (!field) return false;
        if (object.impactAge !== undefined) return ++object.impactAge < 15;
        if ((projectile.ben?.nightmare || field.gravityFocus && !object.spent) &&
            (owner.state !== "attack" || owner.moveId !== object.id)) return false;
        if (++object.age > field.life + (object.power ? 6 : 0)) return false;
        if (object.age <= 0 || field.type === "wall" || field.type === "gravityWell") return true;
        if (["fireball", "bolt", "shard", "frost", "sonic"].includes(field.type) &&
            gravityAt(target, object.x, object.y, FLOOR))
          object.vy = Math.min(7, (object.vy ?? 0) + .48);
        const before = { x: object.x, y: object.y };
        if (field.type === "gravityStone") {
          if (object.age < gravityStoneLaunch(object) &&
              (!move || !owner.moveId.startsWith("gravityRepel_"))) return false;
          if (!tickGravityStone(object)) return true;
          if (object.x < 0 || object.x > 1280 || object.y >= FLOOR) return false;
        } else {
          object.x += object.direction * (field.type === "spectralHand" && object.vy ? 6 : field.speed);
          object.y += object.vy ?? 0;
        }
        if (field.gravity) object.vy = (object.vy ?? 0) + field.gravity;
        if (field.type === "beam") {
          // A continuous discharge stays on the firing pose while the caster moves.
          if (owner.state !== "attack" || owner.moveId !== object.id) return false;
          const heat = field.aim === "heat" && owner.airborne;
          const down = heat && !owner.input.up;
          const offset = down ? field.offset + 7 : field.offset;
          const height = down ? field.height - 29 : field.height;
          object.x = Math.max(field.width, Math.min(1280 - field.width, owner.x + object.direction * offset));
          object.y = owner.y - height;
          if (heat && object.id.endsWith("medium")) {
            const angle = owner.input.up ? 0 : owner.input.down ? 1.1 :
              Math.min(.99, .34 + object.age * .05);
            object.aim = (object.aim ?? 0) * .65 + angle * .35;
          }
        }
        if (field.type === "lightning" && object.age === field.activeAge?.[0])
          this.events.push({ kind: "hit", x: object.x, y: FLOOR, life: 5, total: 5,
            blocked: false, audioOnly: true, ben: "storm" });
        const crash = () => {
          object.impactAge = 0;
          object.spent = true;
          this.effect("hit", object.x, object.y, 15);
          this.events.at(-1)!.ben = "colossus";
          return true;
        };
        if (field.type === "car") {
          const edge = 60 * (object.scale ?? 1), ground = FLOOR - 25 * (object.scale ?? 1);
          if (object.x <= edge || object.x >= 1280 - edge || object.y >= ground) {
            object.x = Math.max(edge, Math.min(1280 - edge, object.x));
            object.y = Math.min(ground, object.y);
            return crash();
          }
        }
        if (object.x < -60 || object.x > 1340 || object.y < -40 || object.y > FLOOR + 16) return false;
        if (object.spent || (field.activeAge && (object.age < field.activeAge[0] || object.age >= field.activeAge[1])) ||
            (field.type === "spikes" && object.age >= field.life - 6)) return true;
        const shape = benObjectShape(object, field, before.x, before.y);
        const damage = projectile.damage + (object.power === 50 ? 13 : object.power ? 8 : 0);
        const missile = benProjectile(field);
        if (missile && this.damageBenWalls([shape], damage, walls, `ben:${owner.id}:${object.cast}:${index}`, owner.id))
          return field.type === "car" ? crash() : false;
        if (field.type === "gravityPulse" && walls.some(w => this.benWallBetween(w, owner.x, target.x, shape))) return true;
        if (damage && this.strikeEchoClones(owner, target, [shape], walls) && missile && field.type !== "beam") return false;
        if (this.capture || target.knockedDown || target.invulnerable || target.health <= 0 ||
            field.type === "gravityStone" && target.combo >= 4 ||
            field.type === "sonicAssist" && (target.combo >= 5 || owner.omnitrix?.active !== "echoEcho")) return true;
        const hurt = target.hurtboxes().find(box => shapeHitsRect(shape, box));
        if (!hurt) return true;
        object.spent = true;
        if (object.cast !== undefined && (field.type === "spikes" || field.type === "shard")) {
          for (const sibling of watch.objects)
            if (sibling.id === object.id && sibling.cast === object.cast && sibling !== object)
              sibling.spent = true;
        }
        const direction = field.type === "lightning" || field.type === "spectralHand" ? -target.facing
          : (field.type === "pillar" || field.gravityMode === "repel") && target.x !== object.x
            ? Math.sign(target.x - object.x) : object.direction;
        if (field.type === "spectralHand" && projectile.ben?.nightmare &&
            !this.benBlocked(target, projectile, direction) && !this.temporal.isFrozen(target.id) &&
            target.combo < (owner.data.combatLimits?.maxHits ?? 9)) {
          for (const sibling of watch.objects)
            if (sibling.cast === object.cast && sibling.id === object.id) sibling.spent = true;
          if (owner.x !== target.x) owner.facing = owner.x < target.x ? 1 : -1;
          this.beginCapture("grab", owner, target, "ground", object.id);
          return false;
        }
        const energy = field.energy ?? (field.type === "fireball" ? (object.id.endsWith("_medium") ? 2 : 1) : 0);
        if (energy && this.absorbBen(target, energy, damage, direction)) return false;
        const impact = object.power
          ? { ...projectile, damage, stun: projectile.stun + 3, push: projectile.push + 2 }
          : field.type === "sonicAssist" && target.combo
            ? { ...projectile, damage, stun: Math.max(projectile.stun, Math.min(16, target.stun)), launch: target.airborne ? target.vy * .65 : 0 }
            : { ...projectile, damage };
        const beamX = field.type === "beam" ? target.x : object.x;
        const contactX = Math.max(hurt.x, Math.min(beamX, hurt.x + hurt.w));
        const impactY = field.type === "beam" ? Math.max(hurt.y, Math.min(hurt.y + hurt.h,
          object.y + Math.abs(contactX - object.x) * (object.aim ?? 0))) : object.y;
        this.resolveImpact(owner, target, impact, object.id, {
          x: contactX,
          y: missile ? impactY : Math.max(hurt.y, object.y - field.height),
          w: 0, h: 0,
        }, direction);
        return field.type === "car" ? crash() : !missile || field.type === "beam";
      });
      const revealed = this.capture;
      if (revealed?.attacker === owner.id && revealed.ben?.moveId.startsWith("ghostPhase_"))
        watch.objects = watch.objects.filter(object => object.id !== revealed.ben!.moveId);
    }
  }

  private spawnBenField(owner: Fighter, target: Fighter, field: BenField) {
    const watch = owner.omnitrix!;
    const projectile = benProjectile(field);
    const half = projectile ? field.width : field.width / 2;
    const balance = benFormBalance.energy;
    const cost = field.energy === 1 ? balance.lightSpend : balance.mediumSpend;
    const power = (field.spendCharge || field.type === "bolt") && watch.active === "feedback" && watch.charge >= cost ? cost : 0;
    const origin = owner.x + field.offset * owner.facing;
    const stormX = Math.max(half, Math.min(1280 - half, origin));
    const lastStrike = stormX + (field.pattern?.at(-1)?.offset ?? 0) * owner.facing;
    const stormSide = lastStrike > 1280 - half || lastStrike < half ? -owner.facing : owner.facing;
    for (const shot of field.pattern ?? [{}]) {
      const desired = origin + (shot.offset ?? 0) * owner.facing;
      const placeX = field.type === "lightning" ? stormX + (shot.offset ?? 0) * stormSide : desired;
      if (field.type === "spikes" && (desired < half || desired > 1280 - half)) continue;
      const object: BenObject = {
        id: owner.moveId, direction: owner.facing * (shot.direction ?? 1),
        x: field.gravityFocus ? placeX : Math.max(half, Math.min(1280 - half, placeX)),
        y: shot.height ? FLOOR - shot.height : projectile ? owner.y - field.height : FLOOR,
        age: -(shot.delay ?? 0), spent: false, cast: this.combatFrame,
        ...(shot.vy || field.type === "car" ? { vy: shot.vy ?? -4.9 } : {}),
        ...(field.type === "car" ? { scale: owner.benScale } : {}),
        ...(field.aim === "heat" ? { aim: owner.airborne ? owner.input.down ? .95 : owner.input.up ? 0 : .55 : 0 } : {}),
        ...(power ? { power } : {}),
      };
      if (field.type === "wall") {
        const bounds = { x: object.x - half - 3, y: FLOOR - field.height, w: field.width + 6, h: field.height };
        const widest = Math.max(owner.pushbox().w, target.pushbox().w);
        const margin = half + widest / 2 + Math.max(40, widest / 2);
        if (desired < margin || desired > 1280 - margin || overlaps(bounds, owner.pushbox()) || overlaps(bounds, target.pushbox())) {
          watch.noSpace = 35;
          return;
        }
        object.durability = field.durability!;
        object.hitKeys = [];
      }
      watch.objects.push(object);
    }
    if (power) {
      watch.charge -= power;
      watch.chargeCue = { kind: "spend", amount: -power, ticks: 29 };
    }
  }

  private placeBenForm(fighter: Fighter, rival: Fighter, to: BenAlien) {
    const form = benForms[to];
    if (!form || !this.placeBenBody(fighter, rival, form)) return false;
    const watch = fighter.omnitrix!;
    if (watch.active === "gravattack" || watch.active === "echoEcho") clearStage7(fighter);
    if (watch.nrgReleased) {
      watch.nrgReleased = false;
      delete watch.flightTicks;
      watch.nrgTicks = 0;
      watch.nrgCooldown = benStage6Balance.nrgCooldown;
      watch.objects.length = 0;
    }
    return true;
  }

  private placeBenBody(fighter: Fighter, rival: Fighter, form: BenForm, allowPush = false) {
    const half = form.width / 2, inset = Math.max(40, half);
    let x = Math.max(inset, Math.min(1280 - inset, fighter.x));
    const target = rival.pushbox();
    let rivalX = rival.x;
    const solidWall = (box: Rect) => this.benWalls().some(w =>
      this.benWallSolid(w) && shapeHitsRect(benObjectShape(w.object, w.field), box));
    if (overlaps(fighter.pushbox(form, x, 1), target)) {
      const side = fighter.x <= rival.x ? -1 : 1;
      const gap = half + target.w / 2;
      x = rival.x + side * gap;
      if (x < inset || x > 1280 - inset) {
        if (!allowPush) return false;
        x = Math.max(inset, Math.min(1280 - inset, x));
        rivalX = x - side * gap;
        if (rivalX < rival.stageInset || rivalX > 1280 - rival.stageInset ||
            solidWall(rival.pushbox(rival.benForm, rivalX))) return false;
      }
    }
    if (solidWall(fighter.pushbox(form, x, 1))) {
      if (!allowPush) return false;
      const origin = Math.max(inset, Math.min(1280 - inset, fighter.x));
      const candidates = Array.from({ length: 33 }, (_, i) => i % 2 ? origin - (i + 1) * 1.5 : origin + i * 1.5);
      const nearby = candidates.find(candidate => {
        const body = fighter.pushbox(form, candidate, 1);
        return candidate >= inset && candidate <= 1280 - inset && !overlaps(body, target) && !solidWall(body);
      });
      if (nearby === undefined) return false;
      x = nearby;
      rivalX = rival.x;
    }
    fighter.x = x;
    rival.x = rivalX;
    // A switch spends the old dash or jump startup rather than extending it.
    fighter.setState(fighter.airborne ? "air" : "idle");
    return true;
  }
  private damage(target: Fighter, damage: number, minimum = 0) {
    if (target.benForm) damage = Math.round(damage * target.benForm.damageTaken);
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
    source: KanekiCapture["source"] = "ground",
    benMoveOverride?: string,
  ) {
    if (kind === "grab" && attacker.data.id === "kaneki") {
      const x = victim.x, y = victim.y;
      const technique = kanekiTechnique(attacker.moveId);
      const limb = attacker.kanekiLimb ?? (source === "air" ? "upperRear" : "lowerFront");
      attacker.vx = attacker.vy = victim.vx = victim.vy = 0;
      victim.facing = -attacker.facing;
      attacker.setState("grabbing");
      victim.setState("grabbed");
      victim.kanekiCaptured = true;
      const swords = technique?.family === "fourSwords";
      const chain: Chain | undefined = source === "ground" ? {
        origin: technique?.family ?? "universal",
        rank: technique?.rank ?? 0,
        initialCombo: victim.combo,
        started: this.frame,
        phase: swords ? "opener" : "connected",
        since: 0,
      } : undefined;
      attacker.actionClip = swords ? kanekiSpecialScene(technique.id, 0, attacker, victim, attacker.facing).clip : "grabConnected";
      victim.actionClip = "grabbed";
      attacker.buffer.clear();
      victim.buffer.clear();
      this.capture = { kind, attacker: attacker.id, victim: victim.id, tick: 0,
        scale: Math.max(combatPace.combo.minimumDamageScale, 1 - victim.combo * combatPace.combo.damageStep),
        kaneki: { source, limb, x, y, direction: attacker.facing, specialId: technique?.id, chain } };
      if (chain && !swords) this.effect("chainBind", victim.x, victim.y - 72, 10);
      this.hitstop = Math.max(this.hitstop, 4);
      return;
    }
    const benMove = kind === "grab" && attacker.benForm ? benMoveOverride ?? attacker.moveId : undefined;
    const grab = kind === "grab" ? benGrabFor(attacker.benForm, benMove ?? "") ?? attacker.grabSequence : undefined;
    const contactX = grab?.startFromContact
      ? (victim.x - attacker.x) * attacker.facing
      : undefined;
    const contactFrame = benMove?.startsWith("conductor_") ? attacker.stateFrame : undefined;
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
    const contactY = (grab && "scene" in grab && grab.scene) ? victim.y - FLOOR : undefined;
    attacker.y = FLOOR;
    if (contactY === undefined) victim.y = FLOOR;
    attacker.vx = attacker.vy = victim.vx = victim.vy = 0;
    victim.facing = -attacker.facing;
    victim.health = Math.max(1, victim.health);
    attacker.setState(kind === "grab" ? "grabbing" : "cinematic");
    victim.setState("grabbed");
    attacker.actionClip = kind === "ultimate" ? "ultimateRush" : grab && "clip" in grab && typeof grab.clip === "string" ? grab.clip : "grabHold";
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
      ...(contactY === undefined ? {} : { contactY }),
      ...(benMove ? { ben: { moveId: benMove, origin: attacker.x, direction: attacker.facing,
        ...(contactFrame === undefined ? {} : { contactFrame }) } } : {}),
    };
    const technique = benMove && benObjectMove(benMove)?.ben?.technique;
    if (technique && attacker.omnitrix && !attacker.omnitrix.usedSpecials.includes(technique))
      attacker.omnitrix.usedSpecials.push(technique);
    this.hitstop = Math.max(this.hitstop, kind === "ultimate" ? 12 : 5);
  }
  private centipedeEffect(cue: CentipedeCue, x: number, y: number, life: number, strength?: number) {
    this.events.push({ kind: "centipede", centipede: { cue, frame: this.frame }, x, y,
      life, total: life, strength, blocked: false });
  }
  private beginStagedSuper(a: Fighter, b: Fighter, kind: "jetGigant" | "gokuFury" | "kirin" | "centipede" | "alienX" | typeof pandemoniumId,
    source: CentipedeSource = "strike") {
    const config = kind === pandemoniumId ? pandemoniumConfig : kind === alienXId ? alienXConfig : kind === centipedeId ? centipedeConfig : kind === "kirin" ? kirinConfig : kind === "jetGigant" ? jetConfig : furyConfig;
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
    else if (kind === centipedeId) {
      const grip = this.capture?.kaneki?.limb ?? "lowerFront";
      this.centipede = { ...state, source, grip, originY: a.y, hold: 0,
        scale: Math.max(centipedeConfig.minimumComboScale, 1 - Math.max(0, b.combo - (source === "strike" ? 1 : 0)) * combatPace.combo.damageStep) };
      this.capture = undefined;
      if (source !== "strike") this.centipedeEffect("activation", a.x, a.y - 74, 20);
    } else if (kind === alienXId) {
      this.alienX = { ...state, hold: 0 };
      const watch = a.omnitrix!;
      clearStage7(a);
      watch.objects.length = 0;
      if (watch.growth) watch.growthCooldown = benFormBalance.growth[watch.growth.rank].cooldown;
      if (watch.nrgReleased) watch.nrgCooldown = benStage6Balance.nrgCooldown;
      watch.active = "human";
      watch.nrgReleased = false;
      watch.nrgTicks = 0;
      watch.holdTicks = 0;
      delete watch.growth;
      delete watch.flightTicks;
      delete watch.landingStrike;
    } else if (kind === pandemoniumId) this.pandemonium = { ...state, hold: 0 };
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
    const s = (this.pandemonium ?? this.alienX ?? this.centipede ?? this.kirin ?? this.jetGigant ?? this.fury)!,
      scene = this.pandemonium ? pandemoniumScene(this.pandemonium) : this.alienX ? alienXScene(this.alienX) : this.centipede ? centipedeScene(this.centipede) : this.kirin ? kirinScene(this.kirin) :
        this.jetGigant ? jetScene(this.jetGigant) : furyScene(s),
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
    const jet = this.jetGigant, kirin = this.kirin, centipede = this.centipede;
    const { alienX, pandemonium } = this;
    const held = pandemonium ?? alienX ?? centipede ?? kirin ?? jet;
    if (held && held.hold > 0) {
      held.hold--;
      return;
    }
    const config = pandemonium ? pandemoniumConfig : alienX ? alienXConfig : centipede ? centipedeConfig : kirin ? kirinConfig : jet ? jetConfig : furyConfig;
    const s = (pandemonium ?? alienX ?? centipede ?? kirin ?? jet ?? this.fury)!,
      t = ++s.tick,
      a = this.fighters[s.attacker],
      b = this.fighters[s.victim];
    this.stageSuper();
    if (kirin && (t === kirinConfig.phases.storm || t === kirinConfig.phases.reveal || t === kirinConfig.phases.dive))
      this.effect("kirinCharge", a.x, a.y - 130, 9);
    const cue = centipede && centipedePhaseCue(t);
    if (cue) this.centipedeEffect(cue, a.x, a.y - 72, 20);
    if (alienX && (t === 12 || t === alienXConfig.phases.reveal || t === alienXConfig.phases.grasp))
      this.effect("power", a.x, a.y - 80, 12);
    const hit = config.hits.find((h) => h.tick === t);
    if (hit) {
      const finish = hit.kind === "explosion" || hit.kind === "ground";
      if (held && "hold" in hit && typeof hit.hold === "number") held.hold = hit.hold;
      const applied = this.damage(b, Math.round(hit.damage * s.scale), finish ? 0 : 1);
      b.combo++;
      this.recordHit(a, b, `${pandemonium ? pandemoniumId : alienX ? alienXId : centipede ? centipedeId : kirin ? "kirin" : jet ? "jet" : "fury"}_${hit.kind}`, applied);
      if (centipede) {
        this.centipedeEffect(hit.kind as CentipedeCue, b.x, finish ? FLOOR : b.y - 73, finish ? 37 : 13, finish ? 3 : 2);
      } else {
        b.gainMeter(2);
        this.effect(
        pandemonium || alienX ? "ultimate" : kirin ? "kirinThunder" : !jet && finish ? "roadExplosion" : jet && (finish || hit.kind === "gigant") ? "ultimate" : "hit",
        b.x,
        b.y - 78,
        finish ? 16 : 8,
        );
      }
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
      this.fury = this.jetGigant = this.kirin = this.centipede = this.alienX = this.pandemonium = undefined;
      if (alienX) {
        b.vx = 14 * s.facing;
        b.vy = -7;
        b.hitLaunch = true;
      }
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
  private stepCapture(inputs: InputFrame[]) {
    const sequence = this.capture!;
    const a = this.fighters[sequence.attacker],
      b = this.fighters[sequence.victim];
    const tick = sequence.tick++;
    if (sequence.kaneki) {
      if (sequence.kaneki.chain) this.stepKanekiChain(sequence, a, b, tick, inputs[a.id], inputs[b.id]);
      else this.stepKanekiCapture(sequence, a, b, tick, inputs[a.id]);
      return;
    }
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
      const ben = sequence.ben;
      const style = ben && benGrabFor(a.benForm, ben.moveId);
      const grab = style || a.grabSequence || cinematics.grab;
      const track = style?.victimTrack ?? a.grabSequence?.victimTrack;
      if (ben && style) {
        a.actionClip = style.clip ?? "grabHold";
        const travel = Math.min(1, tick / Math.max(1, style.hitTick));
        a.x = Math.max(a.stageInset, Math.min(1280 - a.stageInset, ben.origin + ben.direction * (style.carry ?? 0) * travel));
      }
      if (track?.length) {
        let i = 0;
        while (i + 1 < track.length && track[i + 1].tick <= tick) i++;
        const p = track[i],
          q = track[Math.min(i + 1, track.length - 1)],
          t =
            q.tick === p.tick
              ? 0
              : Math.min(1, (tick - p.tick) / (q.tick - p.tick));
        const contactOffset = sequence.contactX ?? p.x;
        const fromX = i === 0 ? contactOffset : p.x;
        const offset = style?.scene === "nightmare"
          ? (sequence.contactX ?? 66) + p.x - 62 + (q.x - p.x) * t
          : fromX + (q.x - fromX) * t;
        const root = style?.scene && ben ? ben.origin : a.x;
        const direction = style?.scene && ben ? ben.direction : a.facing;
        b.x = Math.max(40, Math.min(1240, root + direction * Math.round(offset)));
        const fromY = i === 0 ? sequence.contactY ?? p.y : p.y;
        b.y = FLOOR + Math.round(fromY + (q.y - fromY) * t);
        b.actionClip = p.clip;
        let start = i;
        while (start > 0 && track[start - 1].clip === p.clip) start--;
        b.stateFrame = tick - track[start].tick;
      }
      if (style?.scene === "nightmare" && ben) {
        const toward = Math.max(0, Math.min(1, tick / 6));
        const x = b.x - ben.direction * 66;
        a.x = Math.max(a.stageInset, Math.min(1280 - a.stageInset, ben.origin + (x - ben.origin) * toward));
        a.facing = a.x <= b.x ? 1 : -1;
      }
      if (style?.scene === "hunt" && ben) {
        const progress = tick / grab.duration;
        const side = progress < .53 ? -ben.direction : ben.direction;
        const approach = Math.min(1, tick / 8);
        const x = b.x + side * (progress < .82 ? 52 : 71);
        a.x = Math.max(a.stageInset, Math.min(1280 - a.stageInset,
          ben.origin + (x - ben.origin) * approach));
        a.y = progress < .82 ? Math.min(FLOOR, b.y + 13) : Math.min(FLOOR, b.y + 70);
        a.facing = b.x > a.x ? 1 : -1;
      }
      const strikes = style?.impacts ?? [grab.hitTick];
      if (strikes.includes(tick) && (!style?.impacts || b.combo < (a.data.combatLimits?.maxHits ?? 9))) {
        const applied = this.damage(b, style ? Math.round(grab.damage * sequence.scale / strikes.length) : grab.damage);
        b.combo++;
        this.recordHit(a, b, ben?.moveId ?? "throw", applied);
        this.effect("hit", b.x, b.y - 75, 12);
        if (style) this.events.at(-1)!.ben = style.scene === "nightmare" ? "nightmare" :
          a.benForm?.throwEffect ?? (a.omnitrix?.active === "heatblast" ? "flame" : a.omnitrix?.active === "xlr8" ? "speed" : "power");
        if (ben?.moveId.startsWith("conductor_") && tick === strikes[0] && a.omnitrix)
          this.gainFeedbackCharge(a.omnitrix, ben.moveId.endsWith("medium") ? 16 : 12, "contact");
        this.hitstop = strikes.length > 1 ? 3 : 8;
        if (tick === strikes.at(-1)) { a.gainMeter(10); b.gainMeter(5); }
      }
      if (sequence.tick >= grab.duration) this.endCapture(sequence, a, b);
    }
  }
  private bufferChainChoice(s: KanekiCapture, tick: number, input: InputFrame, defender: InputFrame) {
    const chain = s.chain!;
    if (input.pressed.includes("ultimate") && centipedeConversion(this, this.capture, tick))
      chain.superQueued = true;
    const defense = chainPick(defender.pressed);
    if (canResistChain(chain, tick) && defense && defense !== chain.defenderLast &&
        this.frame >= (chain.nextResistance ?? 0)) {
      chain.nextResistance = this.frame + resistanceInterval;
      if (defense === resistanceButton(chain)) {
        chain.resistance = (chain.resistance ?? 0) + 1;
        if (chain.resistance < resistanceGoal) {
          const b = this.fighters[this.capture!.victim];
          this.effect("chainBind", b.x, b.y - 68, 8);
        }
      }
    }
    chain.defenderLast = defense;
    const pick = chainPick(input.pressed);
    const fresh = pick && pick !== chain.last ? pick : undefined;
    chain.last = pick;
    const age = tick - chain.since;
    if (chain.phase === "connected" || chain.phase === "choice1") {
      if (age < chainWindow(chain)) chain.queued ??= fresh;
      return;
    }
    const preparing = chain.phase === "action" && !!s.route &&
      age >= kaguneRoutes[s.route].duration - chainBufferTicks;
    const choosing = chain.phase === "choice2" && age < chainWindow(chain, true);
    if (!preparing && !choosing) return;
    if (fresh && chainFinisher(chain, fresh, s.route)) chain.queued ??= fresh;
    if (choosing && chain.origin === "universal" && !chain.escape && defense)
      chain.escape = { button: defense, tick };
  }

  private stepKanekiChain(sequence: CaptureSequence, a: Fighter, b: Fighter, tick: number, input: InputFrame, defender: InputFrame) {
    const s = sequence.kaneki!, chain = s.chain!;
    this.bufferChainChoice(s, tick, input, defender);
    const escape = chain.escape;
    const read = chain.phase === "choice2" && tick - chain.since >= chainBufferTicks &&
      chain.queued && escape?.button === chain.queued && tick - escape.tick <= chainEscapeTicks;
    if ((chain.resistance ?? 0) >= resistanceGoal || read) {
      this.escapeKanekiChain(a, b);
      return;
    }
    const conversion = chain.superQueued && centipedeConversion(this, sequence, tick);
    if (conversion) {
      a.meter -= centipedeConfig.cost;
      this.beginStagedSuper(a, b, centipedeId, conversion);
      return;
    }
    if (chain.phase === "opener" || chain.phase === "outro") {
      this.stepKanekiTechniqueCapture(sequence, a, b, tick - chain.since, s.specialId!);
      return;
    }
    if (chain.phase === "connected") {
      if (tick < chainWindup) {
        a.stateFrame = b.stateFrame = tick;
        return;
      }
      chain.phase = "choice1";
      chain.since = tick;
    }
    if (chain.phase === "choice1") {
      const age = tick - chain.since;
      a.actionClip = chain.origin === "fourSwords" ? "swordsThrow" : "grabHold";
      a.stateFrame = chain.origin === "fourSwords" ? 2 : age;
      if (!chain.queued && age < chainWindow(chain)) return;
      if (directChain(chain)) {
        if (!chain.queued) {
          chain.phase = "outro";
          chain.since = tick - (chain.origin === "fourSwords" ? swordProfile(chain.rank).strikes[2] + 1 : 0);
          this.stepKanekiTechniqueCapture(sequence, a, b, tick - chain.since, s.specialId!);
          return;
        }
        this.beginKanekiFinisher(chain, chainFinisher(chain, chain.queued)!, a, b, tick);
      } else {
        s.route = chain.queued === "light" ? "pull" : chain.queued === "heavy" ? "launch" : "throw";
        s.fallback = !chain.queued;
        chain.queued = undefined;
        chain.phase = "action";
        chain.since = tick;
      }
    }
    const route = s.route;
    if (chain.phase === "action" && route) {
      const age = tick - chain.since;
      const config = kaguneRoutes[route];
      const pivot = chain.origin === "kaguneGrab" && route === "throw";
      a.actionClip = route === "pull" ? "kagunePull" : route === "launch" ? "kaguneLaunch" : "kaguneThrow";
      a.stateFrame = b.stateFrame = age;
      const position = kaguneVictimPosition(sequence, a.x, a.y, age);
      const progress = age / (config.duration - 1);
      b.x = pivot ? chainBoundX(s.x + s.direction * Math.round(18 * progress)) : position.x;
      b.y = pivot ? Math.round(s.y - (29 * progress + 14 * progress * (1 - progress))) :
        route === "launch" ? position.y - Math.round(88 * progress ** 1.5) : position.y;
      b.actionClip = age < 3 ? "grabbed" : route === "launch" ? "launched" : route === "throw" ? "damageAir" : "damageMedium";
      if (age < config.duration - 1) return;
      const simpleThrow = route === "throw" && !pivot;
      this.kanekiChainDamage(sequence, a, b, a.actionClip, pivot ? 19 : s.fallback ? 78 : config.damage, route === "launch", simpleThrow);
      this.effect("hit", b.x, b.y - 74, 12);
      this.hitstop = simpleThrow ? 7 : 4;
      if (simpleThrow) {
        this.releaseKanekiChain(a, b, 15, config.push, config.launch);
        return;
      }
      chain.phase = "choice2";
      chain.since = tick + 1;
      return;
    }
    if (chain.phase === "choice2") {
      const age = tick - chain.since;
      if ((!chain.queued && age < chainWindow(chain, true)) || age < chainBufferTicks) return;
      const finish = chain.queued ? chainFinisher(chain, chain.queued, route) : undefined;
      const selected = finish && chainFinishes[finish];
      const remaining = kaguneGrabLimit - (this.frame - chain.started);
      const fits = chain.origin !== "kaguneGrab" || !selected ||
        remaining > selected.keys.at(-1)![0] + selected.stop;
      this.beginKanekiFinisher(chain, fits ? finish ?? "release" : "release", a, b, tick);
    }
    const finishId = chain.finish!;
    const config = chainFinishes[finishId];
    const age = tick - chain.since;
    const pose = chainPose(finishId, chain.from!, age, s.direction, FLOOR);
    a.x = pose.actor.x;
    a.y = pose.actor.y;
    a.actionClip = pose.clip;
    a.stateFrame = age;
    b.x = pose.victim.x;
    b.y = pose.victim.y;
    b.facing = b.x >= a.x ? -1 : 1;
    b.stateFrame = age;
    b.actionClip = pose.victimClip;
    const air = route === "launch" || !!config.slam || config.follow === "air";
    const extra = config.beats?.find(beat => beat.at === age);
    const limits = a.data.combatLimits!;
    if (extra && b.combo < limits.maxHits - 1 && (!air || b.comboAirHits < limits.maxAirHits - 1)) {
      this.kanekiChainDamage(sequence, a, b, finishId, extra.damage, air, false);
      this.effect("hit", b.x, b.y - 74, 10);
    }
    if (age === config.hit) {
      this.kanekiChainDamage(sequence, a, b, finishId, config.damage, air, true);
      chain.landed = true;
      const life = config.slam ? 26 : 15;
      this.events.push({ kind: "chainImpact", chain: finishId, strength: config.slam ? 3 : 2,
        life, total: life, blocked: false, x: b.x, y: config.slam ? FLOOR : b.y - 72 });
      this.hitstop = config.stop;
    }
    if (age >= pose.end) {
      const limited = b.combo >= limits.maxHits || b.comboAirHits >= limits.maxAirHits || b.comboAge >= limits.maxTicks;
      this.releaseKanekiChain(a, b, config.recovery, config.push, config.launch, false, limited ? undefined : config.follow);
    }
  }

  private beginKanekiFinisher(chain: Chain, finish: ChainRoute, a: Fighter, b: Fighter, tick: number) {
    chain.finish = finish;
    chain.phase = "finisher";
    chain.since = tick;
    chain.from = { actor: { x: a.x, y: a.y }, victim: { x: b.x, y: b.y } };
    this.events.push({ kind: "chainWhoosh", chain: finish, x: a.x, y: a.y - 85,
      life: 15, total: 15, blocked: false });
  }

  private escapeKanekiChain(a: Fighter, b: Fighter) {
    this.effect("chainEscape", b.x, b.y - 73, 15);
    this.hitstop = 0;
    this.releaseKanekiChain(a, b, 22, 2, 1, true);
  }

  private kanekiChainDamage(sequence: CaptureSequence, a: Fighter, b: Fighter, move: string, damage: number, air: boolean, final: boolean) {
    const chain = sequence.kaneki!.chain!;
    const scale = Math.max(combatPace.combo.minimumDamageScale,
      sequence.scale - Math.max(0, b.combo - chain.initialCombo) * combatPace.combo.damageStep);
    const applied = this.damage(b, Math.round(damage * scale), final ? 0 : 1);
    if (!b.combo) b.comboAge = b.comboAirHits = 0;
    b.combo++;
    if (air) b.comboAirHits++;
    this.recordHit(a, b, move, applied);
    a.gainMeter(5);
    b.gainMeter(3);
  }

  private releaseKanekiChain(a: Fighter, b: Fighter, recovery: number, push: number, launch: number,
    escaped = false, follow?: "ground" | "air") {
    a.setState("throwRecover");
    a.kanekiSpecialRecovery = recovery;
    a.actionClip = b.actionClip = "";
    if (follow === "air" && !a.airborne && b.health > 0) {
      a.attack("captureLaunchLink");
      a.connected = a.hitConfirmed = true;
    }
    this.applyReaction(b, { blocked: false, crouched: false, strength: escaped ? 1 : 3,
      stun: escaped ? 8 : follow === "ground" ? 24 : 36, vx: a.facing * push, vy: launch,
      launch: follow === "air", knockdown: !escaped && !follow });
    a.buffer.clear();
    b.buffer.clear();
    this.capture = undefined;
    this.checkRoundEnd();
  }

  private stepKanekiCapture(sequence: CaptureSequence, a: Fighter, b: Fighter, tick: number, input: InputFrame) {
    const s = sequence.kaneki!;
    const technique = kanekiTechnique(s.specialId);
    if (technique && technique.family !== "kaguneGrab") {
      this.stepKanekiTechniqueCapture(sequence, a, b, tick, technique.id);
      return;
    }
    b.stateFrame = tick;
    if (!s.route) {
      s.pending ??= kaguneChoice(input.pressed);
      if (tick < captureWindup) {
        a.stateFrame = tick;
        return;
      }
      a.actionClip = "grabHold";
      a.stateFrame = tick - captureWindup;
      if (!s.pending && tick < captureWindup + captureWindow) return;
      s.route = s.pending ?? "throw";
      s.fallback = !s.pending;
      s.selectedAt = tick;
    }
    const route = s.route;
    const config = kaguneRoutes[route];
    const age = tick - s.selectedAt!;
    a.actionClip = route === "pull" ? "kagunePull" : route === "throw" ? "kaguneThrow" : "kaguneLaunch";
    a.stateFrame = age;
    const position = kaguneVictimPosition(sequence, a.x, a.y, age);
    b.x = position.x;
    b.y = position.y;
    b.stateFrame = age;
    b.actionClip = age < 3 ? "grabbed"
      : route === "pull" ? "damageMedium" : route === "launch" ? "launched" : "damageAir";
    if (age < config.duration - 1) return;
    const damage = this.damage(b, Math.round((s.fallback ? 78 : config.damage) * sequence.scale));
    if (!b.combo) b.comboAge = b.comboAirHits = 0;
    b.combo++;
    if (s.source === "air" || route === "launch") b.comboAirHits++;
    this.recordHit(a, b, a.actionClip, damage);
    this.effect("hit", b.x, b.y - 74, 12);
    this.hitstop = route === "pull" ? 4 : 7;
    a.gainMeter(8);
    b.gainMeter(5);
    a.setState(a.airborne ? "air" : route === "throw" ? "throwRecover" : "idle");
    a.actionClip = "";
    if (!a.airborne && route !== "throw") {
      a.attack(route === "pull" ? "capturePullLink" : "captureLaunchLink");
      a.connected = a.hitConfirmed = true;
    }
    b.actionClip = "";
    this.applyReaction(b, { blocked: false, crouched: false, strength: route === "pull" ? 1 : 3,
      stun: config.stun, vx: s.direction * config.push, vy: config.launch,
      launch: route === "launch", knockdown: config.knockdown });
    a.buffer.clear();
    b.buffer.clear();
    this.capture = undefined;
    this.checkRoundEnd();
  }
  private stepKanekiTechniqueCapture(sequence: CaptureSequence, a: Fighter, b: Fighter, tick: number, move: string) {
    const s = sequence.kaneki!;
    const scene = kanekiSpecialScene(move, tick, a, s, s.direction);
    a.actionClip = scene.clip;
    a.stateFrame = Math.max(0, scene.clipTick);
    b.x = Math.max(40, Math.min(1240, Math.round(scene.victim.x)));
    b.y = Math.min(FLOOR, Math.round(scene.victim.y));
    b.stateFrame = tick;
    b.actionClip = scene.hurt;

    if (scene.snap) {
      this.events.push({ kind: "knuckleSnap", audioOnly: true, knuckleFrame: this.frame,
        x: a.x + a.facing * 35, y: a.y - 100, life: 6, blocked: false });
    }
    if (scene.impact) {
      const damage = this.damage(b, Math.round(scene.impact * sequence.scale), scene.strength === 3 || scene.clip.startsWith("rushFinish") ? 0 : 1);
      if (!b.combo) b.comboAge = b.comboAirHits = 0;
      b.combo++;
      this.recordHit(a, b, move, damage);
      this.events.push({ kind: "hit", strength: scene.strength,
        x: b.x - s.direction * 14, y: b.y - 68, life: 14, total: 14, blocked: false });
      this.hitstop = Math.max(this.hitstop, scene.stop);
      if (s.chain?.phase === "opener" && scene.strength === 3) {
        s.chain.phase = b.health > 0 && b.combo < a.data.combatLimits!.maxHits ? "choice1" : "outro";
        s.chain.since = s.chain.phase === "choice1" ? sequence.tick : 0;
        return;
      }
    }
    if (tick < scene.end - 1) return;
    a.setState("throwRecover");
    a.kanekiSpecialRecovery = scene.recovery;
    a.actionClip = "";
    b.actionClip = "";
    this.applyReaction(b, { blocked: false, crouched: false, strength: 3,
      stun: 34, vx: s.direction * scene.push, vy: scene.lift, launch: true, knockdown: true });
    a.buffer.clear();
    b.buffer.clear();
    this.capture = undefined;
    this.checkRoundEnd();
  }
  private endCapture(sequence: CaptureSequence, a: Fighter, b: Fighter) {
    a.setState(
      sequence.kind === "ultimate" ? "ultimateRecover" : "throwRecover",
    );
    const conductor = sequence.ben?.moveId.startsWith("conductor_") ? sequence.ben.moveId : "";
    a.actionClip = conductor ? conductor + "Recover" : "";
    b.setState("hitstun");
    b.actionClip = "";
    const style = sequence.ben && benGrabFor(a.benForm, sequence.ben.moveId);
    b.knockedDown = style ? style.knockdown !== false : true;
    b.hitCrouched = false;
    b.hitLaunch = sequence.kind === "grab" && b.knockedDown;
    b.reactionStrength = 3;
    const release =
      sequence.kind === "grab" ? (style?.release ?? a.grabSequence?.release) : undefined;
    if (style?.scene === "hunt") a.y = FLOOR;
    if (style?.pursuit) {
      a.setState("idle");
      a.vy = -12.5;
      a.airChaseTicks = 15;
      a.setState("air");
    }
    b.stun = release?.stun ?? 35;
    b.vx = a.facing * (style?.reverse ? -1 : 1) * (release?.vx ?? 8);
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
        f.chill = undefined;
        if (f.omnitrix) {
          f.omnitrix.objects.length = 0;
          delete f.omnitrix.echoClones;
          if (f.omnitrix.nrgReleased) {
            f.omnitrix.nrgReleased = false;
            f.omnitrix.nrgTicks = 0;
          }
        }
        f.setState(winner < 0 ? "idle" : i === winner ? "victory" : "ko");
      });
      this.phase = "roundEnd";
      this.phaseFrames = 150;
    }
  }
}
