import { assetBase } from "../asset-base";
import { drawTestArena } from "./arena";
import benArt from "../data/ben-art.json";
import { benAnimation, benAnimationSets, benFlameAnchor, feedbackHeadAnchor, feedbackStormTips } from "./ben-animations";
import { drawBenAlienFx, drawBenSilhouette } from "./ben-alien-fx";
import { benReformSheets, drawBenAttackFx, drawBenContact, drawBenFields, drawEchoClones, drawStage7Core, drawFeedbackCables, drawFeedbackGrip, drawBenChill, drawSpectralArms, drawHeldBenCar, drawBenGhostGround } from "./ben-combat-fx";
import { benGhostDepth } from "../engine/ben-rework";
import { benAliens, benId, omnitrixCanBrowse, omnitrixHoldTicks } from "../engine/ben-omnitrix";
import { drawOmnitrixFlash, drawOmnitrixHud } from "./ben-omnitrix-hud";
import { drawGokuSpecials, gokuFxSheets } from "./goku-special-fx";
import { gokuInvisible } from "../engine/goku-specials";
import { centipedeConfig, centipedeConversion, centipedeName, centipedeScene } from "../engine/kaneki-centipede";
import { drawCentipedeBackdrop, drawCentipedeWorld } from "./kaneki-centipede-fx";
import { furyScene } from "../engine/goku-fury";
import { drawFury, furyFxSheets } from "./goku-fury-fx";
import { FLOOR, type Match } from "../engine/combat";
import { Animator, metadata, type AnimationData } from "./animator";
import dioAnimations from "../data/dio-animations.json";
import { gokuAnimations } from "./goku-animations";
import { kanekiAnimations } from "./kaneki-presentation";
import { drawKagune } from "./kagune";
import { captureWindow, captureWindup, kanekiTechniqueCaptureTick } from "../engine/kaneki-combat";
import { canResistChain, chainButtons, chainFinisher, chainFinishes, chainNames, chainWindow, directChain, kaguneGrabLimit, resistanceButton, resistanceGoal } from "../engine/kaneki-chain";
import { drawChainEffects } from "./kaneki-chain-effects";
import { kanekiSpecialNames, kanekiSpecialScene, kanekiTechnique } from "../engine/kaneki-specials";
import { sasukeAnimations, sasukeWingedSheets } from "./sasuke-animations";
import { chidoriCamera, drawSasukeContact, drawSasukeProjectiles, drawSasukeTechnique, goryukaHeadSheet, sasukeEffectsSheet } from "./sasuke-special-fx";
import { drawCurseHud, drawSasukeCurseFX } from "./sasuke-curse-fx";
import { kirinConfig, kirinId, kirinScene } from "../engine/sasuke-kirin";
import { drawKirinFlash, drawKirinStorm, drawKirinWorld, kirinEffectsSheets } from "./sasuke-kirin-fx";
import { drawSasukeCut } from "./sasuke-fx";
import { luffyAnimations } from "./luffy-animations";
import { luffyAttackLimbs } from "../engine/luffy-specials";
import { jetId, jetScene } from "../engine/luffy-jet-gigant";
import { drawJetActor, drawJetImpact, drawJetScreen, jetBodyRecoil, jetCamera, jetFxSheets } from "./luffy-jet-fx";
import { luffyGrabLimb } from "../engine/luffy-secondary";
import { paintElastic } from "./elastic";
import { paintLuffyImpacts, paintLuffyTrails } from "./luffy-special-fx";
import worldAnimations from "../data/the-world-animations.json";
import { FighterPresentation } from "./presentation";
import { drawCombatDebug } from "./debug";
import { isSuperMove, poseAt } from "../engine/moves";
import { worldCapsule } from "../engine/geometry";
import type { Rect } from "../engine/types";
import { drawEffects } from "./effects";
import { roadConfig, roadScene } from "../engine/road-roller";
import {
  objectData,
  fxData,
  drawRoadObject,
  drawRoadBackdrop,
  drawRoadEffects,
} from "./road-roller";
import {
  drawKnives,
  drawTimeTint,
  drawTemporalEffects,
} from "./dio-special-fx";
import { HealthBar } from "./hud";
import { DamageTracker } from "../engine/stats";
import { swapPalette, swapGokuPalette, type AlternatePalette } from "./palette";
import type { Fighter } from "../engine/combat";
import { combatPace } from "../engine/pace";
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private sprites = new Map<string, HTMLImageElement>();
  private presentations = [
    new FighterPresentation(),
    new FighterPresentation(),
  ];
  debug = false;
  effects = true;
  cameraShake = true;
  superKey = "R";
  chainKeys: readonly string[] = ["J", "K", "L"];
  inspectionZoom = 1;
  inspectionTarget?: 0 | 1;
  opponentPalette: "cyan" | AlternatePalette = "cyan";
  opponentLabel = "02 / BOT";
  contextLabel = "MELHOR DE 3";
  localSeat: 0 | 1 = 0;
  online = false;
  private healthBars = [new HealthBar(), new HealthBar()];
  private actors: Fighter[] = [];
  private frozenActors = new Set<Fighter>();
  private standAnimations = new Map<Fighter, Animator>();
  private feedback = new DamageTracker();
  private variants = new Map<string, HTMLCanvasElement>();
  private loading: Promise<void>;
  private preparation = 0;
  private fxImage = new Image();
  constructor(
    public canvas: HTMLCanvasElement,
    spriteBase = `${assetBase}sprites/`,
    previewAnimations: AnimationData[] = [],
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.fxImage.src = `${spriteBase}fx/samurai-fx.png`;
    const sheets = new Set<string>();
    sheets.add("fx/dio-specials.png");
    sheets.add(sasukeEffectsSheet);
    sheets.add(goryukaHeadSheet);
    for (const sheet of kirinEffectsSheets) sheets.add(sheet);
    for (const sheet of gokuFxSheets) sheets.add(sheet);
    for (const sheet of benReformSheets) sheets.add(sheet);
    for (const sheet of [...furyFxSheets, ...jetFxSheets]) sheets.add(sheet);
    for (const data of [
      metadata,
      dioAnimations,
      gokuAnimations,
      luffyAnimations,
      sasukeAnimations,
      kanekiAnimations,
      ...benAnimationSets,
      ...previewAnimations,
      worldAnimations,
      objectData,
      fxData,
    ] as AnimationData[]) {
      sheets.add(data.sheet);
      for (const clip of Object.values(data.clips))
        for (const sheet of [clip.sheet, clip.player2Sheet])
          if (sheet) sheets.add(sheet);
    }
    const loads: Promise<void>[] = [];
    for (const sheet of sheets) {
      const image = new Image();
      loads.push(
        new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error(`Não foi possível carregar ${sheet}`));
        }),
      );
      image.src = `${spriteBase}${sheet}`;
      this.sprites.set(sheet, image);
    }
    this.loading = Promise.all(loads).then(() => {});
    // Keep load failures observable by preparePalette without an unhandled
    // rejection in the animation lab, which also loads its own manifest.
    void this.loading.catch(() => {});
  }
  async preparePalette(palette: "cyan" | AlternatePalette) {
    const generation = ++this.preparation;
    await this.loading;
    if (generation !== this.preparation) return;
    for (const key of this.variants.keys())
      if (!key.startsWith(`${palette}:`)) this.variants.delete(key);
    for (const [name, image] of this.sprites) {
      if (!name.startsWith("goku/") || this.variants.has(`${palette}:${name}`))
        continue;
      if (generation !== this.preparation) return;
      const tile = document.createElement("canvas");
      tile.width = image.naturalWidth;
      tile.height = image.naturalHeight;
      const g = tile.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.drawImage(image, 0, 0);
      const pixels = g.getImageData(0, 0, tile.width, tile.height);
      swapGokuPalette(pixels.data);
      g.putImageData(pixels, 0, 0);
      this.variants.set(`${palette}:${name}`, tile);
      // Also works in paused, tick-stepped inspectors: no presentation-clock
      // timer is required to finish loading a character palette.
      await Promise.resolve();
    }
    if (palette !== "cyan") {
      for (const [name, image] of this.sprites) {
        // Arcade opponents use Samurai palettes. Companion transition atlases
        // are independent and never need these extra full-size canvas copies.
        if (!name.startsWith("samurai/")) continue;
        if (generation !== this.preparation) return;
        if (name.includes("-p2") || this.variants.has(`${palette}:${name}`))
          continue;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        swapPalette(pixels.data, palette);
        ctx.putImageData(pixels, 0, 0);
        this.variants.set(`${palette}:${name}`, canvas);
        // Recolour only while loading the next confrontation, with time for
        // the browser to paint between atlases. Nothing allocates in combat.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }
  resetAnimations() {
    this.presentations = [new FighterPresentation(), new FighterPresentation()];
    this.actors = [];
    this.frozenActors.clear();
    this.standAnimations.clear();
    this.feedback.reset();
    this.healthBars.forEach((bar) => bar.reset());
  }
  tick(match: Match, benPreview?: Animator) {
    match.fighters.forEach((f, i) => {
      if (this.actors[i] !== f) {
        this.healthBars[i].reset(f.health / f.data.health);
        this.actors[i] = f;
        this.presentations[i] = new FighterPresentation(
          f.data.id === "dio"
            ? dioAnimations
            : f.data.id === "goku"
              ? gokuAnimations
              : f.data.id === "luffy"
                ? luffyAnimations
                : f.data.id === "sasuke"
                  ? sasukeAnimations
                  : f.data.id === "kaneki" ? kanekiAnimations
                    : f.data.id === benId ? benArt : metadata,
        );
        if (f.stand) this.standAnimations.set(f, new Animator(worldAnimations));
      }
      this.healthBars[i].tick(f.health / f.data.health);
      if (
        !match.cinematicActive &&
        match.temporal.isFrozen(i) &&
        this.frozenActors.has(f)
      )
        return;
      if (!match.cinematicActive && match.temporal.isFrozen(i))
        this.frozenActors.add(f);
      else this.frozenActors.delete(f);
      this.presentations[i].tick(f, f.data.id === benId ? benPreview : undefined);
      if (f.stand) {
        const animation = this.standAnimations.get(f)!;
        animation.update(f.stand.s.clip);
        animation.seekTick(f.stand.s.clipTick);
      }
    });
    this.feedback.tick(match);
  }
  draw(match: Match) {
    const road = match.roadRoller,
      scene = road ? roadScene(road) : undefined;
    const fury = match.fury,
      furyStage = fury ? furyScene(fury) : undefined;
    const jet = match.jetGigant,
      jetStage = jet ? jetScene(jet) : undefined;
    const kirin = match.kirin, kirinStage = kirin ? kirinScene(kirin) : undefined;
    const centipede = match.centipede, kakuja = centipede ? centipedeScene(centipede) : undefined;
    const kanekiCapture = match.capture?.kaneki;
    const technique = kanekiTechnique(kanekiCapture?.specialId);
    const grabber = match.capture && match.fighters[match.capture.attacker];
    const captureTick = Math.max(0, (match.capture?.tick ?? 0) - 1);
    const chain = kanekiCapture?.chain;
    const finish = chain?.finish ? chainFinishes[chain.finish] : undefined;
    const captive = match.capture && match.fighters[match.capture.victim];
    const age = chain ? captureTick - chain.since : 0;
    const travel = finish ? Math.max(0, Math.min(1, age / 9, (finish.keys.at(-1)![0] - age) / 9)) : 0;
    const height = grabber && captive ? FLOOR - Math.min(grabber.y, captive.y) : 0;
    const scale = 1 + travel * Math.max(0, .12 - height / 3500);
    const viewWidth = 640 / scale;
    const chainCamera = grabber && captive && travel > 0 ? {
      x: Math.max(viewWidth, Math.min(1280 - viewWidth, (grabber.x + captive.x) / 2)),
      y: 360 - height * .20 * travel, scale, shakeX: 0, shakeY: 0,
    } : undefined;

    const techniqueTick = match.capture && kanekiTechniqueCaptureTick(match.capture);
    const kanekiScene = technique && techniqueTick !== undefined && grabber && kanekiCapture
      ? kanekiSpecialScene(technique.id, techniqueTick, grabber, kanekiCapture, kanekiCapture.direction)
      : undefined;
    const spectral = match.capture?.ben?.moveId.startsWith("ghostPhase_") ? match.capture : undefined;
    const leap = match.fighters.find(f => f.state === "attack" && f.moveId === "colossal_medium" && f.airborne);
    const reveal = spectral ? Math.min(1, spectral.tick / 8, Math.max(0, (38 - spectral.tick) / 9)) : 0;
    const benZoom = 1 + reveal * .24;
    const benView = 640 / benZoom;
    const benPadding = Math.round(reveal * 125);
    const benCamera = spectral && reveal > 0 && grabber && captive ? {
      x: Math.max(benView - benPadding, Math.min(1280 - benView + benPadding, (grabber.x + captive.x) * .5)),
      y: 360 + reveal * 45, scale: benZoom, shakeX: 0, shakeY: 0,
    } : leap ? {
      x: 640, y: 360 - Math.min(50, (FLOOR - leap.y) * .24),
      scale: 1, shakeX: 0, shakeY: 0,
    } : undefined;
    const stagedCamera = kakuja?.camera ?? kirinStage?.camera ?? (jet && jetStage ? jetCamera(jetStage, jet) : furyStage?.camera)
      ?? chainCamera ?? (this.effects ? chidoriCamera(match) ?? benCamera : undefined);
    const self = match.fighters[this.localSeat],
      other = match.fighters[1 - this.localSeat];
    this.canvas.dataset.animation =
      this.presentations[this.localSeat].animator.clipName;
    this.canvas.dataset.frame = String(
      this.presentations[this.localSeat].animator.frame(),
    );
    this.canvas.dataset.animationTick = String(
      this.presentations[this.localSeat].animator.elapsedTicks,
    );
    this.canvas.dataset.physicsState = self.state;
    this.canvas.dataset.rootY = String(self.y);
    this.canvas.dataset.rootX = String(self.x);
    this.canvas.dataset.rivalX = String(other.x);
    this.canvas.dataset.move = self.moveId;
    this.canvas.dataset.phase = self.attackPhase ?? "none";
    this.canvas.dataset.combo = String(other.combo);
    this.canvas.dataset.targetHealth = String(other.health);
    this.canvas.dataset.hitstop = String(match.hitstop);
    this.canvas.dataset.centipedePhase = kakuja?.phase ?? "";
    this.canvas.dataset.centipedeArmor = String(kakuja?.armor ?? 0);
    this.canvas.dataset.centipedeSource = centipede?.source ?? "";
    this.canvas.dataset.centipedeTick = String(centipede?.tick ?? -1);
    this.canvas.dataset.capture = centipede ? "centipede" : kirin ? "kirin" : jet ? "jetGigant" : fury
      ? "gokuFury"
      : road
        ? "roadRoller"
        : (match.capture?.kind ?? "none");
    this.canvas.dataset.captureRoute = kanekiCapture?.route ?? (kanekiCapture ? (kanekiScene ? technique!.family : "hold") : "");
    this.canvas.dataset.chainKeys = this.chainKeys.join("/");
    this.canvas.dataset.chainPhase = chain?.phase ?? "";
    this.canvas.dataset.chainOrigin = chain?.origin ?? "";
    this.canvas.dataset.chainRemaining = String(chain?.origin === "kaguneGrab" ? Math.max(0, kaguneGrabLimit - (match.frame - chain.started)) : "");
    this.canvas.dataset.chainResistance = String(chain?.resistance ?? "");
    this.canvas.dataset.chainFinish = chain?.finish ?? "";
    this.canvas.dataset.chainHeight = String(chain ? height : 0);
    this.canvas.dataset.knucklePose = String(kanekiScene?.snapPose ?? "");
    this.canvas.dataset.knuckleFrame = String(match.events.find(e => e.kind === "knuckleSnap")?.knuckleFrame ?? "");
    this.canvas.dataset.meter = String(self.meter);
    this.canvas.dataset.playerHealth = String(self.health);
    this.canvas.dataset.p1Health = String(match.fighters[0].health);
    this.canvas.dataset.p1Curse = match.fighters[0].sasukeCurse?.phase ?? "ready";
    this.canvas.dataset.p2Curse = match.fighters[1].sasukeCurse?.phase ?? "ready";
    this.canvas.dataset.p2Health = String(match.fighters[1].health);
    this.canvas.dataset.localSeat = String(this.localSeat);
    this.canvas.dataset.matchPhase = match.phase;
    this.canvas.dataset.round = String(match.round);
    this.canvas.dataset.playerX = String(self.x);
    this.canvas.dataset.targetX = String(other.x);
    this.canvas.dataset.targetState = other.state;
    this.canvas.dataset.targetAnimation =
      this.presentations[1 - this.localSeat].animator.clipName;
    this.canvas.dataset.targetFrame = String(
      this.presentations[1 - this.localSeat].animator.frame(),
    );
    this.canvas.dataset.palette = this.opponentPalette;
    this.canvas.dataset.healthBar = String(
      this.healthBars[this.localSeat].value,
    );
    this.canvas.dataset.damageTrail = String(
      this.healthBars[this.localSeat].trail,
    );
    this.canvas.dataset.inputDirection = String(self.input.direction);
    this.canvas.dataset.inputDown = String(self.input.down);
    Object.assign(this.canvas.dataset, {
      character: self.data.id,
      vx: String(self.vx),
      vy: String(self.vy),
      companionX: self.stand ? String(self.stand.transform.x) : "",
      companionY: self.stand ? String(self.stand.transform.y) : "",
      companionDepth: self.stand ? String(self.stand.transform.depth) : "",
      companionClip: self.stand?.s.clip ?? "",
    });
    this.canvas.dataset.companionFrame = String(
      this.standAnimations.get(self)?.frame() ?? 0,
    );
    Object.assign(this.canvas.dataset, {
      temporalOwner: String(match.temporal.s.owner),
      timeRemaining: String(match.temporal.s.remaining),
      timeUses: String(match.temporal.s.ledger[self.id].uses),
      timeCooldown: String(match.temporal.s.ledger[self.id].cooldown),
      temporalDamage: String(match.temporal.s.damage),
      temporalHits: String(match.temporal.s.hits),
      kiProjectiles: String(
        match.kiProjectiles.filter((p) => p.state === "flight").length,
      ),
      kiImpacts: String(
        match.kiProjectiles.filter((p) => p.state === "impact").length,
      ),
      beams: String(match.beams.filter((b) => b.state === "active").length),
      beamHits: String(match.beams.reduce((s, b) => s + b.hitIds.length, 0)),
      invisible: String(gokuInvisible(self)),
      teleportLock: String(self.gokuTeleportLock),
      airTeleportsUsed: String(self.gokuAirTeleportsUsed),
      airTeleportAvailable: String(
        self.data.id === "goku" &&
          self.gokuAirTeleportsUsed <
            combatPace.airTeleport.maximumPerJumpOrCombo,
      ),
      hitConfirmed: String(self.hitConfirmed),
      comboAirHits: String(other.comboAirHits),
      projectiles: String(match.projectiles.length),
      playerFrozen: String(match.temporal.isFrozen(self.id)),
      roadTick: String(road?.tick ?? -1),
      roadPhase: scene?.phase ?? "none",
      rollerX: String(scene?.object.x ?? 0),
      rollerY: String(scene?.object.y ?? 0),
      rollerVisible: String(scene?.object.visible ?? false),
      kirinTick: String(kirin?.tick ?? -1),
      kirinPhase: kirinStage?.phase ?? "none",
      kirinDragon: String(kirinStage?.dragon.visible ?? false),
      kirinCursed: String(kirin?.cursed ?? false),
      kirinVariant: kirin ? (kirin.cursed ? "black" : "blue") : "none",
      sasukeStormLevel: String(match.sasukeStormUntil > match.combatFrame ? match.sasukeStormLevel : 0),
      jetTick: String(jet?.tick ?? -1),
      jetPhase: jetStage?.phase ?? "none",
      jetCel: jetStage?.cel ?? "none",
      jetFist: String(jetStage?.limbs.find(limb => limb.giant !== undefined)?.giant ?? -1),
      jetHold: String(jet?.hold ?? 0),
      furyTick: String(fury?.tick ?? -1),
      furyPhase: furyStage?.phase ?? "none",
      furyHidden: String(furyStage?.attacker.hidden ?? false),
      transformed: String(
        (self.data.id === "goku" &&
          self.state === "cinematic" &&
          !!fury &&
          fury.tick < 425) ||
          (self.moveId === "ssj1_fury" &&
            self.stateFrame >= 73 &&
            self.stateFrame < 153),
      ),
      cameraZoom: String(
        stagedCamera?.scale ?? scene?.camera.scale ?? this.inspectionZoom,
      ),
      cameraShake: String(
        stagedCamera?.shakeX ?? scene?.camera.shakeX ?? 0,
      ),
    });
    const c = this.ctx;
    const heavy = match.events.find(
      (e) =>
        !e.blocked &&
        e.strength === 3 &&
        (e.total ?? 16) - e.life < combatPace.feedback.heavyShakeTicks,
    );
    const ordinaryShake =
      this.cameraShake && !match.cinematicActive && heavy
        ? (match.frame % 2 ? 1 : -1) * combatPace.feedback.heavyShakePixels
        : 0;
    this.canvas.dataset.impactShake = String(this.effects ? ordinaryShake : 0);
    c.imageSmoothingEnabled = false;
    if (this.inspectionZoom > 1 || match.cinematicActive || stagedCamera) {
      c.fillStyle = "#101b2b";
      c.fillRect(0, 0, 1280, 720);
    }
    c.save();
    if (this.effects && ordinaryShake) c.translate(ordinaryShake, 0);
    if (stagedCamera) {
      const cam = stagedCamera;
      c.translate(640 + (this.cameraShake ? cam.shakeX : 0), 360 + (this.cameraShake ? cam.shakeY : 0));
      c.scale(cam.scale, cam.scale);
      c.translate(-Math.round(cam.x), -Math.round(cam.y));
    } else if (scene) {
      const cam = scene.camera;
      c.translate(640 + (this.cameraShake ? cam.shakeX : 0), cam.anchorY + (this.cameraShake ? cam.shakeY : 0));
      c.scale(cam.scale, cam.scale);
      c.translate(-Math.round(cam.x), -Math.round(cam.y));
    } else if (
      this.inspectionZoom > 1 &&
      (!match.capture || !!match.capture.kaneki ||
        (match.capture.kind === "grab" &&
          (self.data.id === "goku" || self.data.id === "luffy")))
    ) {
      const z = Math.max(1, this.inspectionZoom / Math.max(self.benScale, other.benScale)),
        focus =
          this.inspectionTarget === undefined
            ? undefined
            : match.fighters[this.inspectionTarget],
        cx = Math.round(focus?.x ?? (self.x + other.x) / 2),
        cy = Math.round(
          Math.min(
            FLOOR,
            (focus?.y ?? Math.min(self.y, other.y)) - 185 + 480 / z,
          ),
        );
      c.translate(640, FLOOR);
      c.scale(z, z);
      c.translate(-cx, -cy);
    }
    drawTestArena(c, benPadding);
    const nightmare = spectral || match.fighters.some(f => f.state === "attack" && f.move?.ben?.nightmare && benGhostDepth(f) > 30);
    if (this.effects && nightmare) {
      const haze = c.createLinearGradient(0, 230, 0, 582);
      haze.addColorStop(0, "#25133700");
      haze.addColorStop(1, "#70548a39");
      c.fillStyle = haze;
      c.fillRect(-benPadding, 230, 1280 + 2 * benPadding, 352);
    }
    if (kakuja && this.effects) drawCentipedeBackdrop(c, kakuja);
    if (this.effects && (kirinStage || !match.cinematicActive)) drawKirinStorm(c, match, this.sprites, kirinStage);
    if (!match.cinematicActive) drawTimeTint(c, match);
    if (road) drawRoadBackdrop(c, this.sprites, road);
    if (this.effects) drawFury(c, match, this.sprites, "behind");
    if (match.capture?.kind === "ultimate") {
      c.fillStyle = "#06091388";
      c.fillRect(0, 140, 1280, 460);
    }
    c.save();
    if (match.capture?.kind === "ultimate") {
      const center = (match.fighters[0].x + match.fighters[1].x) / 2;
      // An integer close-up keeps the cinematic's source pixels crisp.
      c.translate(640, 390);
      c.scale(2, 2);
      c.translate(-Math.round(center), -(FLOOR - 70));
    }
    const drawStand = (f: Fighter) => {
      if (!f.stand) return;
      if (match.phase === "intro" && f.data.lifecycle && f.stateFrame < 64)
        return;
      const victimStand = road && f.id === road.victim;
      const opacity =
        jet && f.id === jet.victim ? Math.max(0, 1 - jet.tick / 12) :
        fury && f.id === fury.victim
          ? Math.max(0, 1 - fury.tick / 12)
          : victimStand
            ? Math.max(
                0,
                road.tick < 12
                  ? 1 - road.tick / 12
                  : (road.tick - roadConfig.phases.finish) / 14,
              )
            : 1;
      if (opacity <= 0) return;
      const animation = this.standAnimations.get(f);
      if (!animation) return;
      const sprite = animation.sprite(),
        image = this.sprites.get(sprite.sheet),
        t = f.stand.transform;
      if (image?.complete && image.naturalWidth) {
        c.save();
        c.globalAlpha = opacity;
        c.translate(t.x, t.y);
        c.scale(t.facing, 1);
        if (f.id === 1) c.filter = "hue-rotate(145deg)";
        c.drawImage(
          image,
          sprite.x,
          sprite.y,
          sprite.width,
          sprite.height,
          -sprite.pivot.x,
          -sprite.pivot.y,
          sprite.width,
          sprite.height,
        );
        c.restore();
      }
      if (this.debug) {
        c.strokeStyle = "#bba4e7";
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(f.x, f.y);
        c.lineTo(t.x, t.y);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#bba4e7";
        c.fillRect(t.x - 2, t.y - 2, 4, 4);
        drawCombatDebug(c, [], f.stand.hitboxes(f));
      }
    };
    for (const f of match.fighters)
      if (f.stand?.transform.depth === 0) drawStand(f);
    if (!match.cinematicActive) drawEchoClones(c, match, this.sprites, this.debug, this.effects);
    // Keep the held opponent readable between the two converging shells.
    const centipedeWrap = kakuja?.phase === "capture" || kakuja?.phase === "descent";
    const order = centipede ? (centipedeWrap ? [centipede.attacker, centipede.victim] : [centipede.victim, centipede.attacker]) : jet ? [jet.victim, jet.attacker] : fury
      ? [fury.victim, fury.attacker]
      : road
        ? [road.victim, road.attacker]
        : [0, 1];
    order.forEach((i) => {
      const f = match.fighters[i];
      if (gokuInvisible(f)) return;
      if (fury && i === fury.attacker && furyStage?.attacker.hidden) return;
      if (road && i === road.attacker)
        drawRoadObject(c, this.sprites, road, this.debug);
      c.fillStyle = "#0005";
      c.beginPath();
      c.ellipse(f.x, FLOOR + 5, 55, 12, 0, 0, 7);
      c.fill();
      const kagunes = this.presentations[i].kagunes(f);
      const kakujaActor = centipede?.attacker === i;
      for (const pose of kagunes)
        if (pose.layer === "behind" || kakujaActor) drawKagune(c, pose, f.facing as 1 | -1);
      c.save();
      c.translate(this.presentations[i].renderRootX(f), Math.round(f.y));
      const sprite = this.presentations[i].animator.sprite();
      c.scale(f.facing * sprite.scale, sprite.scale);
      const ghostDepth = benGhostDepth(f);
      if (this.effects && ghostDepth) drawBenGhostGround(c, f, match.frame);
      if (i === 1 && !kakujaActor && !sprite.player2Sheet && f.data.id !== benId && f.data.id !== "goku" && !sasukeWingedSheets.has(sprite.sheet))
        c.filter = "hue-rotate(145deg)";
      const original = this.sprites.get(
        i === 1 ? (sprite.player2Sheet ?? sprite.sheet) : sprite.sheet,
      );
      const image =
        i === 1 && !kakujaActor && f.data.id !== benId && !sasukeWingedSheets.has(sprite.sheet) && (this.opponentPalette !== "cyan" || f.data.id === "goku")
          ? (this.variants.get(`${this.opponentPalette}:${sprite.sheet}`) ??
            original)
          : original;
      const jetActor = jet?.attacker === i ? jetStage : undefined;
      const jetShift = jet && jetActor ? jetBodyRecoil(jetActor, jet) : 0;
      drawJetActor(c, this.sprites, f, jetActor, true, this.effects, jetShift);
      const limbs = luffyAttackLimbs(f);
      if (this.effects && limbs.length && f.move)
        paintLuffyTrails(c, limbs, f.stateFrame, f.move);
      const luffyImpact = limbs.length
        ? match.events.filter(e => e.luffy?.actor === i && e.luffy.move === f.moveId).at(-1)
        : undefined;
      const recoil = luffyImpact ? Math.max(0, 1 - ((luffyImpact.total ?? 16) - luffyImpact.life) / 6) : 0;
      const rootShift = -Math.round((luffyImpact?.strength === 3 ? 3 : 2) * recoil);
      const finish = { rootShift, recoil };
      for (const limb of limbs) if (limb.rear) paintElastic(c, limb, limb, undefined, finish);
      if (
        image &&
        (image instanceof HTMLCanvasElement ||
          (image.complete && image.naturalWidth))
      ) {
        if (
          this.effects &&
          !match.cinematicActive &&
          combatPace.feedback.dashTrails &&
          (f.state === "dash" || f.airChaseTicks > 0 || f.move?.special === "rinkakuRush") &&
          Math.abs(f.vx) > 5
        ) {
          for (const back of [2, 1]) {
            c.globalAlpha = back === 2 ? 0.08 : 0.16;
            c.drawImage(
              image,
              sprite.x,
              sprite.y,
              sprite.width,
              sprite.height,
              -sprite.pivot.x -
                Math.round((back * f.vx * f.facing * 1.2) / sprite.scale),
              -sprite.pivot.y,
              sprite.width,
              sprite.height,
            );
          }
          c.globalAlpha = 1;
        }
        c.save();
        if (f.benPhase) c.globalAlpha = f.benPhase.physicalOnly ? .74 : .46;
        if (ghostDepth) {
          c.beginPath();
          c.rect(-390, -400, 780, 400);
          c.clip();
        }
        if (match.capture?.attacker === i && match.capture.ben?.moveId.startsWith("spectralArms_")) {
          const hunt = match.capture;
          const swap = hunt.ben!.moveId.endsWith("medium") ? 24 : 18;
          if (Math.abs(hunt.tick - swap) < 3) c.globalAlpha = Math.abs(hunt.tick - swap) * .27;
        }
        c.drawImage(
          image,
          sprite.x,
          sprite.y,
          sprite.width,
          sprite.height,
          -sprite.pivot.x + rootShift + jetShift,
          -sprite.pivot.y + ghostDepth,
          sprite.width,
          sprite.height,
        );
        c.restore();
      }
      c.globalAlpha = 1;
      drawSpectralArms(c, f, match);
      if (f.omnitrix?.active === "feedback") {
        const animator = this.presentations[i].animator;
        const anchor = feedbackHeadAnchor(sprite.sheet, animator.frame());
        drawFeedbackCables(c, f, match.frame, anchor, this.effects);
        drawFeedbackGrip(c, f, match, anchor, this.effects);
      }
      if (this.effects && f.omnitrix) {
        const frame = this.presentations[i].animator.frame();
        drawBenAlienFx(c, f, match.frame, benFlameAnchor(sprite.sheet, frame));
        drawBenAttackFx(c, f, match.frame, feedbackStormTips(sprite.sheet, frame));
        drawStage7Core(c, f, frame, match.frame);
        drawHeldBenCar(c, f, this.sprites);
        if (f.omnitrix.transition) {
          const transition = f.omnitrix.transition;
          const next = benAnimation(transition.to);
          const target = this.sprites.get(next.sheet);
          if (target) drawBenSilhouette(c, target, next, transition.ticks);
          const wrist = sprite.sheet === benArt.sheet ? benArt.watch[frame] : undefined;
          drawOmnitrixFlash(c, transition.ticks, wrist);
        }
      }
      for (const limb of limbs) if (!limb.rear) paintElastic(c, limb, limb, undefined, finish);
      const grip = luffyGrabLimb(f);
      if (grip) paintElastic(c, grip, grip);
      drawJetActor(c, this.sprites, f, jetActor, false, this.effects, jetShift);
      if (this.effects && f.data.id === "sasuke") {
        drawSasukeCut(c, f);
        drawSasukeTechnique(c, f);
        drawSasukeCurseFX(c, f);
      }
      c.restore();
      if (!kakujaActor)
        for (const pose of kagunes) if (pose.layer === "front") drawKagune(c, pose, f.facing as 1 | -1);
      if (this.debug) {
        c.fillStyle = "#e7c56e";
        c.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 4, 4);
        const pose =
          f.state === "attack" && f.move
            ? poseAt(f.move, f.stateFrame)
            : undefined;
        if (!match.cinematicActive)
          drawCombatDebug(
            c,
            f.hurtboxes(),
            f.attackShapes(),
            f.pushbox(),
            pose?.blade
              ? worldCapsule(pose.blade, f.x, f.y, f.facing)
              : undefined,
          );
      }
    });
    for (const f of match.fighters)
      if (f.stand && f.stand.transform.depth > 0) drawStand(f);
    if (!match.cinematicActive)
      drawKnives(c, match, this.sprites.get("fx/dio-specials.png"), this.debug);
    if (!match.cinematicActive) {
      drawGokuSpecials(c, match, this.sprites, this.debug);
      drawSasukeProjectiles(c, match, this.sprites, this.debug);
      if (this.effects || this.debug) drawBenFields(c, match, this.debug, this.sprites);
    }
    if (this.effects && !fury && !jet && !kirin) {
      drawEffects(c, match.events, this.fxImage);
      drawBenContact(c, match);
      for (const fighter of match.fighters) drawBenChill(c, fighter);
      paintLuffyImpacts(c, match.events);
      drawSasukeContact(c, match, this.sprites);
      drawChainEffects(c, match.events, grabber, chain?.finish, age);
    }
    if (this.effects && !match.cinematicActive)
      drawTemporalEffects(c, match, this.sprites.get("fx/dio-specials.png"));
    if (this.effects) drawCentipedeWorld(c, match, centipede, kakuja);
    if (this.effects && kirin && kirinStage) drawKirinWorld(c, kirin, kirinStage, this.sprites);
    if (this.effects && jet && jetStage) drawJetImpact(c, this.sprites, jetStage, jet.tick, jet.hold);
    if (this.effects && road) drawRoadEffects(c, this.sprites, road);
    if (this.effects) drawFury(c, match, this.sprites, "front");
    c.restore();
    c.restore();
    if (jet && this.effects) drawJetScreen(c, jet);
    if (kirin && this.effects) drawKirinFlash(c, kirin);
    if (kanekiScene?.flash && this.effects) {
      c.fillStyle = `rgba(238,75,108,${kanekiScene.flash})`;
      c.fillRect(0, 0, 1280, 720);
    }
    this.hud(match);
    if (match.fighters.some(f => f.state === "attack" && f.stateFrame < 9 && isSuperMove(f.move))) {
      c.save(); c.textAlign = "center"; c.font = "bold 14px monospace"; c.fillStyle = "#ffd694";
      c.fillText("SUPER!", 640, 149); c.restore();
    }
    if ((kirin && kirin.tick < kirinConfig.phases.storm) || match.fighters.some(f => f.moveId === kirinId && f.stateFrame < 11)) {
      c.save(); c.font = "bold 29px monospace"; c.textAlign = "center"; c.fillStyle = "#c6edff";
      c.fillText("K I R I N", 640, 178); c.restore();
    }
    if (centipede && centipede.tick < 64) {
      c.save(); c.font = "bold 23px monospace"; c.textAlign = "center"; c.fillStyle = "#ffb3ad";
      c.fillText(centipedeName, 640, 177); c.restore();
    }
    if (self.moveId === "ssj1_fury" && self.stateFrame < 28) {
      c.fillStyle = "#ffe780";
      c.font = "bold 24px monospace";
      c.textAlign = "center";
      c.fillText("SUPER SAIYAJIN 1 · FÚRIA SAIYAJIN", 640, 179);
      c.textAlign = "left";
    }
    if (match.fighters.some(f => f.moveId === jetId && f.stateFrame < 28) || (jet && jet.tick < 12)) {
      c.font = "bold 24px monospace";
      c.textAlign = "center";
      c.fillStyle = "#ffd086";
      c.fillText("GOMU GOMU NO JET GIGANT", 640, 179);
      c.textAlign = "left";
    }
    if (road && road.tick < 22) {
      c.font = "bold 24px monospace";
      c.textAlign = "center";
      c.fillStyle = "#f4ca68";
      c.fillText("ROAD ROLLER", 640, 179);
      c.textAlign = "left";
    }
    if (this.debug) {
      c.font = "12px monospace";
      c.fillStyle = "#d6e8e7";
      match.fighters.forEach((f, i) =>
        c.fillText(
          `${i === 0 ? "P1" : "P2"}: ${f.moveId || f.state} · ${f.attackPhase ?? "—"} · tick ${f.stateFrame}`,
          i === 0 ? 50 : 820,
          284,
        ),
      );
    }
    for (let i = 0; i < 2; i++) {
      const stats = this.feedback.fighters[i];
      if (stats.visible <= 0 || stats.comboHits < 2) continue;
      c.save();
      c.globalAlpha = Math.min(1, stats.visible / 18);
      c.fillStyle = i === 0 ? "#ffce8c" : "#9be5ef";
      c.font = "italic bold 30px monospace";
      const x = i === 0 ? 55 : 1000;
      const y = match.fighters[i].omnitrix ? 251 : 225;
      c.fillText(`${stats.comboHits} HITS`, x, y);
      c.font = "14px monospace";
      c.fillText(`${stats.comboDamage} DANO`, x, y + 24);
      c.restore();
    }
    if (match.capture?.kind === "ultimate") {
      c.textAlign = "center";
      c.font = "italic bold 30px sans-serif";
      c.fillStyle = "#ffe4c2";
      c.fillText("MIL CORTES", 640, 185);
      c.textAlign = "left";
    }
    if (match.message) {
      c.fillStyle = "#0c1524bb";
      c.fillRect(0, 270, 1280, 115);
      c.textAlign = "center";
      c.font = "italic bold 58px sans-serif";
      c.fillStyle = "#f7e4bf";
      c.fillText(
        this.online && match.phase === "finished"
          ? `JOGADOR ${match.wins[0] >= 2 ? 1 : 2} VENCEU`
          : match.message,
        640,
        345,
      );
      c.textAlign = "left";
    }
  }
  private box(b: Rect, color: string) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  private hud(m: Match) {
    const c = this.ctx;
    const ben = m.fighters[this.localSeat].omnitrix ? m.fighters[this.localSeat] : m.fighters.find(f => f.omnitrix);
    const omnitrix = ben?.omnitrix;
    const rivalWatch = m.fighters[1 - this.localSeat].omnitrix;
    Object.assign(this.canvas.dataset, {
      benSeat: ben?.id ?? "",
      nrgMode: omnitrix?.active === "nrg" ? (omnitrix.nrgReleased ? "released" : "contained") : "",
      nrgTicks: omnitrix?.nrgTicks ?? "",
      nrgCooldown: omnitrix?.nrgCooldown ?? 0,
      rivalNrgMode: rivalWatch?.active === "nrg" ? (rivalWatch.nrgReleased ? "released" : "contained") : "",
      rivalBenPhase: m.fighters[1 - this.localSeat].benPhase ? "active" : "",
      benPhase: ben?.benPhase ? "active" : "",
      benFlight: omnitrix?.flightTicks ? "nrg" : ben?.move?.ben?.aerialMotion ?? "",
      benCapture: m.capture?.ben?.moveId ?? "",
      benCaptureTick: m.capture?.ben ? m.capture.tick : "",
      benMoveTick: ben?.state === "attack" ? ben.stateFrame : "",
      echoClones: ben?.omnitrix?.echoClones?.filter(clone => !clone.fading).length ?? 0,
      gravityWell: ben?.omnitrix?.objects.some(object => object.id === "gravityDomain_light") ?? false,
      benObjects: omnitrix?.objects.map(object => object.id + ":" + (object.impactAge ?? object.age)).join(",") ?? "",
      p1Chill: m.fighters[0].chill?.freeze ?? 0,
      p2Chill: m.fighters[1].chill?.freeze ?? 0,
      omnitrixState: omnitrix?.transition ? "switching" : omnitrix?.holdTicks && omnitrix.holdTicks < omnitrixHoldTicks ? "holding" : omnitrix ? "ready" : "",
      omnitrixForm: omnitrix?.active ?? "",
      rivalOmnitrixForm: rivalWatch?.active ?? "",
      rivalBenGrowth: rivalWatch?.growth?.rank ?? "",
      rivalBenCharge: rivalWatch?.charge ?? "",
      rivalBenWalls: rivalWatch?.objects.filter(object => object.durability && !object.spent).length ?? "",
      omnitrixSheet: ben ? this.presentations[ben.id].animator.sprite().sheet : "",
      benGrowth: omnitrix?.growth?.rank ?? "",
      benCharge: omnitrix?.charge ?? "",
      benWalls: omnitrix?.objects.filter(object => object.durability && !object.spent).length ?? "",
      omnitrixSelection: omnitrix?.selected ?? "",
      omnitrixDialTicks: omnitrix?.dialTicks ?? "",
      omnitrixTransitionTicks: omnitrix?.transition?.ticks ?? "",
      omnitrixFacing: ben?.facing ?? "",
      omnitrixName: benAliens.find(form => form.id === omnitrix?.selected)?.name ?? "",
    });
    for (let i = 0; i < 2; i++) {
      const f = m.fighters[i],
        x = i === 0 ? 50 : 750;
      c.fillStyle = "#e6e5df";
      c.font = "bold 22px sans-serif";
      c.fillText(f.data.name.toUpperCase(), x, 44);
      c.font = "12px monospace";
      c.fillStyle = i === 0 ? "#e5b16b" : "#73cbd5";
      c.fillText(
        this.online
          ? `${i + 1} / ${i === this.localSeat ? "VOCÊ" : "ADVERSÁRIO"}`
          : i === 0
            ? "01 / VOCÊ"
            : this.opponentLabel,
        x,
        64,
      );
      c.fillStyle = "#0b1420";
      c.fillRect(x, 78, 480, 27);
      c.fillStyle = i === 0 ? "#e5b16b" : "#73cbd5";
      const trail = 476 * this.healthBars[i].trail;
      c.fillStyle = "#b65d52";
      c.fillRect(i === 0 ? x + 2 : x + 478 - trail, 80, trail, 23);
      c.fillStyle = i === 0 ? "#e5b16b" : "#73cbd5";
      const w = Math.round(476 * this.healthBars[i].value);
      c.fillRect(i === 0 ? x + 2 : x + 478 - w, 80, w, 23);
      c.fillStyle = "#d8dfdf";
      c.font = "12px monospace";
      c.fillText(`${f.health} / ${f.data.health}`, x, 124);
      for (let r = 0; r < 2; r++) {
        c.fillStyle = m.wins[i] > r ? "#ffe1a5" : "#41515b";
        c.beginPath();
        c.arc(x + 460 - r * 21, 120, 6, 0, 7);
        c.fill();
      }
      c.fillStyle = "#0b1420";
      c.fillRect(x, 627, 300, 14);
      c.fillStyle = i === 0 ? "#e5b16b" : "#73cbd5";
      c.fillRect(x + 2, 629, (296 * f.meter) / f.meterMaximum, 10);
      if (f.meterMaximum > 100) {
        c.fillStyle = "#0b1420";
        c.fillRect(x + 149, 627, 2, 14);
      }
      c.font = "11px monospace";
      c.fillStyle = i === 0 ? "#e5b16b" : "#73cbd5";
      c.fillText(
        f.data.id === benId ? `ALIEN X · RESERVADO · ${this.superKey}` : f.data.id === "kaneki"
          ? `CENTIPEDE · ${f.meter >= centipedeConfig.cost ? `PRONTA · ${this.superKey}` : Math.floor(100 * f.meter / centipedeConfig.cost) + "%"}`
          : f.data.id === "luffy"
          ? `JET GIGANT · ${f.meter >= f.meterMaximum ? `PRONTA · ${this.superKey}` : Math.floor((100 * f.meter) / f.meterMaximum) + "%"}`
          : f.data.id === "goku"
            ? `FÚRIA SAIYAJIN · ${f.meter >= f.meterMaximum ? `PRONTA · ${this.superKey}` : Math.floor((100 * f.meter) / f.meterMaximum) + "%"}`
            : f.data.id === "samurai"
              ? `MIL CORTES ${f.meter}%${f.meter >= 100 ? ` · ${this.superKey}` : ""}`
              : f.data.id === "sasuke"
                ? `KIRIN · ${f.meter >= kirinConfig.cost ? `PRONTA · ${this.superKey}` : Math.floor(100 * f.meter / kirinConfig.cost) + "%"}`
                : `SUPER ${(f.meter / 100).toFixed(2)} / 2 · ROAD ROLLER · ${this.superKey}`,
        x,
        617,
      );
      if (f.omnitrix)
        drawOmnitrixHud(c, f.omnitrix, i, this.chainKeys[2], !omnitrixCanBrowse(f.state) || f.knockedDown || Boolean(m.capture) || m.cinematicActive || m.temporal.isFrozen(i));
      if (f.data.id === "sasuke") drawCurseHud(c, f, x);
      if (f.data.id === "dio") {
        const clock = m.temporal.s.ledger[i];
        const label = m.temporal.active
          ? m.temporal.s.owner === i
            ? `TEMPO PARADO · ${(m.temporal.s.remaining / 60).toFixed(1)}s`
            : "TEMPO CONGELADO"
          : clock.cooldown > 0
            ? `TEMPO · RECARGA ${(clock.cooldown / 60).toFixed(1)}s · USOS ${clock.uses}`
            : "TEMPO PRONTO · → ↓ + L";
        c.font = "11px monospace";
        c.fillStyle = m.temporal.active
          ? "#c8b6f4"
          : clock.cooldown
            ? "#a8b4c7"
            : "#a4dfc0";
        c.fillText(label, x, 151);
        if (clock.cooldown > 0) {
          c.fillStyle = "#273646";
          c.fillRect(x, 158, 180, 3);
          c.fillStyle = "#afa0d8";
          c.fillRect(
            x,
            158,
            Math.round(
              180 * (1 - clock.cooldown / m.temporal.cooldownFor(clock.uses)),
            ),
            3,
          );
        }
      }
    }
    c.textAlign = "center";
    c.fillStyle = "#f3ead8";
    c.font = "bold 48px monospace";
    c.fillText(
      m.rules.training ? "∞" : String(Math.ceil(m.timer / 60)).padStart(2, "0"),
      640,
      103,
    );
    c.font = "11px monospace";
    c.fillStyle = "#8d9ca5";
    c.fillText(m.rules.training ? "TREINAMENTO" : this.contextLabel, 640, 124);
    const capture = m.capture;
    const tech = kanekiTechnique(capture?.kaneki?.specialId);
    const chain = capture?.kaneki?.chain;
    if (capture?.kaneki && chain) {
      const picking = chain.phase === "choice1" || chain.phase === "choice2" || chain.phase === "connected";
      const second = chain.phase === "choice2";
      const long = chain.origin === "kaguneGrab";
      const finalizing = second || directChain(chain);
      const route = capture.kaneki.route;
      const starter = ["PUXAR", long ? "PÊNDULO" : "ARREMESSAR", long ? "SUSPENDER" : "LANÇAR"];
      const options = chainButtons.flatMap((button, i) => {
        if (!finalizing) return [`${this.chainKeys[i]}  ${starter[i]}`];
        const finish = chainFinisher(chain, button, route);
        return finish ? [`${this.chainKeys[i]}  ${chainNames[finish].toUpperCase()}`] : [];
      });
      c.fillStyle = "#18111eea";
      c.fillRect(340, 136, 600, 44);
      c.fillStyle = "#ffd2df";
      c.font = "bold 13px monospace";
      const view = this.localSeat === capture.victim && this.online;
      const title = chain.finish ? chainNames[chain.finish].toUpperCase() : chain.phase === "opener" || chain.phase === "outro"
        ? kanekiSpecialNames[tech!.family].toUpperCase() : picking
        ? options.join("   ·   ") : capture.kaneki.route === "launch" ? "LANÇAMENTO" :
          capture.kaneki.route === "pull" ? "PUXÃO RINKAKU" : "ARREMESSO";
      c.fillText(title, 640, 156, 574);
      if (picking || long) {
        const duration = chainWindow(chain, second);
        const remaining = duration - (long ? m.frame - chain.started : chain.phase === "connected" ? 0 : Math.max(0, capture.tick - chain.since));
        c.fillStyle = "#f08a9d";
        c.fillRect(352, 171, 576 * Math.max(0, remaining / duration), 3);
      }
      if (centipedeConversion(m, capture) && (!this.online || this.localSeat === capture.attacker)) {
        c.fillStyle = "#ffbb92";
        c.font = "bold 11px monospace";
        c.fillText(`${this.superKey} · CENTIPEDE`, 835, 195);
      }
      if (long) {
        const key = this.chainKeys[chainButtons.indexOf(resistanceButton(chain))];
        const remaining = Math.max(0, kaguneGrabLimit - (m.frame - chain.started));
        const instruction = canResistChain(chain, capture.tick) ? ` · PRÓXIMO ${key}` : "";
        c.fillStyle = "#d0f4ed";
        c.font = "11px monospace";
        c.fillText(`${(remaining / 60).toFixed(1)} s · RESISTÊNCIA ${chain.resistance ?? 0}/${resistanceGoal}${instruction}`, 640, 195);
      } else if (second && view) {
        c.fillStyle = "#f7d9e3";
        c.font = "11px monospace";
        c.fillText(chain.escape ? "TENTATIVA REGISTRADA" : "ESCAPE · LEIA O BOTÃO DE KANEKI · 1 TENTATIVA", 640, 195);
      }
    } else if (tech && tech.family !== "kaguneGrab") {
      c.fillStyle = "#ffd2df";
      c.font = "bold 17px monospace";
      c.fillText(kanekiSpecialNames[tech.family].toUpperCase(), 640, 161);
    } else if (capture?.kaneki) {
      const route = capture.kaneki.route;
      c.fillStyle = "#18111e";
      c.fillRect(440, 138, 400, 49);
      c.fillStyle = "#ffd2df";
      c.font = "bold 14px monospace";
      c.fillText(route ? { pull: "PUXAR", throw: "ARREMESSAR", launch: "LANÇAR" }[route] : "LEVE · PUXAR   MÉDIO · ARREMESSAR   FORTE · LANÇAR", 640, 158);
      if (!route) {
        c.fillStyle = "#f08a9d";
        c.fillRect(451, 174, 378 * Math.max(0, Math.min(1, (captureWindup + captureWindow - capture.tick) / captureWindow)), 3);
      }
    }
    c.textAlign = "left";
  }
}
