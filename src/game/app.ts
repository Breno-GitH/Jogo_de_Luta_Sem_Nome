import { assetBase } from "../asset-base";
import { Match } from "../engine/combat";
import { KeyboardInput } from "../engine/input";
import { Bot, type Difficulty } from "../engine/bot";
import { FixedLoop } from "../engine/loop";
import { Renderer } from "../render/renderer";
import { Sound } from "../audio/sound";
import { GameSession, type Mode } from "./session";
import { readTower, saveTower, towerComplete, towerFloors, type TowerAttempt } from "./tower";
import { towerResult, towerResume, towerScreen } from "../ui/tower";
import { OnlineClient } from "../net/client";
import { onlineEntry, lobby, onlineResult, escapeText } from "../ui/online";
import { neutral, type InputFrame } from "../engine/types";
import type { DummyBehavior } from "./training";
import type { CharacterId } from "../engine/characters";
import { ONLINE_CHARACTERS } from "../net/protocol";
import {
  menuScreen,
  selectionScreen,
  resultScreen,
  trainingPanel,
  settingsScreen,
  modeName,
  difficultyName,
  type SelectStep,
} from "../ui/screens";
import {
  fighterHero,
  completeRoster,
  fighterInfo,
  movesContent,
  controlsContent,
} from "../ui/catalog";
import { MenuNavigation } from "../ui/navigation";
import {
  readPreferences,
  savePreferences,
  defaults,
  bindingError,
  keyLabel,
  type Bindings,
} from "./preferences";

type Screen =
  | "menu"
  | "selection"
  | "tower"
  | "settings"
  | "info"
  | "online"
  | "onlineLobby"
  | "onlineFight"
  | "onlinePause"
  | "leaveConfirm"
  | "onlineResult"
  | "loading"
  | "fight"
  | "pause"
  | "result";
export class GameApp {
  private renderer: Renderer;
  private preferences = readPreferences();
  private screen: Screen = "menu";
  private keyboardOptions = {
    dashOnDirection: true,
    gamepad: true,
    omnitrix: () => (this.online?.match?.fighters[this.online.seat]?.data.id ?? this.session?.characterId) === "ben",
    bindings: this.preferences.bindings,
    active: () =>
      ["fight", "onlineFight"].includes(this.screen) && this.overlay.hidden,
  };
  private keyboard = new KeyboardInput(this.keyboardOptions);
  private sound = new Sound();
  private demo = new Match();
  private session?: GameSession;
  private online?: OnlineClient;
  private operation = 0;
  private selectedMode: Mode = "versus";
  private selected: CharacterId = "samurai";
  private enemy: CharacterId = "dio";
  private selectStep: SelectStep = "player";
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private loop: FixedLoop;
  private navigation: MenuNavigation;
  private returnInfo = () => this.menu();
  private settingsBack = () => this.menu();
  private leaveBack: Screen = "onlineFight";
  private remapping?: keyof Bindings;
  private onlineBusy = false;
  private lastInput = "";
  private inputHistory: string[] = [];
  private fpsAt = performance.now();
  private fpsFrames = 0;
  constructor(private root: HTMLDivElement) {
    root.innerHTML = `<header><a class="brand" href="#">SEM<span>NOME</span><small>FIGHTING PROJECT</small></a><span class="build">${completeRoster.length} LUTADORES <b>ARCADE / LAN</b></span></header><main><div class="topline"><span><i></i> ESCOLHA SEU ESTILO. ENCONTRE SUA ABERTURA.</span><span id="mode-label">PRONTO PARA O PRÓXIMO ROUND</span></div><div class="stage"><canvas width="1280" height="720" tabindex="0" aria-label="Arena de combate"></canvas><output id="fps" hidden>60 FPS</output><section id="overlay" aria-label="Interface do jogo"></section></div><div class="toolbar"><span id="status" role="status">Selecione um modo</span><div><button id="sound">Som</button><button id="boxes">Caixas: desligadas</button><button id="restart" disabled>Reiniciar</button><button id="pause" disabled>Pausar · Esc</button><button id="menu">Menu</button></div></div><div id="network-info" class="network-info" hidden role="status"></div>${trainingPanel()}<footer></footer></main>`;
    this.canvas = this.el<HTMLCanvasElement>("canvas", true);
    this.overlay = this.el("overlay");
    this.renderer = new Renderer(this.canvas);
    this.navigation = new MenuNavigation(
      this.overlay,
      () => !this.overlay.hidden && !this.remapping,
      () => this.back(),
      () => this.sound.play("menu"),
    );
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.remapping) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.repeat) return;
          if (e.code === "Escape") {
            this.remapping = undefined;
            this.settings(false);
            return;
          }
          const error = bindingError(
            this.preferences.bindings,
            this.remapping,
            e.code,
          );
          if (error) {
            this.el("settings-message").textContent = error;
            return;
          }
          this.preferences.bindings[this.remapping] = e.code;
          this.remapping = undefined;
          this.persist();
          this.settings(false);
          return;
        }
        if (e.code === "Escape" && !e.repeat && this.overlay.hidden) {
          e.preventDefault();
          this.togglePause();
        }
      },
      true,
    );
    this.el("menu").onclick = () =>
      this.online?.room ? this.confirmLeave() : this.menu();
    root.querySelector<HTMLAnchorElement>(".brand")!.onclick = (e) => {
      e.preventDefault();
      if (this.online?.room) this.confirmLeave();
      else this.menu();
    };
    this.el("pause").onclick = () => this.togglePause();
    this.el("restart").onclick = () => this.restart();
    this.el("boxes").onclick = () => {
      this.renderer.debug = !this.renderer.debug;
      this.el("boxes").textContent =
        `Caixas: ${this.renderer.debug ? "ligadas" : "desligadas"}`;
    };
    this.el("sound").onclick = () => {
      this.preferences.muted = !this.preferences.muted;
      this.persist();
      void this.sound.unlock();
      this.sound.play("menu");
    };
    this.canvas.onpointerdown = () =>
      this.canvas.focus({ preventScroll: true });
    window.addEventListener("blur", () => this.autoPause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.autoPause();
    });
    window.addEventListener("resize", () => this.applyScale());
    document.addEventListener("fullscreenchange", () => {
      this.applyScale();
      if (this.screen === "settings")
        this.el("fullscreen").textContent = document.fullscreenElement
          ? "Sair da tela cheia"
          : "Tela cheia";
    });
    this.bindTraining();
    this.applyPreferences();
    this.loop = new FixedLoop(
      () => this.tick(),
      () => this.draw(),
    );
    this.loop.start();
    this.menu();
  }
  private el<T extends HTMLElement = HTMLElement>(
    id: string,
    selector = false,
  ) {
    return this.root.querySelector<T>(selector ? id : `#${id}`)!;
  }
  private setScreen(screen: Screen) {
    this.screen = screen;
    this.root.dataset.screen = screen;
    this.keyboard.clear();
  }
  private show(html: string, screen: Screen) {
    const previous =
      this.screen === screen ? (document.activeElement as HTMLElement)?.id : "";
    this.setScreen(screen);
    this.overlay.hidden = false;
    this.overlay.innerHTML = html;
    if (previous && this.root.querySelector(`#${CSS.escape(previous)}`))
      this.el(previous).focus({ preventScroll: true });
    else this.navigation.focus();
  }
  private bind(id: string, action: () => void) {
    const el = this.root.querySelector<HTMLElement>(`#${id}`);
    if (el) el.onclick = action;
  }
  private cue() {
    void this.sound.unlock();
    this.sound.play("menu");
  }
  private footer(id: CharacterId = this.selected) {
    this.root.querySelector("footer")!.innerHTML =
      `<div>${controlsContent(this.preferences.bindings, id)}</div><div class="footer-moves">${movesContent(id, this.preferences.bindings)}</div>`;
  }
  private menu() {
    this.operation++;
    this.online?.dispose();
    this.online = undefined;
    this.session = undefined;
    this.sound.setBossMusic(false);
    this.remapping = undefined;
    this.demo = new Match();
    this.demo.message = "";
    this.renderer.resetAnimations();
    this.renderer.localSeat = 0;
    this.renderer.online = false;
    this.renderer.opponentPalette = "cyan";
    this.renderer.opponentLabel = "02 / BOT";
    this.renderer.contextLabel = "MELHOR DE 3";
    this.show(menuScreen(), "menu");
    this.root.dataset.mode = "menu";
    this.el("training-panel").hidden = true;
    this.el("network-info").hidden = true;
    this.el("menu").textContent = "Menu";
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    this.el("status").textContent =
      "W/S navegar · Enter confirmar · Esc voltar · Mouse para selecionar";
    this.el("mode-label").textContent = "PRONTO PARA O PRÓXIMO ROUND";
    for (const [id, mode] of [
      ["versus", "versus"],
      ["training", "training"],
    ] as const)
      this.bind(id, () => {
        this.cue();
        this.selection(mode);
      });
    this.bind("arcade", () => {
      this.cue();
      const { attempt, best } = readTower();
      if (!attempt || towerComplete(attempt)) {
        this.selection("arcade");
        return;
      }
      this.root.dataset.mode = "arcade";
      this.show(towerResume(attempt, best), "tower");
      this.bind("continue-tower", () => this.startTower(attempt));
      this.bind("new-tower", () => this.selection("arcade"));
      this.bind("back", () => this.menu());
    });
    this.bind("online", () => {
      this.cue();
      void this.enterOnline();
    });
    this.bind("settings", () => {
      this.cue();
      this.settingsBack = () => this.menu();
      this.settings();
    });
    this.footer();
  }
  private startTower(attempt?: TowerAttempt) {
    this.session = new GameSession("arcade", "normal", this.selected, this.enemy, attempt);
    saveTower(this.session.tower!);
    this.presentTower();
  }
  private presentTower() {
    const session = this.session!;
    this.sound.setBossMusic(session.stage === towerFloors.length - 1);
    this.show(towerScreen(session, Math.max(readTower().best, session.results.length)), "tower");
    Object.assign(this.root.dataset, {
      mode: "arcade",
      stage: String(session.stage + 1),
      character: session.characterId,
    });
    this.el("mode-label").textContent = `ARCADE TORRE / ANDAR ${session.stage + 1}`;
    this.el("status").textContent = `PRÓXIMO CONFRONTO · ${session.opponentName.toUpperCase()}`;
    this.bind("fight", () => { this.cue(); void this.enter(); });
    this.bind("back", () => this.menu());
  }
  private selection(mode: Mode, step: SelectStep = "player") {
    this.selectedMode = mode;
    if (mode !== "training" && this.selected === "ben") this.selected = "samurai";
    this.selectStep = step;
    this.show(
      selectionScreen(mode, this.selected, this.enemy, step),
      "selection",
    );
    this.root.dataset.mode = mode;
    this.root.dataset.selectStep = step;
    this.el("mode-label").textContent =
      `${modeName[mode].toUpperCase()} / SELEÇÃO`;
    this.root
      .querySelectorAll<HTMLInputElement>(".character-card input")
      .forEach(
        (input) =>
          (input.onchange = () => {
            const id = input.value as CharacterId;
            if (step === "player") this.selected = id;
            else this.enemy = id;
            this.el("fighter-hero").innerHTML = fighterHero(id);
            this.footer(id);
            this.root
              .querySelectorAll(".character-card")
              .forEach((card) =>
                card.classList.toggle(
                  "selected",
                  card.querySelector<HTMLInputElement>("input")!.checked,
                ),
              );
            this.sound.play("menu");
          }),
      );
    this.root
      .querySelector<HTMLElement>(
        step === "ready" ? "#fight" : ".character-card input:checked",
      )
      ?.focus({ preventScroll: true });
    this.bind("confirm-character", () => {
      this.cue();
      if (mode === "arcade") this.startTower();
      else this.selection(mode, step === "player" ? "opponent" : "ready");
    });
    this.bind("back", () => this.selectionBack());
    this.bind("fight", () => {
      if (this.screen !== "selection" || this.selectStep !== "ready") return;
      this.cue();
      const difficulty = this.el<HTMLSelectElement>("difficulty").value as Difficulty;
      this.session = new GameSession(
        mode,
        difficulty,
        this.selected,
        this.enemy,
      );
      void this.enter();
    });
  }
  private selectionBack() {
    this.selectStep === "player"
      ? this.menu()
      : this.selection(
          this.selectedMode,
          this.selectStep === "ready" && this.selectedMode !== "arcade"
            ? "opponent"
            : "player",
        );
  }
  private async enter() {
    const session = this.session;
    if (!session) return;
    const token = ++this.operation;
    this.show(
      `<div class="panel loading"><span class="eyebrow">${modeName[session.mode].toUpperCase()}</span><h2>Preparando a arena…</h2><p>${session.match.fighters[0].data.name} × ${session.match.fighters[1].data.name}</p><button class="text" id="cancel-load">Retornar ao menu</button></div>`,
      "loading",
    );
    this.bind("cancel-load", () => this.menu());
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    try {
      await this.renderer.preparePalette(session.palette);
      if (token !== this.operation) return;
      this.renderer.opponentPalette = session.palette;
      this.renderer.resetAnimations();
      this.renderer.opponentLabel = session.opponentName.toUpperCase();
      this.renderer.contextLabel =
        session.mode === "arcade"
          ? `ARCADE ${session.stage + 1} / ${session.route.length}`
          : session.mode === "training"
            ? "TREINAMENTO"
            : "MELHOR DE 3";
      this.setScreen("fight");
      this.overlay.hidden = true;
      this.el("training-panel").hidden = session.mode !== "training";
      this.el<HTMLButtonElement>("pause").disabled = false;
      this.el<HTMLButtonElement>("restart").disabled = false;
      this.el("pause").textContent = "Pausar · Esc";
      Object.assign(this.root.dataset, {
        mode: session.mode,
        stage: String(session.stage + 1),
        difficulty: session.currentDifficulty,
        character: session.characterId,
      });
      this.canvas.setAttribute(
        "aria-label",
        `Arena: ${session.match.fighters[0].data.name} contra ${session.match.fighters[1].data.name}`,
      );
      this.footer(session.characterId);
      this.inputHistory = [];
      this.lastInput = "";
      this.el("mode-label").textContent =
        session.mode === "arcade"
          ? `ARCADE TORRE / ANDAR ${session.stage + 1} DE ${session.route.length}`
          : modeName[session.mode].toUpperCase();
      this.el("status").textContent =
        `${modeName[session.mode].toUpperCase()} / ${session.opponentName.toUpperCase()} / ${(session.tower ? towerFloors[session.stage].label : difficultyName[session.currentDifficulty]).toUpperCase()}`;
      this.syncTraining();
      this.renderer.tick(session.match);
      this.canvas.focus({ preventScroll: true });
      if (document.hidden) this.autoPause();
    } catch (error) {
      if (token !== this.operation) return;
      this.show(
        `<div class="panel"><h2>A arena não carregou</h2><p>Não foi possível carregar um recurso do jogo.</p><button class="primary" id="retry-load">Tentar novamente</button><button class="text" id="return">Menu principal</button></div>`,
        "loading",
      );
      this.bind("retry-load", () => void this.enter());
      this.bind("return", () => this.menu());
      console.error(error);
    }
  }
  private restart() {
    if (!this.session) return;
    this.session.restart();
    void this.enter();
  }
  private resume() {
    this.setScreen(this.online ? "onlineFight" : "fight");
    this.overlay.hidden = true;
    this.el("pause").textContent = this.online ? "Menu · Esc" : "Pausar · Esc";
    this.canvas.focus({ preventScroll: true });
    this.cue();
  }
  private togglePause() {
    if (this.screen === "pause" || this.screen === "onlinePause") {
      this.resume();
      return;
    }
    if (!["fight", "onlineFight"].includes(this.screen)) return;
    const net = !!this.online;
    this.show(
      `<div class="panel pause-panel"><span class="eyebrow">${net ? "MENU LOCAL / A LUTA CONTINUA" : "COMBATE PAUSADO"}</span><h2>${net ? "Seu adversário continua jogando" : "Próximo movimento?"}</h2>${net ? "<p>Este menu não pausa o servidor. Seus comandos ficam neutros enquanto ele estiver aberto.</p>" : ""}<button class="primary" id="resume">CONTINUAR</button><button id="pause-moves">Lista de golpes</button><button id="pause-controls">Controles</button>${net ? `<button id="pause-menu">Sair da partida</button>` : `<button id="pause-options">Opções</button><button id="pause-restart">Reiniciar partida</button><button id="pause-menu">Menu principal</button>`}</div>`,
      net ? "onlinePause" : "pause",
    );
    this.bind("resume", () => this.resume());
    this.bind("pause-moves", () => this.info("moves", () => this.pauseAgain()));
    this.bind("pause-controls", () =>
      this.info("controls", () => this.pauseAgain()),
    );
    this.bind("pause-options", () => {
      this.settingsBack = () => this.pauseAgain();
      this.settings();
    });
    this.bind("pause-restart", () => this.restart());
    this.bind("pause-menu", () => (net ? this.confirmLeave() : this.menu()));
    this.el("pause").textContent = "Continuar · Esc";
  }
  private pauseAgain() {
    this.screen = this.online ? "onlineFight" : "fight";
    this.togglePause();
  }
  private autoPause() {
    if (this.screen === "fight") this.togglePause();
  }
  private back() {
    if (this.screen === "selection") this.selectionBack();
    else if (this.screen === "settings") this.settingsBack();
    else if (this.screen === "info") this.returnInfo();
    else if (["pause", "onlinePause"].includes(this.screen)) this.resume();
    else if (this.screen === "leaveConfirm") this.cancelLeave();
    else if (this.screen === "onlineLobby" || this.screen === "onlineResult")
      this.confirmLeave();
    else if (this.screen !== "menu") this.menu();
  }
  private info(kind: "moves" | "controls", back: () => void) {
    this.returnInfo = back;
    const id = (this.online?.match?.fighters[this.online.seat].data.id ??
      this.session?.characterId ??
      this.selected) as CharacterId;
    this.show(
      `<div class="panel info-panel"><span class="eyebrow">${fighterInfo(id).name.toUpperCase()}</span><h2>${kind === "moves" ? "Lista de golpes" : "Controles"}</h2>${kind === "moves" ? movesContent(id, this.preferences.bindings) : controlsContent(this.preferences.bindings, id)}<button class="primary" id="back">Voltar</button></div>`,
      "info",
    );
    this.bind("back", back);
  }
  private settings(refocus = true) {
    this.show(settingsScreen(this.preferences), "settings");
    for (const id of ["master", "effects", "music"] as const)
      this.el<HTMLInputElement>(`opt-${id}`).oninput = (e) => {
        this.preferences[id] =
          Number((e.target as HTMLInputElement).value) / 100;
        this.el(`value-${id}`).textContent =
          `${Math.round(this.preferences[id] * 100)}%`;
        this.persist();
        void this.sound.unlock();
      };
    for (const id of ["muted", "pixelPerfect", "shake", "fps"] as const)
      this.el<HTMLInputElement>(`opt-${id}`).onchange = (e) => {
        this.preferences[id] = (e.target as HTMLInputElement).checked;
        this.persist();
      };
    this.el<HTMLSelectElement>("opt-scale").onchange = (e) => {
      this.preferences.scale = (e.target as HTMLSelectElement).value as
        "fit" | "1" | "2";
      this.persist();
    };
    this.bind("test-sound", () => {
      void this.sound.unlock().then(() => this.sound.play("heavy"));
    });
    this.bind("fullscreen", () => {
      void (
        document.fullscreenElement
          ? document.exitFullscreen()
          : this.root.requestFullscreen()
      ).catch(() => {
        this.el("settings-message").textContent =
          "O navegador recusou a tela cheia. Use F11 se necessário.";
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-bind]").forEach(
      (button) =>
        (button.onclick = () => {
          this.remapping = button.dataset.bind as keyof Bindings;
          button.textContent = "Pressione…";
          this.el("settings-message").textContent =
            "Pressione a nova tecla. Esc cancela. Teclas em conflito serão recusadas.";
        }),
    );
    this.bind("reset-options", () => {
      this.preferences = defaults();
      this.persist();
      this.settings();
    });
    this.bind("back", () => this.settingsBack());
    if (refocus) this.navigation.focus();
  }
  private persist() {
    const saved = savePreferences(this.preferences);
    this.applyPreferences();
    if (!saved && this.screen === "settings")
      this.el("settings-message").textContent =
        "Configurações aplicadas. O navegador bloqueou o armazenamento local.";
  }
  private applyPreferences() {
    const p = this.preferences;
    this.keyboardOptions.bindings = p.bindings;
    this.keyboard.clear();
    this.sound.configure(p.master, p.effects, p.music, p.muted);
    this.renderer.cameraShake = p.shake;
    this.renderer.superKey = keyLabel(p.bindings.ultimate);
    this.el("sound").textContent = this.sound.available
      ? `Som: ${p.muted ? "desligado" : "ligado"}`
      : "Áudio indisponível";
    this.el<HTMLButtonElement>("sound").disabled = !this.sound.available;
    this.el("fps").hidden = !p.fps;
    this.applyScale();
    this.footer(
      (this.online?.match?.fighters[this.online.seat].data.id ??
        this.session?.characterId ??
        this.selected) as CharacterId,
    );
  }
  private applyScale() {
    const width = Math.min(
      this.root.querySelector("main")!.clientWidth -
        (innerWidth < 800 ? 24 : 64),
      (Math.max(320, innerHeight - 150) * 16) / 9,
    );
    let scale = Math.min(
      width / 1280,
      this.preferences.scale === "fit"
        ? Infinity
        : Number(this.preferences.scale),
    );
    if (this.preferences.pixelPerfect && scale >= 1) scale = Math.floor(scale);
    this.root.style.setProperty(
      "--stage-width",
      `${Math.max(240, Math.floor(1280 * scale))}px`,
    );
    this.root.dataset.pixelPerfect = String(this.preferences.pixelPerfect);
  }
  private finish() {
    const session = this.session!;
    if (session.tower) saveTower(session.tower);
    this.show(session.tower ? towerResult(session, Math.max(readTower().best, session.results.length)) : resultScreen(session), "result");
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    this.bind("return", () => this.menu());
    this.bind("change-character", () => this.selection(session.mode));
    this.bind("next-opponent", () => {
      this.cue();
      if (session.next()) this.presentTower();
    });
    this.bind("again", () => {
      this.cue();
      if (session.tower) {
        if (session.status === "victory") {
          this.selected = session.characterId;
          this.startTower();
        } else {
          session.restart();
          this.presentTower();
        }
      } else this.restart();
    });
  }
  private recordInput(input: InputFrame) {
    const b = this.preferences.bindings;
    const label =
      [
        input.down ? "↓" : "",
        input.direction < 0 ? "←" : input.direction > 0 ? "→" : "",
        ...input.pressed.map((a) => keyLabel(b[a === "jump" ? "jump" : a])),
      ]
        .filter(Boolean)
        .join("+") || "·";
    if (label !== this.lastInput) {
      this.lastInput = label;
      if (label !== "·")
        this.inputHistory = [...this.inputHistory.slice(-8), label];
    }
  }
  private tick() {
    if (this.online?.match) {
      const active =
        this.online.canControl &&
        this.screen === "onlineFight" &&
        this.overlay.hidden;
      this.online.advance(active ? this.keyboard.sample() : neutral(), active);
      if (!active) this.keyboard.clear();
    } else if (this.screen === "fight" && this.session) {
      const match = this.session.match,
        frozen = match.phase === "fight" && match.hitstop > 0,
        input = this.keyboard.sample();
      this.recordInput(input);
      this.session.step(input);
      if (!frozen) this.renderer.tick(match);
      this.sound.tick(match);
      if (this.session.status !== "playing") this.finish();
      if (
        this.session.mode === "training" &&
        (match.frame % 4 === 0 || match.hits.length)
      )
        this.trainingReadout();
    } else if (!this.session) this.renderer.tick(this.demo);
  }
  private draw() {
    const bindings = this.preferences.bindings;
    this.renderer.chainKeys = this.keyboard.activeChainKeys ?? [bindings.light, bindings.medium, bindings.heavy].map(keyLabel);
    this.renderer.draw(this.online?.match ?? this.session?.match ?? this.demo);
    if (this.online) {
      const c = this.online;
      Object.assign(this.root.dataset, {
        connection: c.connected
          ? c.syncing
            ? "syncing"
            : "connected"
          : "disconnected",
        netTick: String(c.tick),
        netHash: c.stateHash,
        netMatch: c.matchId,
        resyncs: String(c.resyncs),
      });
      this.el("network-info").textContent =
        `${c.connectionText} · Sala ${c.room?.code ?? "—"}${c.match ? ` · Jogador ${c.seat + 1} · entradas com atraso controlado` : ""}`;
    }
    this.root.dataset.sessionStatus = this.session?.status ?? "none";
    this.root.dataset.audio = this.sound.state;
    this.root.dataset.lastSound = this.sound.lastCue;
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsAt >= 500) {
      this.el("fps").textContent =
        `${Math.round((this.fpsFrames * 1000) / (now - this.fpsAt))} FPS · 60 Hz`;
      this.fpsFrames = 0;
      this.fpsAt = now;
    }
  }
  private async enterOnline() {
    const token = ++this.operation;
    this.session = undefined;
    this.online?.dispose();
    this.online = undefined;
    this.root.dataset.mode = "online";
    this.el("training-panel").hidden = true;
    this.show(onlineEntry(), "online");
    this.bind("back", () => this.menu());
    this.bind("reconnect-online", () => void this.enterOnline());
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    this.el("menu").textContent = "Sair de LAN";
    this.el("mode-label").textContent = "MULTIPLAYER LAN / SALA PRIVADA";
    try {
      await this.renderer.preparePalette("cyan");
      if (token !== this.operation) return;
      const client = new OnlineClient();
      this.online = client;
      this.renderer.opponentPalette = "cyan";
      this.renderer.online = true;
      this.renderer.contextLabel = "LAN · MELHOR DE 3";
      client.onChange = () => {
        if (this.online === client) this.onlineChanged();
      };
      client.onReset = () => {
        if (this.online !== client) return;
        this.keyboard.clear();
        this.renderer.localSeat = client.seat;
        this.renderer.resetAnimations();
        if (client.match) {
          this.renderer.tick(client.match);
          this.footer(
            client.match.fighters[client.seat].data.id as CharacterId,
          );
        }
        this.canvas.focus({ preventScroll: true });
      };
      client.onStep = (match, frozen) => {
        if (!frozen) this.renderer.tick(match);
        this.sound.tick(match, client.matchId);
      };
      this.el("network-info").hidden = false;
      this.onlineChanged();
    } catch (error) {
      if (token !== this.operation) return;
      this.show(
        `<div class="panel"><h2>Não foi possível preparar a arena</h2><p>Recarregue os recursos do jogo e tente novamente.</p><button id="back">Menu principal</button></div>`,
        "online",
      );
      this.bind("back", () => this.menu());
      console.error(error);
    }
  }
  private onlineChanged() {
    const c = this.online;
    if (!c) return;
    this.el<HTMLButtonElement>("pause").disabled = !c.match || !!c.result;
    if (c.result) {
      this.show(onlineResult(c), "onlineResult");
      this.bind("reconnect-online", () => c.retry());
      this.bind("leave-room", () => this.confirmLeave());
      this.bind(
        "online-rematch",
        () => void this.onlineAction(() => c.rematch()),
      );
      this.bind(
        "online-lobby",
        () => void this.onlineAction(() => c.returnToLobby()),
      );
      return;
    }
    if (c.match && !c.fatal) {
      const blocked =
        !c.connected ||
        c.syncing ||
        c.reconnecting ||
        c.room?.status === "reconnecting";
      if (blocked) {
        this.show(
          `<div class="panel"><span class="eyebrow">LUTA EM ESPERA</span><h2>${c.syncing ? "Sincronizando…" : "Recuperando conexão…"}</h2><p>${escapeText(c.message)}</p><button id="leave-room">Sair da sala</button></div>`,
          "onlineFight",
        );
        this.bind("leave-room", () => this.confirmLeave());
      } else if (
        !["onlinePause", "info", "leaveConfirm"].includes(this.screen)
      ) {
        const entering = this.screen !== "onlineFight" || !this.overlay.hidden;
        if (this.screen !== "onlineFight") this.setScreen("onlineFight");
        this.overlay.hidden = true;
        if (entering) this.canvas.focus({ preventScroll: true });
      }
      this.el("status").textContent =
        c.message || "MULTIPLAYER LAN / COMBATE CONFIRMADO PELO SERVIDOR";
      this.el("pause").textContent = "Menu · Esc";
      return;
    }
    if (c.room && !c.fatal) {
      if (this.screen === "leaveConfirm") return;
      this.show(lobby(c), "onlineLobby");
      this.footer(c.room.players[c.seat]?.character ?? this.selected);
      this.el("status").textContent =
        `SALA ${c.room.code} / JOGADOR ${c.seat + 1}`;
      this.bind("leave-room", () => this.confirmLeave());
      this.bind("copy-code", () => void this.copyRoomCode(c));
      for (const character of ONLINE_CHARACTERS)
        this.el<HTMLInputElement>(`online-${character}`).onchange = () =>
          void this.onlineAction(() => c.select(character));
      this.bind(
        "online-confirm",
        () => void this.onlineAction(() => c.confirm()),
      );
      this.bind(
        "online-start",
        () => void this.onlineAction(() => c.startMatch()),
      );
      this.bind(
        "online-ready",
        () =>
          void this.onlineAction(() =>
            c.ready(!c.room!.players[c.seat]?.ready),
          ),
      );
      this.el("online-error").textContent = c.message;
      return;
    }
    const code =
      this.root.querySelector<HTMLInputElement>("#room-code")?.value ?? "";
    this.show(onlineEntry(c), "online");
    this.el<HTMLInputElement>("room-code").value = code;
    this.el("status").textContent =
      `MULTIPLAYER LAN / ${c.connectionText.toUpperCase()}`;
    this.bind("back", () => this.menu());
    this.bind("reconnect-online", () => c.retry());
    this.bind("create-room", () => void this.onlineAction(() => c.create()));
    this.el<HTMLFormElement>("join-form").onsubmit = (e) => {
      e.preventDefault();
      const value = this.el<HTMLInputElement>("room-code").value;
      void this.onlineAction(() => c.join(value));
    };
  }
  private async onlineAction(action: () => Promise<void>) {
    const c = this.online;
    if (!c || this.onlineBusy) return;
    this.onlineBusy = true;
    this.overlay.setAttribute("aria-busy", "true");
    try {
      c.message = "";
      await action();
    } catch (error) {
      if (this.online === c) {
        c.message = (error as Error).message;
        this.onlineChanged();
      }
    } finally {
      this.onlineBusy = false;
      this.overlay.removeAttribute("aria-busy");
    }
  }
  private confirmLeave() {
    this.leaveBack = this.screen;
    this.show(
      `<div class="panel"><span class="eyebrow">SAIR DA SALA</span><h2>Encerrar sua participação?</h2><p>O servidor avisará o adversário. Uma luta em andamento será encerrada para você.</p><button class="primary" id="keep-playing">Permanecer</button><button id="confirm-leave">Sair da sala</button></div>`,
      "leaveConfirm",
    );
    this.bind("keep-playing", () => this.cancelLeave());
    this.bind("confirm-leave", () => this.menu());
  }
  private cancelLeave() {
    const previous = this.leaveBack;
    this.screen = previous;
    if (["onlinePause", "info", "onlineFight"].includes(previous))
      this.pauseAgain();
    else this.onlineChanged();
  }
  private async copyRoomCode(c: OnlineClient) {
    try {
      if (!navigator.clipboard) throw Error();
      await navigator.clipboard.writeText(c.room!.code);
      this.el("copy-code").textContent = "Copiado";
    } catch {
      const node = this.el("lobby-code"),
        range = document.createRange();
      range.selectNodeContents(node);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      this.el("copy-code").textContent = "Selecionado · Ctrl+C";
    }
  }
  private bindTraining() {
    for (const id of [
      "infinite-health",
      "unlimited-meter",
      "dummy",
      "training-difficulty",
    ])
      this.el(id).onchange = () => {
        const s = this.session;
        if (!s || s.mode !== "training") return;
        const previous = s.training.dummy;
        s.training.infiniteHealth =
          this.el<HTMLInputElement>("infinite-health").checked;
        s.training.unlimitedMeter =
          this.el<HTMLInputElement>("unlimited-meter").checked;
        s.training.dummy = this.el<HTMLSelectElement>("dummy")
          .value as DummyBehavior;
        const difficulty = this.el<HTMLSelectElement>("training-difficulty")
          .value as Difficulty;
        if (s.difficulty !== difficulty || previous !== s.training.dummy) {
          s.difficulty = difficulty;
          s.bot = new Bot(difficulty);
        }
        this.el("training-difficulty-label").hidden =
          s.training.dummy !== "bot";
        this.trainingStatus(s);
        s.training.configure(s.match);
        this.trainingValues();
        this.keyboard.clear();
        this.canvas.focus({ preventScroll: true });
      };
    for (const i of [0, 1])
      for (const kind of ["health", "meter"] as const)
        this.el<HTMLInputElement>(kind + "-" + i).onchange = (e) => {
          const s = this.session;
          if (!s || s.mode !== "training") return;
          const field = e.target as HTMLInputElement,
            value = Math.max(
              kind === "health" ? 1 : 0,
              Math.min(100, Number(field.value) || 0),
            );
          field.value = String(value);
          const f = s.match.fighters[i];
          if (kind === "health") {
            s.training.infiniteHealth = false;
            this.el<HTMLInputElement>("infinite-health").checked = false;
            f.health = Math.round((f.data.health * value) / 100);
          } else {
            s.training.unlimitedMeter = false;
            this.el<HTMLInputElement>("unlimited-meter").checked = false;
            f.meter = (f.meterMaximum * value) / 100;
          }
          this.keyboard.clear();
          this.canvas.focus({ preventScroll: true });
        };
    this.bind("training-moves", () => {
      if (this.screen !== "fight") return;
      this.info("moves", () => this.resume());
    });
    this.bind("reset-positions", () => this.restart());
    this.bind("clear-damage", () => {
      const s = this.session;
      if (!s || s.mode !== "training") return;
      const values = s.match.fighters.map((f) => ({
        x: f.x,
        health: f.health,
        meter: f.meter,
      }));
      s.restart();
      s.match.fighters.forEach((f, i) => Object.assign(f, values[i]));
      this.renderer.resetAnimations();
      this.renderer.tick(s.match);
      this.trainingValues();
      this.trainingReadout();
      this.keyboard.clear();
      this.canvas.focus({ preventScroll: true });
    });
    for (const [id, type, value] of [
      ["refill-health", "health", 1],
      ["fill-meter", "meter", 1],
      ["empty-meter", "meter", 0],
    ] as const)
      this.bind(id, () => {
        const s = this.session;
        if (!s || s.mode !== "training") return;
        if (type === "meter" && value === 0) {
          s.training.unlimitedMeter = false;
          this.el<HTMLInputElement>("unlimited-meter").checked = false;
        }
        for (const f of s.match.fighters)
          if (type === "health") f.health = f.data.health;
          else f.meter = value * f.meterMaximum;
        this.trainingValues();
        this.canvas.focus({ preventScroll: true });
      });
  }
  private syncTraining() {
    const s = this.session!;
    if (s.mode !== "training") return;
    this.el<HTMLInputElement>("infinite-health").checked =
      s.training.infiniteHealth;
    this.el<HTMLInputElement>("unlimited-meter").checked =
      s.training.unlimitedMeter;
    this.el<HTMLSelectElement>("dummy").value = s.training.dummy;
    this.el<HTMLSelectElement>("training-difficulty").value = s.difficulty;
    this.el("training-difficulty-label").hidden = s.training.dummy !== "bot";
    this.trainingStatus(s);
    this.trainingValues();
    this.trainingReadout();
  }
  private trainingValues() {
    const s = this.session;
    if (!s || s.mode !== "training") return;
    s.match.fighters.forEach((f, i) => {
      this.el<HTMLInputElement>(`health-${i}`).value = String(
        Math.round((100 * f.health) / f.data.health),
      );
      this.el<HTMLInputElement>(`meter-${i}`).value = String(
        Math.round((100 * f.meter) / f.meterMaximum),
      );
    });
  }
  private trainingStatus(s: GameSession) {
    this.root.dataset.difficulty = s.currentDifficulty;
    this.el("status").textContent =
      `TREINAMENTO / ${this.el<HTMLSelectElement>("dummy").selectedOptions[0].textContent?.toUpperCase()} / ${difficultyName[s.currentDifficulty]}`;
  }
  private trainingReadout() {
    const s = this.session;
    if (!s) return;
    const stats = s.training.damage.fighters[0];
    for (const [id, value] of [
      ["last-damage", stats.lastHit],
      ["combo-damage", stats.comboDamage],
      ["combo-hits", stats.comboHits],
      ["best-hits", stats.bestHits],
      ["total-damage", stats.totalDamage],
    ] as const)
      this.el(id).textContent = String(value);
    s.match.fighters.forEach(
      (f, i) =>
        (this.el(i ? "dummy-state" : "player-state").textContent =
          `${f.state} · ${f.moveId || "—"} · ${f.attackPhase || "—"} · tick ${f.stateFrame}`),
    );
    this.el("ai-decision").textContent =
      s.training.dummy === "bot" ? s.bot.lastDecision : "desligada";
    this.el("input-history").textContent =
      this.inputHistory.join("  ›  ") || "—";
  }
}
