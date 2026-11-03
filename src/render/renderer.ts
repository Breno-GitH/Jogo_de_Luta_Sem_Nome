import { assetBase } from "../asset-base";
import { drawTestArena } from "./arena";
import { drawGokuSpecials, gokuFxSheets } from "./goku-special-fx";
import { gokuInvisible } from "../engine/goku-specials";
import { furyScene } from "../engine/goku-fury";
import { drawFury, furyFxSheets } from "./goku-fury-fx";
import { FLOOR, type Match } from "../engine/combat";
import { Animator, metadata, type AnimationData } from "./animator";
import dioAnimations from "../data/dio-animations.json";
import { gokuAnimations } from "./goku-animations";
import { luffyAnimations } from "./luffy-animations";
import { luffyAttackLimbs } from "../engine/luffy-specials";
import { paintElastic } from "./elastic";
import { paintLuffyTrails } from "./luffy-special-fx";
import worldAnimations from "../data/the-world-animations.json";
import { FighterPresentation } from "./presentation";
import { drawCombatDebug } from "./debug";
import { poseAt } from "../engine/moves";
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
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.fxImage.src = `${spriteBase}fx/samurai-fx.png`;
    const sheets = new Set<string>();
    sheets.add("fx/dio-specials.png");
    for (const sheet of gokuFxSheets) sheets.add(sheet);
    for (const sheet of furyFxSheets) sheets.add(sheet);
    for (const data of [
      metadata,
      dioAnimations,
      gokuAnimations,
      luffyAnimations,
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
  tick(match: Match) {
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
                : metadata,
        );
        if (f.stand) this.standAnimations.set(f, new Animator(worldAnimations));
      }
      this.healthBars[i].tick(f.health / f.data.health);
      if (
        !match.roadRoller &&
        !match.fury &&
        match.temporal.isFrozen(i) &&
        this.frozenActors.has(f)
      )
        return;
      if (!match.roadRoller && !match.fury && match.temporal.isFrozen(i))
        this.frozenActors.add(f);
      else this.frozenActors.delete(f);
      this.presentations[i].tick(f);
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
    this.canvas.dataset.move = self.moveId;
    this.canvas.dataset.phase = self.attackPhase ?? "none";
    this.canvas.dataset.combo = String(other.combo);
    this.canvas.dataset.targetHealth = String(other.health);
    this.canvas.dataset.hitstop = String(match.hitstop);
    this.canvas.dataset.capture = fury
      ? "gokuFury"
      : road
        ? "roadRoller"
        : (match.capture?.kind ?? "none");
    this.canvas.dataset.meter = String(self.meter);
    this.canvas.dataset.playerHealth = String(self.health);
    this.canvas.dataset.p1Health = String(match.fighters[0].health);
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
        furyStage?.camera.scale ?? scene?.camera.scale ?? this.inspectionZoom,
      ),
      cameraShake: String(
        furyStage?.camera.shakeX ?? scene?.camera.shakeX ?? 0,
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
      !road && !fury && heavy
        ? (match.frame % 2 ? 1 : -1) * combatPace.feedback.heavyShakePixels
        : 0;
    this.canvas.dataset.impactShake = String(this.effects ? ordinaryShake : 0);
    c.imageSmoothingEnabled = false;
    if (this.inspectionZoom > 1 || road || fury) {
      c.fillStyle = "#101b2b";
      c.fillRect(0, 0, 1280, 720);
    }
    c.save();
    if (this.effects && ordinaryShake) c.translate(ordinaryShake, 0);
    if (furyStage) {
      const cam = furyStage.camera;
      c.translate(640 + cam.shakeX, 360 + cam.shakeY);
      c.scale(cam.scale, cam.scale);
      c.translate(-Math.round(cam.x), -Math.round(cam.y));
    } else if (scene) {
      const cam = scene.camera;
      c.translate(640 + cam.shakeX, cam.anchorY + cam.shakeY);
      c.scale(cam.scale, cam.scale);
      c.translate(-Math.round(cam.x), -Math.round(cam.y));
    } else if (
      this.inspectionZoom > 1 &&
      (!match.capture ||
        (match.capture.kind === "grab" && self.data.id === "goku"))
    ) {
      const z = this.inspectionZoom,
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
    drawTestArena(c);
    if (!road && !fury) drawTimeTint(c, match);
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
    const order = fury
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
      c.save();
      c.translate(this.presentations[i].renderRootX(f), Math.round(f.y));
      const sprite = this.presentations[i].animator.sprite();
      c.scale(f.facing * sprite.scale, sprite.scale);
      if (i === 1 && !sprite.player2Sheet && f.data.id !== "goku")
        c.filter = "hue-rotate(145deg)";
      const original = this.sprites.get(
        i === 1 ? (sprite.player2Sheet ?? sprite.sheet) : sprite.sheet,
      );
      const image =
        i === 1 && (this.opponentPalette !== "cyan" || f.data.id === "goku")
          ? (this.variants.get(`${this.opponentPalette}:${sprite.sheet}`) ??
            original)
          : original;
      const limbs = luffyAttackLimbs(f);
      if (this.effects && f.data.id === "luffy" && f.move?.special)
        paintLuffyTrails(c, limbs, f.stateFrame, f.move);
      for (const limb of limbs) if (limb.rear) paintElastic(c, limb, limb);
      if (
        image &&
        (image instanceof HTMLCanvasElement ||
          (image.complete && image.naturalWidth))
      ) {
        if (
          this.effects &&
          !road &&
          !fury &&
          combatPace.feedback.dashTrails &&
          (f.state === "dash" || f.airChaseTicks > 0) &&
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
      }
      for (const limb of limbs) if (!limb.rear) paintElastic(c, limb, limb);
      c.restore();
      if (this.debug) {
        c.fillStyle = "#e7c56e";
        c.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 4, 4);
        const pose =
          f.state === "attack" && f.move
            ? poseAt(f.move, f.stateFrame)
            : undefined;
        if (!road && !fury)
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
    if (!road && !fury)
      drawKnives(c, match, this.sprites.get("fx/dio-specials.png"), this.debug);
    if (!road && !fury) drawGokuSpecials(c, match, this.sprites, this.debug);
    if (this.effects && !fury) drawEffects(c, match.events, this.fxImage);
    if (this.effects && !road && !fury)
      drawTemporalEffects(c, match, this.sprites.get("fx/dio-specials.png"));
    if (this.effects && road) drawRoadEffects(c, this.sprites, road);
    if (this.effects) drawFury(c, match, this.sprites, "front");
    c.restore();
    c.restore();
    this.hud(match);
    if (self.moveId === "ssj1_fury" && self.stateFrame < 28) {
      c.fillStyle = "#ffe780";
      c.font = "bold 24px monospace";
      c.textAlign = "center";
      c.fillText("SUPER SAIYAJIN 1 · FÚRIA SAIYAJIN", 640, 179);
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
      c.fillText(`${stats.comboHits} HITS`, x, 225);
      c.font = "14px monospace";
      c.fillText(`${stats.comboDamage} DANO`, x, 249);
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
        f.data.id === "luffy"
          ? "LUFFY · NORMAIS ELÁSTICOS"
          : f.data.id === "goku"
            ? `FÚRIA SAIYAJIN · ${f.meter >= f.meterMaximum ? "PRONTA · R" : Math.floor((100 * f.meter) / f.meterMaximum) + "%"}`
            : f.data.id === "samurai"
              ? `MIL CORTES ${f.meter}%${f.meter >= 100 ? " · R" : ""}`
              : `SUPER ${(f.meter / 100).toFixed(2)} / 2 · ROAD ROLLER · R`,
        x,
        617,
      );
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
    c.textAlign = "left";
  }
}
