import { assetBase } from "../asset-base";
import { combatPace } from "../engine/pace";
import { Match } from "../engine/combat";
import { KeyboardInput } from "../engine/input";
import { Bot, type Difficulty } from "../engine/bot";
import { FixedLoop } from "../engine/loop";
import { Renderer } from "../render/renderer";
import { Sound } from "../audio/sound";
import { GameSession, type Mode } from "./session";
import { OnlineClient } from "../net/client";
import { onlineEntry, lobby, onlineResult, escapeText } from "../ui/online";
import { neutral } from "../engine/types";
import type { DummyBehavior } from "./training";
import type { CharacterId } from "../engine/characters";
import { ONLINE_CHARACTERS } from "../net/protocol";
import {
  menuScreen,
  selectionScreen,
  resultScreen,
  trainingPanel,
  modeName,
  difficultyName,
} from "../ui/screens";

type Screen =
  | "menu"
  | "selection"
  | "online"
  | "onlineLobby"
  | "onlineFight"
  | "onlineResult"
  | "loading"
  | "fight"
  | "pause"
  | "result";
export class GameApp {
  private renderer: Renderer;
  private keyboardOptions = { dashOnDirection: false };
  private keyboard = new KeyboardInput(this.keyboardOptions);
  private sound = new Sound();
  private demo = new Match();
  private session?: GameSession;
  private online?: OnlineClient;
  private screen: Screen = "menu";
  private operation = 0;
  private selectedMode: Mode = "versus";
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private loop: FixedLoop;
  private samuraiControls = "";
  constructor(private root: HTMLDivElement) {
    root.innerHTML = `<header><a class="brand" href="#">SEM<span>NOME</span><small>FIGHTING PROJECT</small></a><span class="build">SAMURAI <b>PLAYABLE 0.2</b></span></header><main><div class="topline"><span><i></i> DOMINE O ESPAÇO. CONFIRME O CORTE.</span><span id="mode-label">ESCOLHA SEU CONFRONTO</span></div><div class="stage"><canvas width="1280" height="720" tabindex="0" aria-label="Arena de combate Samurai contra Samurai"></canvas><section id="overlay"></section></div><div class="toolbar"><span id="status" role="status">Selecione um modo para começar</span><div><a class="art-link" href="${assetBase}art/samurai.html" target="_blank" rel="noopener">Animações</a><button id="sound">Som: ligado</button><label class="volume-label">Volume <input id="volume" aria-label="Volume dos efeitos" type="range" min="0" max="60" value="25"></label><button id="boxes">Caixas: desligadas</button><button id="restart" disabled>Reiniciar</button><button id="pause" disabled>Pausar · Esc</button><button id="menu">Menu</button></div></div>${trainingPanel()}<footer><div><kbd>A</kbd><kbd>D</kbd> mover <kbd>W</kbd> pular <kbd>S</kbd> agachar</div><div><kbd>J</kbd> leve <kbd>K</kbd> médio <kbd>L</kbd> forte <kbd>U</kbd> agarrar <kbd>R</kbd> Super <kbd>T</kbd> provocar</div><div><kbd>Shift</kbd> + direção: dash <span>• Para trás: defender • Esc: pausar</span></div></footer></main>`;
    this.canvas = this.el<HTMLCanvasElement>("canvas", true);
    this.samuraiControls = this.root.querySelector("footer")!.innerHTML;
    this.overlay = this.el("overlay");
    const networkInfo = document.createElement("div");
    networkInfo.id = "network-info";
    networkInfo.className = "network-info";
    networkInfo.hidden = true;
    networkInfo.setAttribute("role", "status");
    this.el("status").closest(".toolbar")!.after(networkInfo);
    this.renderer = new Renderer(this.canvas);
    this.el("menu").onclick = () => this.menu();
    root.querySelector<HTMLAnchorElement>(".brand")!.onclick = (event) => {
      event.preventDefault();
      this.menu();
    };
    this.el("pause").onclick = () => this.togglePause();
    this.el("restart").onclick = () => {
      if (this.session) {
        this.session.restart();
        void this.enter();
      }
    };
    this.el("boxes").onclick = () => {
      this.renderer.debug = !this.renderer.debug;
      this.el("boxes").textContent =
        `Caixas: ${this.renderer.debug ? "ligadas" : "desligadas"}`;
    };
    this.el("sound").onclick = () => {
      this.sound.setEnabled(!this.sound.enabled);
      this.soundLabel();
      this.sound.play("menu");
    };
    this.el<HTMLInputElement>("volume").oninput = () =>
      this.sound.setVolume(
        Number(this.el<HTMLInputElement>("volume").value) / 100,
      );
    if (!this.sound.available) {
      this.el<HTMLButtonElement>("sound").disabled = true;
      this.el<HTMLInputElement>("volume").disabled = true;
    }
    this.soundLabel();
    this.canvas.onpointerdown = () =>
      this.canvas.focus({ preventScroll: true });
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && !event.repeat) this.togglePause();
    });
    window.addEventListener("blur", () => this.autoPause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.autoPause();
    });
    this.bindTraining();
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
    this.setScreen(screen);
    this.overlay.hidden = false;
    this.overlay.innerHTML = html;
  }
  private soundLabel() {
    this.el("sound").textContent = !this.sound.available
      ? "Som indisponível"
      : `Som: ${this.sound.enabled ? "ligado" : "desligado"}`;
  }
  private menu() {
    this.keyboardOptions.dashOnDirection = false;
    this.root.querySelector("footer")!.innerHTML = this.samuraiControls;
    this.operation++;
    this.online?.dispose();
    this.online = undefined;
    this.session = undefined;
    this.demo = new Match();
    this.demo.message = "";
    this.renderer.resetAnimations();
    this.renderer.opponentPalette = "cyan";
    this.renderer.localSeat = 0;
    this.renderer.online = false;
    this.renderer.opponentLabel = "02 / BOT";
    this.renderer.contextLabel = "MELHOR DE 3";
    this.show(menuScreen(), "menu");
    const dioPreview = document.createElement("a");
    dioPreview.id = "dio-preview-link";
    dioPreview.className = "art-link";
    dioPreview.href = `${assetBase}art/dio.html`;
    dioPreview.textContent = "Dio + The World · teste de movimentação";
    this.overlay.querySelector(".note")!.before(dioPreview);
    const luffyPreview = document.createElement("a");
    luffyPreview.className = "art-link";
    luffyPreview.href = `${assetBase}art/luffy.html`;
    luffyPreview.textContent =
      "Luffy · normais e especiais";
    this.overlay.querySelector(".note")!.before(luffyPreview);
    const specialsPreview = document.createElement("a");
    specialsPreview.className = "art-link";
    specialsPreview.href = `${assetBase}art/dio-specials.html`;
    specialsPreview.textContent = "Dio · especiais, projéteis e tempo parado";
    this.overlay.querySelector(".note")!.before(specialsPreview);
    const roadPreview = document.createElement("a");
    roadPreview.className = "art-link";
    roadPreview.href = `${assetBase}art/road-roller.html`;
    roadPreview.textContent = "Road Roller · Super cinematográfica";
    this.overlay.querySelector(".note")!.before(roadPreview);
    const secondaryPreview = document.createElement("a");
    secondaryPreview.className = "art-link";
    secondaryPreview.href = `${assetBase}art/dio-secondary.html`;
    secondaryPreview.textContent = "Dio · reações, entrada e vitória";
    this.overlay.querySelector(".note")!.before(secondaryPreview);
    const gokuPreview = document.createElement("a");
    gokuPreview.className = "art-link";
    gokuPreview.href = `${assetBase}art/goku-combat.html`;
    gokuPreview.textContent = "Goku · normais, defesa e agarrão";
    this.overlay.querySelector(".note")!.before(gokuPreview);
    const gokuSpecials = document.createElement("a");
    gokuSpecials.className = "art-link";
    gokuSpecials.href = `${assetBase}art/goku-specials.html`;
    gokuSpecials.textContent = "Goku · Ki, Kamehameha e Teletransporte";
    this.overlay.querySelector(".note")!.before(gokuSpecials);
    const furyPreview = document.createElement("a");
    furyPreview.className = "art-link";
    furyPreview.href = `${assetBase}art/goku-fury.html`;
    furyPreview.textContent = "Goku · Fúria Saiyajin — Super cinematográfica";
    this.overlay.querySelector(".note")!.before(furyPreview);
    this.el("training-panel").hidden = true;
    this.el("network-info").hidden = true;
    this.el("menu").textContent = "Menu";
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    this.el("status").textContent = "Selecione um modo para começar";
    this.el("mode-label").textContent = "ESCOLHA SEU CONFRONTO";
    this.root.dataset.mode = "menu";
    for (const [id, mode] of [
      ["versus", "versus"],
      ["arcade", "arcade"],
      ["training", "training"],
    ] as const)
      this.el(id).onclick = () => {
        void this.sound.unlock();
        this.sound.play("menu");
        this.selection(mode);
      };
    this.el("online").onclick = () => {
      void this.sound.unlock();
      void this.enterOnline();
    };
  }
  private selection(mode: Mode) {
    this.selectedMode = mode;
    this.show(selectionScreen(mode), "selection");
    this.root.dataset.mode = mode;
    const syncSelection = () => {
      const id = this.root.querySelector<HTMLInputElement>(
        'input[name="character"]:checked',
      )!.value;
      this.el("samurai-commands").hidden = id !== "samurai";
      this.el("dio-commands").hidden = id !== "dio";
      this.el("goku-commands").hidden = id !== "goku";
      this.root
        .querySelectorAll<HTMLInputElement>('input[name="character"]')
        .forEach((input) =>
          input
            .closest(".fighter")
            ?.classList.toggle("selected", input.checked),
        );
    };
    this.root
      .querySelectorAll<HTMLInputElement>('input[name="character"]')
      .forEach((input) => (input.onchange = syncSelection));
    const opponentPicker = this.root.querySelector<HTMLSelectElement>(
      "#opponent-character",
    );
    if (opponentPicker)
      opponentPicker.onchange = () => {
        const luffy = opponentPicker.value === "luffy",
          dio = opponentPicker.value === "dio",
          goku = opponentPicker.value === "goku",
          card = this.el("opponent-card");
        card.querySelector("strong")!.textContent = luffy
          ? "LUFFY · ELASTICIDADE"
          : dio
            ? "DIO BRANDO"
            : goku
              ? "GOKU"
              : "SAMURAI";
        const image = card.querySelector("img")!;
        image.src =
          assetBase +
          (luffy
            ? "sprites/luffy/base-polished.png"
            : dio
              ? "sprites/dio/base.png"
              : goku
                ? "sprites/goku/base.png"
                : "sprites/samurai/base-p2.png");
        image.alt = luffy
          ? "Luffy, lutador elástico"
          : dio
            ? "Dio Brando, paleta alternativa"
            : goku
              ? "Goku, paleta alternativa"
              : "Samurai, paleta ciano";
        image.style.filter = dio || goku ? "hue-rotate(145deg)" : "";
      };
    this.el("back").onclick = () => this.menu();
    this.el("fight").onclick = () => {
      void this.sound.unlock();
      this.sound.play("menu");
      const difficulty =
        mode === "arcade"
          ? "easy"
          : (this.el<HTMLSelectElement>("difficulty").value as Difficulty);
      const id = this.root.querySelector<HTMLInputElement>(
        'input[name="character"]:checked',
      )!.value as CharacterId;
      const enemy = (this.root.querySelector<HTMLSelectElement>(
        "#opponent-character",
      )?.value ?? "samurai") as CharacterId;
      this.session = new GameSession(mode, difficulty, id, enemy);
      void this.enter();
    };
  }
  private async enter() {
    const session = this.session;
    if (!session) return;
    const token = ++this.operation;
    this.show(
      `<div class="panel loading"><span class="eyebrow">${modeName[session.mode].toUpperCase()}</span><h2>Preparando a arena<span class="loading-dots">…</span></h2><p>${session.match.fighters[0].data.name} contra ${session.opponentName}.</p><button class="text" id="cancel-load">Retornar ao menu</button></div>`,
      "loading",
    );
    this.el("cancel-load").onclick = () => this.menu();
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
          ? `ARCADE ${session.stage + 1} / 3`
          : "MELHOR DE 3";
      this.setScreen("fight");
      this.overlay.hidden = true;
      this.el("training-panel").hidden = session.mode !== "training";
      this.el<HTMLButtonElement>("pause").disabled = false;
      this.el<HTMLButtonElement>("restart").disabled = false;
      this.el("pause").textContent = "Pausar · Esc";
      this.root.dataset.mode = session.mode;
      this.root.dataset.stage = String(session.stage + 1);
      this.root.dataset.difficulty = session.currentDifficulty;
      this.root.dataset.character = session.characterId;
      this.canvas.setAttribute(
        "aria-label",
        `Arena: ${session.match.fighters[0].data.name} contra ${session.match.fighters[1].data.name}`,
      );
      this.root.querySelector<HTMLAnchorElement>(".toolbar .art-link")!.href =
        `${assetBase}art/${session.characterId === "luffy" ? "luffy" : session.characterId === "goku" ? "goku-combat" : session.characterId === "dio" ? "dio-combat" : "samurai"}.html`;
      this.keyboardOptions.dashOnDirection = session.characterId !== "samurai";
      this.root.querySelector("footer")!.innerHTML =
        session.characterId === "luffy"
          ? "<div>A/D mover · W pular · S agachar · Shift + direção dash</div><div>LUFFY · J/K/L ataques em pé, agachados ou aéreos</div><div>Pistol ↓ → · Gatling ↓ ← · Bazooka ↓ ↓ + J/K/L no chão · R reservado.</div>"
          : session.characterId === "goku"
            ? "<div><kbd>A</kbd><kbd>D</kbd> mover · <kbd>W</kbd> pular · <kbd>S</kbd> agachar · Shift + direção dash</div><div><kbd>J</kbd> leve · <kbd>K</kbd> médio · <kbd>L</kbd> forte · <kbd>U</kbd> agarrar</div><div>J → K → L · S+L → W → J → K → L · Segure para trás para defender. Ki ↓ → · Kamehameha ↓ ← · Teletransporte ↓ ↓ + J/K/L. Sem custo de Super. Fúria Saiyajin: R, custa a barra completa.</div>"
            : session.characterId === "dio"
              ? "<div><kbd>A</kbd><kbd>D</kbd> mover <kbd>W</kbd> pular <kbd>S</kbd> agachar · Shift + direção dash</div><div><kbd>J</kbd> leve <kbd>K</kbd> médio <kbd>L</kbd> forte · The World sincronizado</div><div>Facas ↓ → + J/K/L · Muda ↓ ← + J/K/L · Tempo → ↓ + L · <kbd>R</kbd> Road Roller (2 barras) · <kbd>T</kbd> provocar</div>"
              : this.samuraiControls;
      this.el("mode-label").textContent =
        session.mode === "arcade"
          ? `ARCADE / CONFRONTO ${session.stage + 1} DE 3`
          : modeName[session.mode].toUpperCase();
      this.el("status").textContent =
        `${modeName[session.mode].toUpperCase()} / ${session.opponentName.toUpperCase()} / ${difficultyName[session.currentDifficulty].toUpperCase()}`;
      this.syncTraining();
      this.renderer.tick(session.match);
      this.canvas.focus({ preventScroll: true });
      if (document.hidden) this.autoPause();
    } catch (error) {
      if (token !== this.operation) return;
      this.show(
        `<div class="panel"><h2>A arena não carregou.</h2><p>Um arquivo de imagem não ficou disponível. Recarregue a tentativa.</p><button class="primary" id="retry-load">Tentar novamente</button><button class="text" id="return">Retornar ao menu</button></div>`,
        "loading",
      );
      this.el("retry-load").onclick = () => {
        void this.enter();
      };
      this.el("return").onclick = () => this.menu();
      console.error(error);
    }
  }
  private togglePause() {
    if (!this.session || !["fight", "pause"].includes(this.screen)) return;
    if (this.screen === "pause") {
      this.setScreen("fight");
      this.overlay.hidden = true;
      this.el("pause").textContent = "Pausar · Esc";
      this.canvas.focus({ preventScroll: true });
      void this.sound.unlock();
    } else {
      this.show(
        `<div class="panel"><span class="eyebrow">COMBATE PAUSADO</span><h2>Respire. Reaja.</h2><p>Reiniciar restaura o confronto atual.</p><button class="primary" id="resume">CONTINUAR</button><button class="text" id="pause-restart">Reiniciar combate</button><button class="text" id="pause-menu">Retornar ao menu</button></div>`,
        "pause",
      );
      this.el("resume").onclick = () => this.togglePause();
      this.el("pause-restart").onclick = () => {
        this.session!.restart();
        void this.enter();
      };
      this.el("pause-menu").onclick = () => this.menu();
      this.el("pause").textContent = "Continuar · Esc";
    }
  }
  private autoPause() {
    if (this.screen === "fight") this.togglePause();
  }
  private finish() {
    const session = this.session!;
    this.show(resultScreen(session), "result");
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el("return").onclick = () => this.menu();
    if (session.status === "stageClear")
      this.el("next-opponent").onclick = () => {
        void this.sound.unlock();
        if (session.next()) void this.enter();
      };
    else
      this.el("again").onclick = () => {
        void this.sound.unlock();
        if (session.mode === "arcade" && session.status === "victory")
          this.session = new GameSession("arcade", "easy", session.characterId);
        else session.restart();
        void this.enter();
      };
  }
  private tick() {
    if (this.online?.match) {
      const canSend = this.online.canSend;
      this.online.advance(canSend ? this.keyboard.sample() : neutral());
      if (!canSend) this.keyboard.clear();
    } else if (this.screen === "fight" && this.session) {
      const match = this.session.match,
        frozen = match.hitstop > 0;
      this.session.step(this.keyboard.sample());
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
    this.renderer.draw(this.online?.match ?? this.session?.match ?? this.demo);
    if (this.online) {
      const client = this.online;
      this.root.dataset.connection = client.connected
        ? client.syncing
          ? "syncing"
          : "connected"
        : "disconnected";
      this.root.dataset.netTick = String(client.tick);
      this.root.dataset.netHash = client.stateHash;
      this.root.dataset.netMatch = client.matchId;
      this.root.dataset.resyncs = String(client.resyncs);
      const info = this.el("network-info"),
        text = `${client.connectionText} · Sala ${client.room?.code ?? "—"}${client.match ? ` · Jogador ${client.seat + 1} · Atraso de entradas ativo` : ""}`;
      if (info.textContent !== text) info.textContent = text;
    }
    this.root.dataset.sessionStatus = this.session?.status ?? "none";
    this.root.dataset.audio = this.sound.state;
    this.root.dataset.lastSound = this.sound.lastCue;
  }
  private async enterOnline() {
    const token = ++this.operation;
    this.session = undefined;
    this.root.dataset.mode = "online";
    this.el("training-panel").hidden = true;
    this.show(onlineEntry(), "online");
    this.el("back").onclick = () => this.menu();
    this.el("reconnect-online").onclick = () => {
      void this.enterOnline();
    };
    this.el<HTMLButtonElement>("pause").disabled = true;
    this.el<HTMLButtonElement>("restart").disabled = true;
    this.el("pause").textContent = "Online · sem pausa";
    this.el("menu").textContent = "Sair da sala";
    this.el("mode-label").textContent = "CONTRA AMIGO / ONLINE";
    this.el("status").textContent = "CONTRA AMIGO / CONECTANDO AO SERVIDOR";
    try {
      await this.renderer.preparePalette("cyan");
      if (token !== this.operation) return;
      this.online?.dispose();
      const client = new OnlineClient();
      this.online = client;
      this.renderer.opponentPalette = "cyan";
      this.renderer.online = true;
      this.renderer.contextLabel = "ONLINE · MELHOR DE 3";
      client.onChange = () => {
        if (this.online === client) this.onlineChanged();
      };
      client.onReset = () => {
        if (this.online !== client) return;
        this.keyboard.clear();
        this.renderer.localSeat = client.seat;
        this.renderer.resetAnimations();
        if (client.match) this.renderer.tick(client.match);
        const isLuffy =
          client.match?.fighters[client.seat]?.data.id === "luffy";
        this.root.querySelector("footer")!.innerHTML = isLuffy
          ? "<div>LUFFY · NORMAIS ELÁSTICOS</div><div>J/K/L em pé, agachado ou no ar · W pular · Shift + direção dash</div><div>Pistol ↓ → · Gatling ↓ ← · Bazooka ↓ ↓ + J/K/L no chão · R reservado.</div>"
          : this.samuraiControls;
        this.canvas.focus({ preventScroll: true });
      };
      client.onStep = (match, frozen) => {
        if (!frozen) this.renderer.tick(match);
        this.sound.tick(match);
      };
      this.el("network-info").hidden = false;
      this.onlineChanged();
    } catch {
      if (token === this.operation) {
        this.show(
          `<div class="panel"><h2>A arena não carregou.</h2><button class="primary" id="back">Retornar ao menu</button></div>`,
          "online",
        );
        this.el("back").onclick = () => this.menu();
      }
    }
  }
  private onlineChanged() {
    const client = this.online;
    if (!client) return;
    if (client.result) {
      this.el("status").textContent =
        "CONTRA AMIGO / RESULTADO CONFIRMADO PELO SERVIDOR";
      this.show(onlineResult(client), "onlineResult");
      this.el("leave-room").onclick = () => this.menu();
      const button =
        this.root.querySelector<HTMLButtonElement>("#online-rematch");
      if (button)
        button.onclick = () => {
          void this.onlineAction(() => client.rematch());
        };
      this.el("online-lobby").onclick = () =>
        void this.onlineAction(() => client.returnToLobby());
      return;
    }
    if (client.match && !client.fatal) {
      if (this.screen !== "onlineFight") this.setScreen("onlineFight");
      const blocked =
        !client.connected ||
        client.syncing ||
        client.reconnecting ||
        client.room?.status === "reconnecting";
      this.overlay.hidden = !blocked;
      if (blocked) {
        this.overlay.innerHTML = `<div class="panel"><span class="eyebrow">LUTA EM ESPERA</span><h2>${client.syncing ? "Sincronizando…" : "Recuperando conexão…"}</h2><p>${escapeText(client.message || "Aguardando os dois jogadores voltarem. Os comandos pendentes serão limpos.")}</p><button class="text" id="leave-room">Sair da sala</button></div>`;
        this.el("leave-room").onclick = () => this.menu();
        this.keyboard.clear();
      }
      this.el("status").textContent =
        client.message || "CONTRA AMIGO / COMBATE ONLINE / SEM PAUSA LOCAL";
      return;
    }
    if (client.room && !client.fatal) {
      this.el("status").textContent =
        `CONTRA AMIGO / SALA ${client.room.code} / JOGADOR ${client.seat + 1}`;
      this.show(lobby(client), "onlineLobby");
      this.el("leave-room").onclick = () => this.menu();
      this.el("copy-code").onclick = () => {
        void this.copyRoomCode(client);
      };
      for (const character of ONLINE_CHARACTERS)
        this.el(`online-${character}`).onchange = () =>
          void this.onlineAction(() => client.select(character));
      this.el("online-confirm").onclick = () =>
        void this.onlineAction(() => client.confirm());
      const start = this.root.querySelector<HTMLButtonElement>("#online-start");
      if (start)
        start.onclick = () => void this.onlineAction(() => client.startMatch());
      this.el("online-error").textContent = client.message;
      this.el("online-ready").onclick = () => {
        void this.onlineAction(() =>
          client.ready(!client.room!.players[client.seat]?.ready),
        );
      };
      return;
    }
    this.show(onlineEntry(client), "online");
    this.el("status").textContent =
      `CONTRA AMIGO / ${client.connectionText.toUpperCase()}`;
    this.el("back").onclick = () => this.menu();
    this.el("reconnect-online").onclick = () => client.retry();
    this.el("create-room").onclick = () => {
      void this.onlineAction(() => client.create());
    };
    this.el<HTMLFormElement>("join-form").onsubmit = (event) => {
      event.preventDefault();
      const code = this.el<HTMLInputElement>("room-code").value;
      void this.onlineAction(() => client.join(code));
    };
  }
  private async onlineAction(action: () => Promise<void>) {
    const client = this.online;
    if (!client) return;
    try {
      client.message = "";
      await action();
    } catch (error) {
      if (this.online !== client) return;
      client.message = (error as Error).message;
      this.onlineChanged();
    }
  }
  private async copyRoomCode(client: OnlineClient) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(client.room!.code);
      const button = this.root.querySelector("#copy-code");
      if (button) button.textContent = "Copiado";
    } catch {
      const code = this.root.querySelector("#lobby-code"),
        button = this.root.querySelector("#copy-code");
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      if (button) button.textContent = "Selecionado · use Ctrl+C";
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
        const session = this.session;
        if (!session || session.mode !== "training") return;
        const previousDummy = session.training.dummy;
        session.training.infiniteHealth =
          this.el<HTMLInputElement>("infinite-health").checked;
        session.training.unlimitedMeter =
          this.el<HTMLInputElement>("unlimited-meter").checked;
        session.training.dummy = this.el<HTMLSelectElement>("dummy")
          .value as DummyBehavior;
        const difficulty = this.el<HTMLSelectElement>("training-difficulty")
          .value as Difficulty;
        if (
          session.difficulty !== difficulty ||
          previousDummy !== session.training.dummy
        ) {
          session.difficulty = difficulty;
          session.bot = new Bot(difficulty);
        }
        this.el("training-difficulty-label").hidden =
          session.training.dummy !== "bot";
        this.trainingStatus(session);
        this.keyboard.clear();
        this.canvas.focus({ preventScroll: true });
      };
    this.el("clear-damage").onclick = () => {
      this.session?.training.damage.reset();
      this.trainingReadout();
      this.canvas.focus({ preventScroll: true });
    };
  }
  private syncTraining() {
    const session = this.session!;
    if (session.mode !== "training") return;
    this.el<HTMLInputElement>("infinite-health").checked =
      session.training.infiniteHealth;
    this.el<HTMLInputElement>("unlimited-meter").checked =
      session.training.unlimitedMeter;
    this.el<HTMLSelectElement>("dummy").value = session.training.dummy;
    this.el<HTMLSelectElement>("training-difficulty").value =
      session.difficulty;
    this.el("training-difficulty-label").hidden =
      session.training.dummy !== "bot";
    this.trainingStatus(session);
    this.trainingReadout();
  }
  private trainingStatus(session: GameSession) {
    const label =
      this.el<HTMLSelectElement>("dummy").selectedOptions[0].textContent;
    this.root.dataset.difficulty = session.currentDifficulty;
    this.el("status").textContent =
      `TREINAMENTO / ${label?.toUpperCase()}${session.training.dummy === "bot" ? ` / ${difficultyName[session.currentDifficulty].toUpperCase()}` : ""}`;
  }
  private trainingReadout() {
    const session = this.session;
    if (!session) return;
    const stats = session.training.damage.fighters[0];
    for (const [id, value] of [
      ["last-damage", stats.lastHit],
      ["combo-damage", stats.comboDamage],
      ["best-damage", stats.bestDamage],
      ["best-hits", stats.bestHits],
      ["total-damage", stats.totalDamage],
    ] as const) {
      const node = this.el(id);
      if (node.textContent !== String(value)) node.textContent = String(value);
    }
    session.match.fighters.forEach((f, i) => {
      this.el(i === 0 ? "player-state" : "dummy-state").textContent =
        `${f.state} · ${f.moveId || "—"} · ${f.attackPhase || "—"} · tick ${f.stateFrame}${f.data.id === "goku" ? ` · TP aéreo: ${f.gokuAirTeleportsUsed}/${combatPace.airTeleport.maximumPerJumpOrCombo} usado` : ""}`;
    });
    this.el("ai-decision").textContent =
      session.training.dummy === "bot" ? session.bot.lastDecision : "desligada";
  }
}
