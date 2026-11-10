import {
  randomInt,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Match } from "../src/engine/combat";
import { characterById } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { snapshot, hashState } from "../src/engine/state";
import { ENGINE_VERSION } from "../src/net/version";
import {
  CODE_ALPHABET,
  ONLINE_CHARACTERS,
  type OnlineCharacter,
  INPUT_DELAY,
  MAX_AHEAD,
  normalizeCode,
  validInput,
  exactObject,
  type Seat,
  type RoomView,
  type Membership,
  type RoomPlayer,
  type RoomStatus,
  type StartPacket,
  type StepPacket,
  type EndPacket,
} from "../src/net/protocol";

export class RoomError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(code: string, message: string): never {
  throw new RoomError(code, message);
}
interface Player extends RoomPlayer {
  socketId: string;
  token: string;
  disconnectedAt?: number;
  accepted: number;
}
export interface Room {
  code: string;
  host: Seat;
  status: RoomStatus;
  players: [Player | null, Player | null];
  updated: number;
  match?: Match;
  matchId: string;
  tick: number;
  inputs: [Map<number, InputFrame>, Map<number, InputFrame>];
  nextAt: number;
  waitingSince?: number;
  lastLag: boolean;
  result?: EndPacket;
  syncs: number[];
}
export interface RoomOptions {
  delay?: number;
  graceMs?: number;
  lobbyTtlMs?: number;
  maxRooms?: number;
  inputTimeoutMs?: number;
}
type Emit = (socketIds: string[], event: string, payload: unknown) => void;
/** Only this module owns combat state. Public messages can select a character,
 * vote ready/rematch, or submit one player's bounded, sequential input stream. */
export class Rooms {
  readonly rooms = new Map<string, Room>();
  private retired = new Map<string, number>();
  private memberships = new Map<string, { room: Room; seat: Seat }>();
  readonly delay: number;
  readonly graceMs: number;
  readonly ttl: number;
  readonly maxRooms: number;
  readonly inputTimeout: number;
  constructor(
    private emit: Emit,
    private now = () => performance.now(),
    options: RoomOptions = {},
  ) {
    const delay = options.delay ?? INPUT_DELAY;
    if (!Number.isInteger(delay) || delay < 3 || delay > 18)
      throw new RangeError(
        "INPUT_DELAY_TICKS deve ser um inteiro entre 3 e 18",
      );
    this.delay = delay;
    this.graceMs = options.graceMs ?? 15000;
    this.ttl = options.lobbyTtlMs ?? 300000;
    this.maxRooms = options.maxRooms ?? 100;
    this.inputTimeout = options.inputTimeoutMs ?? 5000;
  }
  private peers(room: Room) {
    return room.players
      .filter((p): p is Player => !!p && p.connected)
      .map((p) => p.socketId);
  }
  view(room: Room): RoomView {
    return {
      code: room.code,
      host: room.host,
      status: room.status,
      graceMs: this.graceMs,
      players: room.players.map((p) =>
        p
          ? {
              seat: p.seat,
              connected: p.connected,
              character: p.character,
              confirmed: p.confirmed,
              ready: p.ready,
              rematch: p.rematch,
            }
          : null,
      ),
    };
  }
  private broadcast(room: Room) {
    this.emit(this.peers(room), "room:state", this.view(room));
  }
  private player(socketId: string) {
    const membership = this.memberships.get(socketId);
    if (!membership) fail("notInRoom", "Você não está em uma sala.");
    return membership!;
  }
  private unseated(socketId: string) {
    if (this.memberships.has(socketId))
      fail("alreadyInRoom", "Saia da sala atual antes de entrar em outra.");
  }
  private attach(socketId: string, room: Room, seat: Seat): Membership {
    const player: Player = {
      seat,
      socketId,
      token: randomBytes(32).toString("hex"),
      connected: true,
      character: null,
      confirmed: false,
      ready: false,
      rematch: false,
      accepted: this.delay,
    };
    room.players[seat] = player;
    this.memberships.set(socketId, { room, seat });
    room.updated = this.now();
    this.broadcast(room);
    return { room: this.view(room), seat, token: player.token };
  }
  create(socketId: string) {
    this.unseated(socketId);
    if (this.rooms.size >= this.maxRooms)
      fail("capacity", "O servidor está cheio. Tente novamente em instantes.");
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join("");
    } while (this.rooms.has(code) || this.retired.has(code));
    const room: Room = {
      code,
      host: 0,
      status: "lobby",
      players: [null, null],
      updated: this.now(),
      matchId: "",
      tick: 0,
      inputs: [new Map(), new Map()],
      nextAt: 0,
      lastLag: false,
      syncs: [],
    };
    this.rooms.set(code, room);
    return this.attach(socketId, room, 0);
  }
  join(socketId: string, rawCode: unknown) {
    this.unseated(socketId);
    const code = normalizeCode(rawCode);
    if (!code) fail("invalidCode", "Use um código válido de seis caracteres.");
    const room = this.rooms.get(code!);
    if (!room)
      fail(
        this.retired.has(code!) ? "roomClosed" : "roomNotFound",
        this.retired.has(code!)
          ? "Esta sala foi encerrada."
          : "Sala não encontrada. Confira o código.",
      );
    if (room!.status !== "lobby")
      fail(
        "roomUnavailable",
        room!.status === "closed"
          ? "Esta sala foi encerrada."
          : "Esta sala já está em combate.",
      );
    const seat = room!.players.findIndex((p) => !p);
    if (seat < 0) fail("roomFull", "Esta sala já tem dois jogadores.");
    return this.attach(socketId, room!, seat as Seat);
  }
  resume(socketId: string, rawCode: unknown, token: unknown): Membership {
    this.unseated(socketId);
    const code = normalizeCode(rawCode),
      room = code ? this.rooms.get(code) : undefined;
    if (!room || room.status === "closed")
      fail("resumeExpired", "A sala expirou. Crie ou entre em uma nova sala.");
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      fail("invalidToken", "Não foi possível recuperar sua vaga.");
    const seat = room!.players.findIndex(
      (p) =>
        p &&
        timingSafeEqual(Buffer.from(p.token), Buffer.from(token as string)),
    );
    if (seat < 0) fail("invalidToken", "Não foi possível recuperar sua vaga.");
    const player = room!.players[seat]!;
    if (player.connected)
      fail(
        "alreadyConnected",
        "Sua vaga ainda está conectada em outra janela.",
      );
    if (
      player.disconnectedAt === undefined ||
      this.now() - player.disconnectedAt > this.graceMs
    )
      fail("resumeExpired", "O prazo para recuperar sua vaga terminou.");
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = undefined;
    this.memberships.set(socketId, { room: room!, seat: seat as Seat });
    room!.updated = this.now();
    return { room: this.view(room!), seat: seat as Seat, token: player.token };
  }
  afterResume(socketId: string) {
    const { room } = this.player(socketId);
    if (
      room.match &&
      room.status === "reconnecting" &&
      room.players.every((p) => p?.connected)
    )
      this.start(room, "resume");
    else if (room.match && room.status === "finished") {
      this.emit([socketId], "match:start", this.startPacket(room, "resume"));
      if (room.result) this.emit([socketId], "match:end", room.result);
    }
    this.broadcast(room);
  }
  select(socketId: string, character: unknown) {
    const { room, seat } = this.player(socketId);
    if (room.status !== "lobby")
      fail("notLobby", "A seleção está fechada durante a luta.");
    if (!ONLINE_CHARACTERS.includes(character as OnlineCharacter))
      fail("invalidCharacter", "Personagem indisponível.");
    room.players[seat]!.character = character as OnlineCharacter;
    room.players[seat]!.confirmed = false;
    room.players[seat]!.ready = false;
    room.updated = this.now();
    this.broadcast(room);
  }
  ready(socketId: string, ready: unknown) {
    const { room, seat } = this.player(socketId);
    if (room.status !== "lobby") fail("notLobby", "A sala já saiu do lobby.");
    if (
      typeof ready !== "boolean" ||
      !room.players[seat]!.character ||
      !room.players[seat]!.confirmed
    )
      fail(
        "selectFirst",
        "Selecione e confirme seu personagem antes de ficar pronto.",
      );
    room.players[seat]!.ready = ready;
    room.updated = this.now();
    this.broadcast(room);
  }
  confirm(socketId: string) {
    const { room, seat } = this.player(socketId),
      p = room.players[seat]!;
    if (room.status !== "lobby" || !p.character)
      fail("selectFirst", "Selecione um personagem no lobby.");
    p.confirmed = true;
    p.ready = false;
    room.updated = this.now();
    this.broadcast(room);
  }
  startMatch(socketId: string) {
    const { room, seat } = this.player(socketId);
    if (seat !== room.host)
      fail("hostOnly", "Apenas o anfitrião pode iniciar a partida.");
    if (
      room.status !== "lobby" ||
      !room.players.every(
        (p) => p?.connected && p.confirmed && p.ready && p.character,
      )
    )
      fail(
        "notReady",
        "Os dois jogadores devem confirmar seus personagens e ficar prontos.",
      );
    room.match = this.newMatch(room);
    this.start(room, "start");
  }
  private newMatch(room: Room) {
    return new Match(
      characterById(room.players[0]!.character!),
      {},
      characterById(room.players[1]!.character!),
    );
  }
  lobby(socketId: string) {
    const { room } = this.player(socketId);
    if (!["finished", "closed"].includes(room.status))
      fail("notFinished", "Encerre a luta antes de retornar ao lobby.");
    for (const p of room.players)
      if (p) {
        if (!p.connected) {
          room.players[p.seat] = null;
          continue;
        }
        p.confirmed = p.ready = p.rematch = false;
      }
    if (!room.players[room.host]) room.host = room.players[0] ? 0 : 1;
    room.match = undefined;
    room.inputs = [new Map(), new Map()];
    room.result = undefined;
    room.matchId = "";
    room.tick = 0;
    room.status = "lobby";
    room.updated = this.now();
    this.broadcast(room);
  }
  rematch(socketId: string) {
    const { room, seat } = this.player(socketId);
    if (room.status !== "finished" || !room.players.every((p) => p?.connected))
      fail(
        "noRematch",
        "A revanche precisa dos dois jogadores conectados ao resultado da luta.",
      );
    room.players[seat]!.rematch = true;
    room.updated = this.now();
    this.broadcast(room);
    if (room.players.every((p) => p?.rematch)) {
      room.match = this.newMatch(room);
      this.start(room, "rematch");
    }
  }
  private startPacket(room: Room, reason: StartPacket["reason"]): StartPacket {
    const state = snapshot(room.match!);
    return {
      matchId: room.matchId,
      tick: room.tick,
      delay: this.delay,
      version: ENGINE_VERSION,
      state,
      hash: hashState(state),
      reason,
    };
  }
  private start(room: Room, reason: StartPacket["reason"]) {
    if (reason === "start" || reason === "rematch") room.syncs = [];
    room.matchId = randomUUID();
    room.tick = 0;
    room.status = "playing";
    room.inputs = [new Map(), new Map()];
    room.nextAt = this.now() + 1000 / 60;
    room.waitingSince = undefined;
    room.lastLag = false;
    room.result = undefined;
    // A new input epoch always releases held keys. Physics, stun and resource
    // values are preserved on recovery, but stale network inputs are not.
    room.match!.fighters.forEach((f) => {
      f.input = neutral();
      f.buffer.clear();
    });
    for (const player of room.players)
      if (player) {
        player.accepted = this.delay;
        player.rematch = false;
      }
    for (let tick = 1; tick <= this.delay; tick++) {
      room.inputs[0].set(tick, neutral());
      room.inputs[1].set(tick, neutral());
    }
    room.updated = this.now();
    this.emit(this.peers(room), "match:start", this.startPacket(room, reason));
    this.broadcast(room);
  }
  input(socketId: string, payload: unknown) {
    const { room, seat } = this.player(socketId);
    if (
      !exactObject(payload, ["matchId", "tick", "input"]) ||
      !validInput(payload.input) ||
      !Number.isSafeInteger(payload.tick)
    )
      fail("invalidInput", "Comando inválido.");
    if (payload.matchId !== room.matchId || room.status !== "playing")
      fail("staleMatch", "Entrada de uma partida anterior descartada.");
    const tick = payload.tick as number,
      player = room.players[seat]!;
    if (tick <= player.accepted)
      fail("staleTick", "Entrada repetida descartada.");
    if (tick !== player.accepted + 1)
      fail("inputGap", "Faltou uma entrada. A partida precisa sincronizar.");
    if (tick > room.tick + MAX_AHEAD)
      fail("tooFar", "Entrada fora da janela permitida.");
    player.accepted = tick;
    room.inputs[seat].set(tick, {
      direction: payload.input.direction,
      down: payload.input.down,
      pressed: [...payload.input.pressed],
      ...(room.match?.fighters[seat].omnitrix && payload.input.up ? { up: true } : {}),
      ...(room.match?.fighters[seat].omnitrix && payload.input.omnitrix
        ? { omnitrix: { ...payload.input.omnitrix } } : {}),
    });
  }
  sync(socketId: string, matchId: unknown) {
    const { room } = this.player(socketId);
    if (room.status !== "playing" || matchId !== room.matchId)
      fail("staleMatch", "A partida mudou enquanto a sincronização era solicitada.");
    room.syncs = room.syncs.filter((time) => this.now() - time < 30000);
    if (room.syncs.length >= 3) {
      this.close(room, null, "desync");
      return;
    }
    room.syncs.push(this.now());
    this.start(room, "resync");
  }
  disconnect(socketId: string) {
    const member = this.memberships.get(socketId);
    if (!member) return;
    this.memberships.delete(socketId);
    const { room, seat } = member,
      player = room.players[seat]!;
    player.connected = false;
    player.disconnectedAt = this.now();
    player.ready = false;
    if (room.status === "playing") room.status = "reconnecting";
    room.updated = this.now();
    this.broadcast(room);
  }
  leave(socketId: string) {
    const member = this.memberships.get(socketId);
    if (!member) return;
    this.memberships.delete(socketId);
    const { room, seat } = member;
    if (room.status === "playing" || room.status === "reconnecting")
      this.close(room, (1 - seat) as Seat, "left");
    room.players[seat] = null;
    if (room.host === seat) room.host = (1 - seat) as Seat;
    room.updated = this.now();
    this.broadcast(room);
    if (room.players.every((p) => !p)) {
      this.rooms.delete(room.code);
      this.retired.set(room.code, this.now());
    }
  }
  private close(room: Room, winner: Seat | null, reason: EndPacket["reason"]) {
    room.status = "closed";
    room.updated = this.now();
    room.result = {
      matchId: room.matchId, tick: room.tick, winner, reason,
      score: [room.match!.wins[0], room.match!.wins[1]],
    };
    this.emit(this.peers(room), "match:end", room.result);
    this.broadcast(room);
  }
  pump() {
    const now = this.now();
    for (const [code, time] of this.retired)
      if (now - time > this.ttl || this.retired.size > 1000)
        this.retired.delete(code);
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (
          !player ||
          player.connected ||
          player.disconnectedAt === undefined ||
          now - player.disconnectedAt < this.graceMs
        )
          continue;
        if (room.status === "reconnecting")
          this.close(
            room,
            room.players[1 - player.seat]?.connected
              ? ((1 - player.seat) as Seat)
              : null,
            "disconnect",
          );
        if (room.status === "lobby") {
          room.players[player.seat] = null;
          if (room.host === player.seat) room.host = (1 - player.seat) as Seat;
        }
        player.disconnectedAt = undefined;
        this.broadcast(room);
      }
      if (
        (!room.players.some((p) => p?.connected) &&
          now - room.updated > this.graceMs) ||
        (room.status !== "playing" && now - room.updated > this.ttl)
      ) {
        this.emit(this.peers(room), "room:expired", undefined);
        for (const player of room.players)
          if (player) this.memberships.delete(player.socketId);
        this.rooms.delete(room.code);
        this.retired.set(room.code, now);
        continue;
      }
      if (room.status !== "playing") continue;
      for (let budget = 0; budget < 4 && now >= room.nextAt; budget++) {
        const tick = room.tick + 1,
          a = room.inputs[0].get(tick),
          b = room.inputs[1].get(tick);
        if (!a || !b) {
          room.waitingSince ??= now;
          room.nextAt = now + 1000 / 60;
          if (now - room.waitingSince > 250 && !room.lastLag) {
            room.lastLag = true;
            this.emit(this.peers(room), "net:lag", true);
          }
          if (now - room.waitingSince > this.inputTimeout)
            this.close(room, !a && !b ? null : !a ? 1 : 0, "inputTimeout");
          break;
        }
        if (room.lastLag) {
          room.lastLag = false;
          this.emit(this.peers(room), "net:lag", false);
        }
        room.waitingSince = undefined;
        room.inputs[0].delete(tick);
        room.inputs[1].delete(tick);
        room.match!.step([a, b]);
        room.tick = tick;
        room.updated = now;
        const state = snapshot(room.match!),
          packet: StepPacket = {
            matchId: room.matchId,
            tick,
            inputs: [a, b],
            hash: hashState(state),
          };
        if (tick % 60 === 0) packet.checkpoint = state;
        this.emit(this.peers(room), "match:step", packet);
        room.nextAt += 1000 / 60;
        if (room.match!.phase === "finished") {
          room.status = "finished";
          room.result = {
            matchId: room.matchId,
            tick,
            winner: room.match!.wins[0] >= 2 ? 0 : 1,
            score: [room.match!.wins[0], room.match!.wins[1]],
            reason: room.match!.timer <= 0 ? "time" : "ko",
          };
          this.emit(this.peers(room), "match:end", room.result);
          this.broadcast(room);
          break;
        }
      }
    }
  }
}
