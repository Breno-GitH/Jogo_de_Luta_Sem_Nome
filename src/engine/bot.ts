import profiles from "../data/bot-profiles.json";
import { neutral, type Button, type InputFrame, type State } from "./types";
import { benAliens, omnitrixHoldTicks, omnitrixSwapTicks } from "./ben-omnitrix";
import type { Fighter, Match } from "./combat";
import { chainFinisher, type ChainButton } from "./kaneki-chain";
import { isSuperMove } from "./moves";
import { canAwaken } from "./sasuke-curse";
import type { SasukeSpecialId } from "./sasuke-specials";

const sasukeCommands: Record<SasukeSpecialId, [number[], Button]> = {
  senbon: [[2, 6], "light"],
  eiso: [[2, 6], "medium"],
  chidori: [[2, 6], "heavy"],
  gokakyu: [[2, 4], "light"],
  hosenka: [[2, 4], "medium"],
  goryuka: [[2, 4], "heavy"],
  serpents: [[2, 5, 2], "light"],
  nagashi: [[2, 5, 2], "medium"],
};

export type Difficulty = keyof typeof profiles;
export type BotProfile = (typeof profiles)[Difficulty];
export interface Observation {
  frame: number;
  x: number;
  y: number;
  vx: number;
  airborne: boolean;
  state: State;
  phase?: string;
  level?: string;
  remaining: number;
  stun?: number;
  connected: boolean;
  super?: boolean;
}

/** A controller of ordinary input frames. Opponent decisions use ONLY delayed
 * public poses, never keyboard input, command buffers or the next game tick. */
export class Bot {
  private seed: number;
  private plan = neutral();
  private queue: InputFrame[] = [];
  private history: Observation[] = [];
  private actor?: Fighter;
  private nextDecision = 0;
  private observedAt = -1;
  private confirmedAt = -1;
  private hitMove = "";
  private attempted = false;
  private airRoute = false;
  private lastSasukeSpecial?: SasukeSpecialId;
  lastDecision = "aguardar";
  perceived?: Observation;
  constructor(
    public difficulty: Difficulty,
    seed = 3417,
    public controlled: 0 | 1 = 1,
    private towerTuning?: BotProfile,
  ) {
    this.seed = seed;
  }
  get profile() {
    return this.towerTuning ?? profiles[this.difficulty];
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private chance(probability: number) {
    return this.random() < probability;
  }
  private reset(self: Fighter) {
    this.actor = self;
    this.plan = neutral();
    this.queue = [];
    this.history = [];
    this.nextDecision = 0;
    this.observedAt = -1;
    this.confirmedAt = -1;
    this.hitMove = "";
    this.airRoute = false;
    this.lastSasukeSpecial = undefined;
    this.attempted = false;
    this.perceived = undefined;
  }
  private choose(input: InputFrame, label: string) {
    this.plan = { ...input, pressed: [] };
    this.lastDecision = label;
    return input;
  }
  private command(pattern: number[], button: Button, self: Fighter) {
    this.queue = pattern.flatMap((value, index) => {
      const direction = (
        value === 6 || value === 3
          ? self.facing
          : value === 4 || value === 1
            ? -self.facing
            : 0
      ) as -1 | 0 | 1;
      const frame: InputFrame = {
        direction,
        down: [1, 2, 3].includes(value),
        pressed: index === pattern.length - 1 ? [button] : [],
      };
      return index === pattern.length - 1
        ? [frame]
        : [frame, { ...frame, pressed: [] }];
    });
    this.plan = neutral();
    return this.queue.shift()!;
  }
  private sasukeTechnique(self: Fighter, options: readonly SasukeSpecialId[]) {
    const valid = options.filter(id => self.canStartSpecial(id));
    if (!valid.length) return;
    const varied = valid.filter(id => id !== this.lastSasukeSpecial);
    const choices = varied.length ? varied : valid;
    const id = choices[Math.floor(this.random() * choices.length)];
    this.lastSasukeSpecial = id;
    this.lastDecision = "Sasuke · " + id;
    const [pattern, button] = sasukeCommands[id];
    return this.command(pattern, button, self);
  }
  private chainInput(match: Match, self: Fighter): InputFrame {
    const sequence = match.capture!;
    const chain = sequence.kaneki?.chain;
    if (!chain || sequence.attacker !== self.id || match.hitstop) return neutral();
    const age = sequence.tick - chain.since;
    const victim = match.fighters[sequence.victim];
    const wall = self.facing > 0 ? 1240 - victim.x : victim.x - 40;
    const heavyReady = victim.health <= 180 || wall < 140;
    if (chain.phase === "choice1" && age === (this.difficulty === "easy" ? 17 : 12)) {
      let pick: ChainButton = "medium";
      if (this.difficulty === "hard" || this.difficulty === "normal" && this.chance(.36))
        pick = wall > 235 && this.chance(.54) ? "heavy" : "light";
      return this.choose({ ...neutral(), pressed: [pick] }, "escolher captura Rinkaku");
    }
    if (chain.phase === "choice2" && age === (this.difficulty === "hard" ? 8 : 15)) {
      let pick: ChainButton = wall > 255 ? "medium" : "light";
      if (this.difficulty === "hard" && heavyReady && chainFinisher(chain, "heavy", sequence.kaneki?.route)) pick = "heavy";
      return this.choose({ ...neutral(), pressed: [pick] }, "finalizar captura Rinkaku");
    }
    return neutral();
  }
  sample(match: Match): InputFrame {
    const self = match.fighters[this.controlled];
    if (self !== this.actor) this.reset(self);
    if (match.temporal.isFrozen(self.id)) return neutral();
    if (
      match.phase !== "fight" ||
      match.capture ||
      match.cinematicActive
    ) {
      this.queue = [];
      this.plan = neutral();
      this.history = [];
      this.perceived = undefined;
      return match.capture ? this.chainInput(match, self) : neutral();
    }
    if (match.hitstop > 0) return neutral();
    if (self.state === "blockstun") return { ...this.plan, pressed: [] };
    const now = match.combatFrame;
    if (this.observedAt !== now) {
      const enemy = match.fighters[1 - this.controlled];
      this.history.push({
        frame: now,
        x: enemy.x,
        y: enemy.y,
        vx: enemy.vx,
        airborne: enemy.airborne,
        state: enemy.state,
        phase: enemy.attackPhase,
        level: enemy.move?.level,
        remaining: enemy.move
          ? enemy.move.startup +
            enemy.move.active +
            enemy.move.recovery -
            enemy.stateFrame
          : 0,
        connected: enemy.connected,
        stun: enemy.stun,
        super: isSuperMove(enemy.move),
      });
      this.history = this.history.filter((item) => now - item.frame < 100);
      this.observedAt = now;
    }
    this.perceived = this.history
      .filter((item) => item.frame <= now - this.profile.reaction)
      .at(-1);
    if (
      [
        "hitstun",
        "getup",
        "counter",
        "counterRecover",
        "ultimateRecover",
        "throwRecover",
        "landing",
        "taunt",
      ].includes(self.state)
    ) {
      this.queue = [];
      this.plan = neutral();
      this.airRoute = false;
      return neutral();
    }
    if (this.queue.length) return this.queue.shift()!;
    // Hit confirms concern our own already-resolved move. Their delay starts
    // after hitstop, and failure to confirm never opens a cancel on a whiff.
    if (self.state === "attack" && self.connected) {
      if (this.hitMove !== self.moveId || this.confirmedAt < 0) {
        this.hitMove = self.moveId;
        this.confirmedAt = now;
        this.attempted = false;
      }
      if (!this.attempted && now - this.confirmedAt >= this.profile.confirm) {
        this.attempted = true;
        if (this.chance(this.profile.combo)) {
          if (
            self.data.id !== "kaneki" &&
            self.move?.cancels.includes("special") &&
            !self.airborne &&
            (this.towerTuning || self.data.id === "sasuke"
              ? self.hitConfirmed && self.canStartSuper()
              : self.meter >= 100) &&
            (self.data.id !== "sasuke" || this.perceived && Math.abs(this.perceived.x - self.x) < 106) &&
            self.moveId !== "crouch_heavy" &&
            this.chance(this.profile.ultimate)
          ) {
            return this.choose(
              { ...neutral(), pressed: ["ultimate"] },
              self.data.id === "sasuke" ? "confirmar Kirin" :
                this.towerTuning ? "confirmar Super" : "confirmar Mil Cortes",
            );
          }
          if (
            self.moveId === "crouch_heavy" &&
            this.chance(this.profile.airCombo)
          ) {
            this.airRoute = true;
            return this.choose(
              { ...neutral(), pressed: ["jump"] },
              "perseguir lançamento",
            );
          }
          if (self.data.id === "kaneki" && self.hitConfirmed && this.chance(this.profile.special)) {
            const distance = Math.abs((this.perceived?.x ?? self.x) - self.x);
            if (self.move?.rank === 3 && distance <= 155 && self.canStartSpecial("fourSwords_light")) {
              this.lastDecision = "finalizar com Four Swords";
              return this.command([2, 4], "light", self);
            }
            if (self.move?.rank === 2 && distance < 110 && self.canStartSpecial("rinkakuRush_light")) {
              this.lastDecision = "confirmar Rinkaku Rush";
              return this.command([2, 5, 2], "light", self);
            }
          }
          const next: Button | undefined = self.move?.cancels.includes("medium")
            ? "medium"
            : self.move?.cancels.includes("heavy")
              ? "heavy"
              : undefined;
          if (next)
            return this.choose(
              {
                ...neutral(),
                down: self.moveId.startsWith("crouch_"),
                pressed: [next],
              },
              "continuar combo",
            );
          if (
            self.move?.cancels.includes("special") &&
            this.chance(this.profile.special)
          ) {
            if (self.data.id === "sasuke")
              return this.sasukeTechnique(self, ["chidori", "eiso", "gokakyu", "serpents"]) ?? neutral();
            this.lastDecision = "cancelar em especial";
            return this.command(
              self.moveId === "crouch_heavy" ? [6, 2, 3] : [2, 3, 6],
              "light",
              self,
            );
          }
        }
      }
      return neutral();
    }
    if (self.state !== "attack") {
      this.confirmedAt = -1;
      this.hitMove = "";
    }
    if (this.airRoute && self.state === "air") {
      this.airRoute = false;
      return this.choose(
        { ...neutral(), pressed: ["light"] },
        "iniciar combo aéreo",
      );
    }
    if (self.state === "attack" || self.state === "jumpStart") return neutral();
    const enemy = this.perceived;
    if (!enemy) return neutral();
    if (now < this.nextDecision) return { ...this.plan, pressed: [] };
    this.nextDecision =
      now +
      this.profile.decision +
      Math.floor(this.random() * this.profile.jitter);
    const distance = Math.abs(enemy.x - self.x),
      toward = (enemy.x >= self.x ? 1 : -1) as -1 | 1;
    const away = -toward as -1 | 1;
    const sasuke = self.data.id === "sasuke";
    if (self.airborne) {
      if (sasuke && self.sasukeCurse?.phase === "active" && !self.sasukeCurse.airBurstUsed &&
          toward === self.facing && distance >= 118 && distance < 220 &&
          Math.abs(self.y - enemy.y) < 82 && this.chance(this.profile.airCombo))
        return this.choose({ ...neutral(), direction: toward, pressed: ["dash"] }, "perseguir com as asas");
      if (distance < 125 && Math.abs(enemy.y - self.y) < 90)
        return this.choose(
          { ...neutral(), pressed: [this.chance(0.65) ? "light" : self.omnitrix ? "medium" : "heavy"] },
          "cortar no ar",
        );
      return this.choose(
        { ...neutral(), direction: distance > 120 ? toward : 0 },
        "ajustar salto",
      );
    }
    if ((this.towerTuning || sasuke) && enemy.super && enemy.phase === "startup" &&
        distance < 250 && this.chance(this.profile.guard)) {
      return this.choose({ direction: away, down: false, pressed: ["dash"] }, "esquivar da Super");
    }
    if (
      enemy.state === "attack" &&
      enemy.phase !== "recovery" &&
      distance < 220 &&
      this.chance(this.profile.guard)
    ) {
      return this.choose(
        { direction: away, down: enemy.level === "low", pressed: [] },
        "defender ataque percebido",
      );
    }
    const remaining = enemy.remaining - (now - enemy.frame);
    if (
      enemy.state === "attack" &&
      enemy.phase === "recovery" &&
      !enemy.connected &&
      distance < 180 &&
      remaining >= 5 &&
      this.chance(this.profile.punish)
    ) {
      if (distance < 110)
        return this.choose(
          { ...neutral(), pressed: ["light"] },
          "punir recuperação",
        );
      if (remaining >= 12) {
        if (self.data.id === "goku")
          return this.choose(
            { ...neutral(), pressed: [distance > 90 ? "medium" : "heavy"] },
            "punir com normal",
          );
        if (self.data.id === "dio")
          return this.choose(
            { ...neutral(), pressed: ["heavy"] },
            "punir com The World",
          );
        if (sasuke) {
          const punish = this.sasukeTechnique(self, ["eiso", "chidori"]);
          if (punish) return punish;
        }
        this.lastDecision = "punir com saque";
        return this.command([2, 3, 6], "light", self);
      }
    }
    if (enemy.airborne && distance < 110 && this.chance(this.profile.special)) {
      if (sasuke)
        return this.choose({ ...neutral(), down: true, pressed: ["heavy"] }, "corte ascendente");
      if (self.data.id === "goku")
        return this.choose(
          { ...neutral(), down: true, pressed: ["heavy"] },
          "uppercut de Goku",
        );
      if (self.data.id === "dio")
        return this.choose(
          { ...neutral(), down: true, pressed: ["heavy"] },
          "uppercut do Stand",
        );
      this.lastDecision = "anti-aéreo";
      return this.command(
        [6, 2, 3],
        this.chance(0.7) ? "light" : "medium",
        self,
      );
    }
    if (
      distance < 135 &&
      !enemy.airborne &&
      self.meter >= 100 &&
      !!self.data.moves.ultimate_start &&
      this.chance(this.profile.ultimate)
    )
      return this.choose(
        { ...neutral(), pressed: ["ultimate"] },
        "usar Mil Cortes",
      );
    if (self.data.id === "luffy" && self.canStartSuper() && !enemy.airborne &&
        distance > 95 && distance < 235 && this.chance(this.profile.ultimate))
      return this.choose({ ...neutral(), pressed: ["ultimate"] }, "Jet Gigant");
    const closing = enemy.vx * toward < 0;
    const watch = self.omnitrix;
    if (watch && distance < 145 && !enemy.airborne && self.canStartSuper() &&
        (enemy.phase === "recovery" || enemy.state === "hitstun") && this.chance(this.profile.ultimate)) {
      return this.choose({ ...neutral(), pressed: ["ultimate"] }, "usar Alien X");
    }
    if (watch && !watch.transition && distance > 220 && !closing &&
        this.chance(watch.active === "human" ? .7 : .07)) {
      const selected = benAliens.findIndex(form => form.id === watch.selected);
      const skip = 1 + Math.floor(this.random() * (benAliens.length - 1));
      for (let i = 0; i < (watch.active === "human" ? selected % 4 : skip); i++)
        this.queue.push({ ...neutral(), pressed: ["heavy"], omnitrix: { held: false } });
      this.queue.push({ ...neutral(), pressed: ["heavy"], omnitrix: { held: true } });
      for (let i = 1; i <= omnitrixHoldTicks + omnitrixSwapTicks; i++)
        this.queue.push({ ...neutral(), omnitrix: { held: true } });
      this.lastDecision = "ativar Omnitrix";
      return this.queue.shift()!;
    }
    if (watch?.active === "echoEcho" && !watch.echoCooldown && !watch.echoClones?.length &&
        distance > 125 && distance < 290 && this.chance(this.profile.special)) {
      this.lastDecision = "duplicar Eco Eco";
      return this.command([2, 4], "medium", self);
    }
    if ((watch?.active === "gravattack" || watch?.active === "echoEcho") &&
        distance > 100 && distance < 270 && this.chance(this.profile.special)) {
      this.lastDecision = "controlar distância";
      return this.command([2, 6], "light", self);
    }
    if (self.data.id === "kaneki" && !enemy.airborne && this.chance(this.profile.special)) {
      if (enemy.phase === "recovery" && remaining >= 14 && distance >= 62 && distance <= 135 &&
          self.canStartSpecial("fourSwords_medium")) {
        this.lastDecision = "punir com Four Swords";
        return this.command([2, 4], "medium", self);
      }
      if (distance >= 95 && distance <= 165 && !closing && enemy.phase !== "active" &&
          self.canStartSpecial("kaguneGrab_medium")) {
        this.lastDecision = "capturar com Kagune Grab";
        return this.command([2, 6], "medium", self);
      }
      if (distance > 165 && distance <= 250 && self.canStartSpecial("rinkakuRush_medium")) {
        this.lastDecision = "aproximar com Rinkaku Rush";
        return this.command([2, 5, 2], "medium", self);
      }
    }
    if (sasuke) {
      const powered = self.sasukeCurse?.phase === "active";
      if (self.canStartSuper() && !enemy.airborne && distance < 88 &&
          ((enemy.phase === "recovery" && remaining >= 12) ||
            (enemy.state === "hitstun" && (enemy.stun ?? 0) - (now - enemy.frame) >= 12)) &&
          this.chance(this.profile.ultimate))
        return this.choose({ ...neutral(), pressed: ["ultimate"] }, "punir com Kirin");
      if (canAwaken(self) && distance >= (closing ? 295 : 220) && distance < 600 &&
          this.chance(this.profile.special)) {
        this.lastDecision = "despertar a Marca II";
        return this.command([2, 5, 2], "heavy", self);
      }
      if (this.chance(this.profile.special * (powered ? 1.45 : 1))) {
        const options: SasukeSpecialId[] = distance < 112
          ? closing || enemy.airborne ? ["nagashi", "serpents"] : ["serpents", "chidori"]
          : distance < (powered ? 310 : 245)
            ? enemy.airborne ? ["hosenka", "eiso"] : ["eiso", "chidori", "senbon"]
            : distance < 575 ? ["gokakyu", "hosenka", "goryuka", "senbon"] : [];
        if (options.length) {
          const special = this.sasukeTechnique(self, options);
          if (special) return special;
        }
      }
    }
    if (this.towerTuning && self.data.id === "luffy" &&
        distance > 175 && distance < 440 && !enemy.airborne &&
        this.chance(this.profile.special)) {
      this.lastDecision = "controlar espaço com Pistol";
      return this.command([2, 3, 6], enemy.phase === "recovery" ? "heavy" : "light", self);
    }
    const lowHealth = self.health / self.data.health < 0.3;
    if (self.data.id === "goku" && self.data.specialMoves && !self.airborne) {
      if (
        self.canStartSuper() &&
        distance > 120 &&
        distance < 290 &&
        this.chance(this.profile.ultimate)
      ) {
        this.lastDecision = "Fúria Saiyajin";
        return this.choose({ ...neutral(), pressed: ["ultimate"] }, "Fúria Saiyajin");
      }
      if (
        lowHealth &&
        distance < 100 &&
        self.gokuTeleportLock === 0 &&
        this.chance(this.profile.special * 0.2)
      ) {
        this.lastDecision = "reposicionar Goku";
        return this.command([2, 5, 2], "medium", self);
      }
      if (
        distance > 190 &&
        distance < 650 &&
        this.chance(this.profile.special)
      ) {
        const beam =
          enemy.state === "attack" &&
          enemy.phase === "recovery" &&
          remaining > 18;
        this.lastDecision = beam ? "Kamehameha" : "Rajada de Ki";
        return this.command(
          beam ? [2, 1, 4] : [2, 3, 6],
          this.chance(0.3) ? "heavy" : "light",
          self,
        );
      }
    }
    if (
      self.data.superMoves &&
      self.meter >= 200 &&
      distance < 150 &&
      self.stand?.ready &&
      this.chance(this.profile.ultimate)
    ) {
      this.lastDecision = "Road Roller";
      return { ...neutral(), pressed: ["ultimate"] };
    }
    if (self.data.id === "dio" && self.data.specialMoves) {
      if (
        lowHealth &&
        match.temporal.canActivate(self.id) &&
        this.chance(this.profile.special * 0.3)
      ) {
        this.lastDecision = "parar o tempo";
        return this.command([6, 3, 2], "heavy", self);
      }
      if (
        distance > 230 &&
        distance < 700 &&
        this.chance(this.profile.special)
      ) {
        this.lastDecision = "controlar espaço com facas";
        return this.command(
          [2, 3, 6],
          this.chance(0.4) ? "heavy" : "medium",
          self,
        );
      }
      if (
        distance < 140 &&
        self.stand?.ready &&
        this.chance(this.profile.special * 0.5)
      ) {
        this.lastDecision = "Muda Muda";
        return this.command(
          [2, 1, 4],
          this.chance(0.6) ? "light" : "medium",
          self,
        );
      }
    }
    if (
      distance < 75 &&
      (closing || lowHealth || this.chance(0.35)) &&
      this.chance(this.profile.retreat)
    )
      return this.choose(
        {
          direction: away,
          down: false,
          pressed: this.chance(0.3) ? ["dash"] : [],
        },
        "recuar e criar espaço",
      );
    if (
      distance >
      (self.data.id === "goku"
        ? Math.min(this.profile.range, 88)
        : this.profile.range) +
        20
    ) {
      if (
        distance < 310 &&
        !enemy.airborne &&
        !!self.data.moves.draw_medium &&
        this.chance(this.profile.special)
      ) {
        this.lastDecision = "encurtar com saque";
        return this.command(
          [2, 3, 6],
          distance > 210 ? "heavy" : "medium",
          self,
        );
      }
      return this.choose(
        {
          direction: toward,
          down: false,
          pressed:
            distance > 330 && this.chance(0.3)
              ? ["dash"]
              : this.chance(this.profile.jump)
                ? ["jump"]
                : [],
        },
        "aproximar",
      );
    }
    if (
      distance < 78 &&
      !enemy.airborne &&
      !["hitstun", "blockstun", "getup"].includes(enemy.state) &&
      this.chance(this.profile.grab) &&
      !!self.data.moves.throw
    )
      return this.choose({ ...neutral(), pressed: ["throw"] }, "agarrar");
    if (this.chance(0.12))
      return this.choose(
        { direction: away, down: this.chance(0.25), pressed: [] },
        "variar distância",
      );
    const roll = this.random();
    const button: Button =
      roll < 0.48 ? "light" : roll < 0.78 ? "medium" : "heavy";
    return this.choose(
      { ...neutral(), down: this.chance(0.32), pressed: [button] },
      "atacar " + button,
    );
  }
}
