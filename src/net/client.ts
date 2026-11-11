import { io, type Socket } from "socket.io-client";
import { Match } from "../engine/combat";
import { snapshot, restore, hashState } from "../engine/state";
import type { InputFrame } from "../engine/types";
import { ENGINE_VERSION } from "./version";
import { socketPath } from "../asset-base";
import {
  PROTOCOL,
  CLIENT_LEAD_LIMIT,
  type Seat,
  type RoomView,
  type Membership,
  type StartPacket,
  type StepPacket,
  type EndPacket,
  type Reply,
  type OnlineCharacter,
} from "./protocol";

export class OnlineClient {
  readonly socket: Socket;
  room?: RoomView;
  seat: Seat = 0;
  match?: Match;
  result?: EndPacket;
  connected = false;
  syncing = false;
  lagging = false;
  ping = 0;
  resyncs = 0;
  message = "";
  fatal = false;
  reconnecting = false;
  tick = 0;
  serverTick = 0;
  stateHash = "";
  matchId = "";
  private nextInput = 0;
  private queue = new Map<number, StepPacket>();
  private member?: Membership;
  private pendingEnd?: EndPacket;
  private interval: ReturnType<typeof setInterval>;
  private disposed = false;
  private recoverAttempts = 0;
  private deadline?: ReturnType<typeof setTimeout>;
  private localInputs: InputFrame[] = [];
  onChange = () => {};
  onReset = () => {};
  onStep = (_match: Match, _frozen: boolean) => {};
  private storageKey: string;
  constructor(url = location.origin) {
    this.storageKey = `jogo-luta-online:${url}:${socketPath}`;
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      if (saved) this.member = JSON.parse(saved);
    } catch {}
    this.socket = io(url, {
      path: socketPath,
      autoConnect: false,
      reconnectionAttempts: 6,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 3500,
    });
    this.socket.on("connect", () => {
      this.cancelDeadline();
      this.recoverAttempts = 0;
      this.connected = true;
      this.message = "";
      this.fatal = false;
      if (this.member) {
        this.reconnecting = true;
        void this.recover();
      } else this.reconnecting = false;
      this.onChange();
    });
    this.socket.on(
      "net:hello",
      (hello: { protocol: number; version: string }) => {
        if (hello.protocol !== PROTOCOL || hello.version !== ENGINE_VERSION) {
          this.fatal = true;
          this.message =
            "Versões diferentes. Atualize a página antes de jogar.";
          this.socket.disconnect();
          this.onChange();
        }
      },
    );
    this.socket.io.on("reconnect_failed", this.connectionUnavailable);
    this.socket.on("connect_error", () => {
      this.armDeadline();
      this.connected = false;
      this.message = "Não foi possível conectar ao servidor. Tente novamente.";
      this.onChange();
    });
    this.socket.on("disconnect", (reason: string) => {
      this.connected = false;
      this.queue.clear();
      this.localInputs.length = 0;
      this.reconnecting = !!this.member && !this.disposed && this.socket.active && !this.fatal;
      if (this.socket.active) this.armDeadline();
      if (!this.fatal)
        this.message =
          reason === "io server disconnect"
            ? "O servidor encerrou esta conexão."
            : this.reconnecting
              ? "Conexão perdida. Tentando recuperar sua vaga…"
              : "Conexão perdida. Confira o Apache e o backend do anfitrião.";
      if (reason === "io server disconnect" && !this.fatal) return this.connectionUnavailable();
      this.onChange();
    });
    this.socket.on("room:state", (room: RoomView) => {
      if (this.member && room.code === this.member.room.code) {
        this.room = room;
        if (room.status === "lobby" && this.match) {
          this.match = undefined;
          this.result = undefined;
          this.pendingEnd = undefined;
          this.matchId = "";
          this.queue.clear();
          this.tick = this.serverTick = 0;
        }
        this.onChange();
      }
    });
    this.socket.on("match:start", (packet: StartPacket) => this.start(packet));
    this.socket.on("match:step", (packet: StepPacket) => {
      if (
        packet.matchId !== this.matchId ||
        packet.tick <= this.tick ||
        this.syncing
      )
        return;
      if (packet.tick > this.tick + 240 || this.queue.size > 240) {
        this.requestSync();
        return;
      }
      this.serverTick = Math.max(this.serverTick, packet.tick);
      this.queue.set(packet.tick, packet);
    });
    this.socket.on("match:end", (packet: EndPacket) => {
      if (packet.matchId !== this.matchId) return;
      this.pendingEnd = packet;
      if (
        ["disconnect", "left", "inputTimeout", "desync"].includes(
          packet.reason,
        ) ||
        this.tick >= packet.tick
      )
        this.finish(packet);
    });
    this.socket.on("net:lag", (lagging: boolean) => {
      this.lagging = lagging;
      this.onChange();
    });
    this.socket.on("room:expired", () => {
      this.forget();
      this.reconnecting = this.syncing = this.lagging = false;
      this.message = "A sala expirou. Crie ou entre em uma nova sala.";
      this.onChange();
    });
    this.socket.on(
      "input:rejected",
      (error: { code: string; message: string }) => {
        if (["staleMatch", "staleTick"].includes(error.code)) return;
        this.message = error.message;
        if (error.code === "inputGap" || error.code === "tooFar")
          this.requestSync();
        else this.onChange();
      },
    );
    this.interval = setInterval(() => {
      if (!this.connected) return;
      const before = performance.now();
      this.socket.timeout(3000).emit("net:ping", (error: unknown) => {
        if (!error) this.ping = Math.round(performance.now() - before);
      });
    }, 2000);
    this.armDeadline();
    this.socket.connect();
  }
  private cancelDeadline() {
    clearTimeout(this.deadline);
    this.deadline = undefined;
  }
  private armDeadline() {
    this.deadline ??= setTimeout(this.connectionUnavailable, this.room?.graceMs ?? 15000);
  }
  private connectionUnavailable = () => {
    this.cancelDeadline();
    this.connected = false;
    this.reconnecting = false;
    this.syncing = false;
    this.fatal = true;
    this.message = "Servidor indisponível. Confira o Apache e o backend no computador anfitrião, depois tente novamente.";
    this.socket.disconnect();
    this.onChange();
  };
  get canControl() {
    return (
      !!this.match &&
      !this.fatal &&
      this.connected &&
      !this.syncing &&
      !this.reconnecting &&
      !this.result &&
      this.room?.status === "playing"
    );
  }
  get canSend() {
    return this.canControl && this.nextInput <= this.serverTick + CLIENT_LEAD_LIMIT;
  }
  get connectionText() {
    return this.fatal
      ? "Conexão indisponível"
      : !this.connected
        ? this.reconnecting
          ? "Reconectando…"
          : "Conectando…"
        : this.syncing
          ? "Sincronizando…"
          : this.lagging
            ? "Conexão lenta · aguardando comandos"
            : this.reconnecting
              ? "Recuperando sala…"
              : `Conectado${this.ping ? ` · ${this.ping} ms` : ""}`;
  }
  private request<T>(event: string, payload: unknown): Promise<T> {
    if (!this.connected)
      return Promise.reject(new Error("Aguarde a conexão com o servidor."));
    return new Promise((resolve, reject) =>
      this.socket
        .timeout(5000)
        .emit(event, payload, (error: unknown, reply: Reply<T>) => {
          if (error || !reply) {
            reject(
              new Error(
                "O servidor não respondeu. Reconecte e tente novamente.",
              ),
            );
            return;
          }
          if (reply.ok) resolve(reply.data);
          else
            reject(
              Object.assign(new Error(reply.message), { code: reply.code }),
            );
        }),
    );
  }
  private remember(member: Membership) {
    this.member = member;
    this.room = member.room;
    this.seat = member.seat;
    this.reconnecting = false;
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(member));
    } catch {}
    this.onChange();
  }
  private forget() {
    this.member = undefined;
    this.room = undefined;
    this.match = undefined;
    this.result = undefined;
    this.pendingEnd = undefined;
    this.matchId = "";
    this.queue.clear();
    this.localInputs.length = 0;
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {}
  }
  async create() {
    this.remember(
      await this.request<Membership>("room:create", {
        version: ENGINE_VERSION,
      }),
    );
  }
  async join(code: string) {
    this.remember(
      await this.request<Membership>("room:join", {
        code,
        version: ENGINE_VERSION,
      }),
    );
  }
  async select(character: OnlineCharacter = "samurai") {
    await this.request("room:select", { character });
  }
  async confirm() {
    await this.request("room:confirm", {});
  }
  async startMatch() {
    await this.request("room:start", {});
  }
  async returnToLobby() {
    await this.request("room:lobby", {});
  }
  async ready(ready: boolean) {
    await this.request("room:ready", { ready });
  }
  async rematch() {
    await this.request("room:rematch", {});
  }
  private async recover() {
    const member = this.member!;
    try {
      this.remember(
        await this.request<Membership>("room:resume", {
          code: member.room.code,
          token: member.token,
          version: ENGINE_VERSION,
        }),
      );
    } catch (error) {
      if (this.disposed) return;
      if (
        (error as { code?: string }).code === "alreadyConnected" &&
        ++this.recoverAttempts < 12
      ) {
        setTimeout(() => {
          if (this.connected && this.member === member && !this.disposed)
            void this.recover();
        }, 500);
        return;
      }
      this.forget();
      this.fatal = (error as { code?: string }).code === "versionMismatch";
      this.reconnecting = this.syncing = this.lagging = false;
      this.message = (error as Error).message;
      this.onChange();
    }
  }
  retry() {
    this.fatal = false;
    this.message = "";
    this.socket.disconnect();
    this.armDeadline();
    this.socket.connect();
  }
  private start(packet: StartPacket) {
    if (packet.version !== ENGINE_VERSION) {
      this.fatal = true;
      this.message = "A versão do combate mudou. Atualize a página.";
      this.onChange();
      return;
    }
    try {
      if (hashState(packet.state) !== packet.hash)
        throw new Error("checkpoint");
      this.match = restore(packet.state);
      this.matchId = packet.matchId;
      this.tick = this.serverTick = packet.tick;
      this.nextInput = packet.tick + packet.delay + 1;
      this.queue.clear();
      this.localInputs.length = 0;
      this.pendingEnd = undefined;
      this.result = undefined;
      this.syncing = false;
      this.lagging = false;
      this.reconnecting = false;
      this.stateHash = packet.hash;
      if (packet.reason === "resync" || packet.reason === "resume")
        this.resyncs++;
      this.message =
        packet.reason === "resume"
          ? "Conexão restaurada. Retome os controles."
          : packet.reason === "resync"
            ? "Sincronização restaurada."
            : "";
      this.onReset();
      this.onChange();
    } catch {
      this.fatal = true;
      this.message =
        "O estado recebido não pôde ser validado. Reconecte à sala.";
      this.onChange();
    }
  }
  advance(input: InputFrame, controls = true) {
    if (controls && this.canControl) {
      this.localInputs.push(input);
      // Preserve the directional sequence and its button edge during brief
      // backpressure. Bound the backlog so a longer stall sheds old commands.
      if (this.localInputs.length > 12) this.localInputs.shift();
    } else this.localInputs.length = 0;
    if (this.canSend) {
      do {
        this.socket.emit("match:input", {
          matchId: this.matchId,
          tick: this.nextInput++,
          input: this.localInputs.shift() ?? input,
        });
      } while (this.localInputs.length && this.canSend);
    }
    if (!this.connected || this.fatal || this.syncing || !this.match) return;
    for (let budget = 0; budget < 4; budget++) {
      const packet = this.queue.get(this.tick + 1);
      if (!packet) break;
      this.queue.delete(packet.tick);
      const frozen = this.match.phase === "fight" && this.match.hitstop > 0;
      this.match.step(packet.inputs);
      this.tick = packet.tick;
      const hash = hashState(snapshot(this.match));
      if (hash !== packet.hash) {
        if (packet.checkpoint && hashState(packet.checkpoint) === packet.hash) {
          this.match = restore(packet.checkpoint);
          this.resyncs++;
          this.onReset();
        } else {
          this.requestSync();
          break;
        }
      }
      this.stateHash = packet.hash;
      this.onStep(this.match, frozen);
      if (this.pendingEnd && this.tick >= this.pendingEnd.tick) {
        this.finish(this.pendingEnd);
        break;
      }
    }
  }
  private requestSync() {
    if (this.syncing || !this.matchId || !this.connected) return;
    this.syncing = true;
    this.queue.clear();
    this.onChange();
    void this.request("match:sync", { matchId: this.matchId }).catch(() => {
      this.syncing = false;
      this.message = "Não foi possível sincronizar. Reconecte à sala.";
      this.onChange();
    });
  }
  private finish(packet: EndPacket) {
    this.result = packet;
    this.pendingEnd = undefined;
    this.onChange();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.interval);
    this.cancelDeadline();
    this.socket.io.off("reconnect_failed", this.connectionUnavailable);
    this.forget();
    if (this.connected) this.socket.emit("room:leave", {});
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
