import { describe, it, expect, afterEach } from "vitest";
import { Rooms, RoomError } from "../server/rooms";
import { createGameServer } from "../server/server";
import { io, type Socket } from "socket.io-client";
import { Match } from "../src/engine/combat";
import { snapshot, restore, hashState } from "../src/engine/state";
import { neutral } from "../src/engine/types";
import { ENGINE_VERSION } from "../src/net/version";
import type { StartPacket, StepPacket } from "../src/net/protocol";
import { normalizeCode, validInput, INPUT_DELAY } from "../src/net/protocol";

function fixture() {
  let now = 0;
  const events: { ids: string[]; event: string; payload: any }[] = [];
  const service = new Rooms(
    (ids, event, payload) => events.push({ ids, event, payload }),
    () => now,
  );
  const a = service.create("a"),
    b = service.join("b", a.room.code);
  service.select("a", "samurai");
  service.select("b", "samurai");
  service.confirm("a");
  service.confirm("b");
  service.ready("a", true);
  service.ready("b", true);
  service.startMatch("a");
  const room = service.rooms.get(a.room.code)!;
  const pump = (ms = 1000 / 60 + 0.001) => {
    now += ms;
    service.pump();
  };
  const input = (socket: string, tick: number, frame = neutral()) =>
    service.input(socket, { matchId: room.matchId, tick, input: frame });
  return { service, room, a, b, events, pump, input };
}
describe("deterministic state and validation", () => {
  it("serializes hidden command timers, physics, capture and round state and replays identically", () => {
    const original = new Match();
    original.phase = "fight";
    original.fighters[0].x = 500;
    original.fighters[1].x = 600;
    original.fighters[0].meter = 100;
    original.step([{ ...neutral(), pressed: ["ultimate"] }, neutral()]);
    for (let i = 0; i < 32; i++) original.step([neutral(), neutral()]);
    expect(original.capture).toBeDefined();
    const saved = JSON.parse(JSON.stringify(snapshot(original))),
      copy = restore(saved);
    expect(hashState(snapshot(copy))).toBe(hashState(saved));
    for (let tick = 0; tick < 600; tick++) {
      const input = {
        ...neutral(),
        direction: (tick % 100 < 50 ? 1 : -1) as -1 | 1,
        pressed: tick % 37 === 0 ? ["light" as const] : [],
      };
      original.step([input, neutral()]);
      copy.step([input, neutral()]);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(original)));
    }
    const buffer = new Match();
    buffer.fighters[0].buffer.push(
      { ...neutral(), down: true, pressed: ["heavy"] },
      77,
      1,
    );
    const restored = restore(JSON.parse(JSON.stringify(snapshot(buffer))));
    expect(restored.fighters[0].buffer.snapshot()).toEqual(
      buffer.fighters[0].buffer.snapshot(),
    );
  });
  it("accepts only six-character room codes and bounded real input frames", () => {
    expect(normalizeCode(" abC234 ")).toBe("ABC234");
    for (const code of [null, 123456, "AB12IO", "<img>", "ABC", "ABC234X"])
      expect(normalizeCode(code)).toBeNull();
    expect(validInput(neutral())).toBe(true);
    for (const bad of [
      { direction: 2, down: false, pressed: [] },
      { ...neutral(), health: 10000 },
      { ...neutral(), pressed: ["god"] },
      { ...neutral(), pressed: ["light", "light"] },
    ])
      expect(validInput(bad)).toBe(false);
  });
});
describe("authoritative rooms", () => {
  it("requires selection and both ready; unique codes, unknown/full rooms and invalid characters are handled", () => {
    const s = new Rooms(() => {});
    const a = s.create("a"),
      b = s.create("b");
    expect(a.room.code).not.toBe(b.room.code);
    expect(() => s.join("c", "XXXXXX")).toThrow("Sala não encontrada");
    s.leave("b");
    s.join("b", a.room.code);
    expect(() => s.join("c", a.room.code)).toThrow("dois jogadores");
    expect(() => s.ready("a", true)).toThrow("Selecione");
    expect(() => s.select("a", "other")).toThrow("indisponível");
    s.select("a", "samurai");
    s.select("b", "samurai");
    s.confirm("a");
    s.confirm("b");
    s.ready("a", true);
    expect(s.rooms.get(a.room.code)!.status).toBe("lobby");
    s.ready("b", true);
    expect(s.rooms.get(a.room.code)!.status).toBe("lobby");
    expect(() => s.startMatch("b")).toThrow("anfitrião");
    s.startMatch("a");
    expect(s.rooms.get(a.room.code)!.status).toBe("playing");
  });
  it("never changes combat with late, duplicate, foreign, malformed or out-of-window inputs", () => {
    const f = fixture();
    const before = hashState(snapshot(f.room.match!));
    expect(() => f.input("outsider", 7)).toThrow(RoomError);
    expect(() =>
      f.service.input("a", {
        matchId: f.room.matchId,
        tick: 7,
        input: { ...neutral(), health: 99999 },
      }),
    ).toThrow("Comando inválido");
    f.input("a", 7);
    expect(() =>
      f.input("a", 7, { ...neutral(), pressed: ["ultimate"] }),
    ).toThrow("repetida");
    expect(() => f.input("a", 9)).toThrow("Faltou");
    expect(() =>
      f.service.input("a", { matchId: "old", tick: 8, input: neutral() }),
    ).toThrow("anterior");
    for (let tick = 8; tick <= 90; tick++) f.input("a", tick);
    expect(() => f.input("a", 91)).toThrow("janela");
    expect(hashState(snapshot(f.room.match!))).toBe(before);
    expect(f.room.match!.fighters[0].health).toBe(1000);
    expect(f.room.inputs[0].size).toBeLessThanOrEqual(90);
  });
  it("waits for both inputs, applies the exact tick and resolves actual sword damage", () => {
    const f = fixture();
    f.room.match!.phase = "fight";
    f.room.match!.message = "";
    f.room.match!.fighters[0].x = 500;
    f.room.match!.fighters[1].x = 600;
    for (let i = 0; i < INPUT_DELAY; i++) f.pump();
    expect(f.room.tick).toBe(INPUT_DELAY);
    f.pump(300);
    expect(f.room.tick).toBe(INPUT_DELAY);
    f.input("a", 7, { ...neutral(), pressed: ["light"] });
    f.pump();
    expect(f.room.tick).toBe(INPUT_DELAY);
    for (let tick = 7; tick < 40; tick++) {
      if (tick > 7) f.input("a", tick);
      f.input("b", tick);
      f.pump();
    }
    expect(f.room.match!.fighters[1].health).toBe(955);
    expect(f.events.some((e) => e.event === "match:step")).toBe(true);
  });
  it("recovers only the reserved token, freezes disconnects and starts a clean input epoch", () => {
    const f = fixture();
    f.pump();
    const frame = f.room.match!.frame,
      epoch = f.room.matchId;
    f.service.disconnect("b");
    f.pump(1000);
    expect(f.room.match!.frame).toBe(frame);
    expect(f.room.status).toBe("reconnecting");
    expect(() => f.service.resume("x", f.room.code, "0".repeat(64))).toThrow(
      "recuperar",
    );
    const member = f.service.resume("new-b", f.room.code, f.b.token);
    expect(member.seat).toBe(1);
    f.service.afterResume("new-b");
    expect(f.room.status).toBe("playing");
    expect(f.room.matchId).not.toBe(epoch);
    expect(f.room.tick).toBe(0);
    expect(f.room.match!.frame).toBe(frame);
    expect(f.room.players[1]!.accepted).toBe(INPUT_DELAY);
  });
  it("forfeits an expired disconnect and closes a stalled match safely", () => {
    const f = fixture();
    f.service.disconnect("a");
    f.pump(15001);
    expect(f.room.status).toBe("closed");
    expect(f.room.result?.winner).toBe(1);
    expect(f.room.result?.reason).toBe("disconnect");
    const stalled = fixture();
    for (let i = 0; i < 8; i++) stalled.pump();
    stalled.pump(5100);
    expect(stalled.room.status).toBe("closed");
    expect(stalled.room.result?.winner).toBeNull();
  });
  it("requires two rematch votes and rejects old-match input after the new fight starts", () => {
    const f = fixture();
    f.room.match!.phase = "finished";
    f.room.match!.wins = [2, 0];
    f.pump();
    expect(f.room.status).toBe("finished");
    const old = f.room.matchId;
    f.service.rematch("a");
    expect(f.room.matchId).toBe(old);
    f.service.rematch("b");
    expect(f.room.matchId).not.toBe(old);
    expect(f.room.match!.wins).toEqual([0, 0]);
    expect(f.room.match!.fighters[1].health).toBe(1000);
    expect(() =>
      f.service.input("a", { matchId: old, tick: 7, input: neutral() }),
    ).toThrow("anterior");
  });
  it("restores authoritative checkpoints and terminates repeated desyncs without inventing a winner", () => {
    const f = fixture();
    f.room.match!.fighters[0].health = 777;
    const first = f.room.matchId;
    f.service.sync("a", first);
    expect(f.room.matchId).not.toBe(first);
    expect(f.room.match!.fighters[0].health).toBe(777);
    expect(() => f.service.sync("b", first)).toThrow("A partida mudou");
    expect(f.room.syncs).toHaveLength(1);
    for (let i = 0; i < 3; i++) f.service.sync("a", f.room.matchId);
    expect(f.room.status).toBe("closed");
    expect(f.room.result?.winner).toBeNull();
    expect(f.room.result?.reason).toBe("desync");
    expect(f.room.result?.score).toEqual([0, 0]);
  });
  it("expires idle rooms and permits a new lobby member after a reservation expires", () => {
    let now = 0;
    const s = new Rooms(
      () => {},
      () => now,
      { graceMs: 100, lobbyTtlMs: 1000 },
    );
    const a = s.create("a");
    s.join("b", a.room.code);
    s.disconnect("b");
    now = 101;
    s.pump();
    expect(s.join("c", a.room.code).seat).toBe(1);
    now = 1200;
    s.pump();
    expect(s.rooms.size).toBe(0);
  });
});

describe("real Socket.IO server boundary", () => {
  let app: ReturnType<typeof createGameServer> | undefined;
  const sockets: Socket[] = [];
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await app?.close();
    app = undefined;
  });
  async function connect() {
    if (!app) {
      app = createGameServer({ autoTick: false });
      await new Promise<void>((resolve) =>
        app!.http.listen(0, "127.0.0.1", resolve),
      );
    }
    const port = (app.http.address() as { port: number }).port;
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  }
  it("creates, joins and validates room membership over actual sockets", async () => {
    const a = await connect(),
      b = await connect(),
      c = await connect();
    const created = await a
      .timeout(1000)
      .emitWithAck("room:create", { version: ENGINE_VERSION });
    expect(created.ok).toBe(true);
    expect(
      (
        await b.timeout(1000).emitWithAck("room:join", {
          code: created.data.room.code,
          version: ENGINE_VERSION,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await c.timeout(1000).emitWithAck("room:join", {
          code: created.data.room.code,
          version: ENGINE_VERSION,
        })
      ).code,
    ).toBe("roomFull");
    expect(
      (await c.timeout(1000).emitWithAck("room:create", { version: "fake" }))
        .code,
    ).toBe("versionMismatch");
    expect(created.data.room.players[0].token).toBeUndefined();
    expect(created.data.token).toHaveLength(64);
  });
  it("keeps two Socket.IO clients in sync through empowered Triple Rupture and Pandemonium", async () => {
    const host = await connect(), guest = await connect();
    const made = await host.timeout(1000).emitWithAck("room:create", { version: ENGINE_VERSION });
    expect((await guest.timeout(1000).emitWithAck("room:join", {
      code: made.data.room.code, version: ENGINE_VERSION,
    })).ok).toBe(true);
    for (const [socket, character] of [[host, "xebec"], [guest, "samurai"]] as const) {
      expect((await socket.timeout(1000).emitWithAck("room:select", { character })).ok).toBe(true);
      expect((await socket.timeout(1000).emitWithAck("room:confirm", {})).ok).toBe(true);
      expect((await socket.timeout(1000).emitWithAck("room:ready", { ready: true })).ok).toBe(true);
    }
    const starts = [host, guest].map(socket => new Promise<StartPacket>(resolve => socket.once("match:start", resolve)));
    expect((await host.timeout(1000).emitWithAck("room:start", {})).ok).toBe(true);
    const opening = await Promise.all(starts);
    const room = app!.rooms.rooms.get(made.data.room.code)!;
    // Stage both clients from the same server checkpoint, immediately before the inputs under test.
    const match = room.match!;
    match.phase = "fight";
    match.fighters[0].setState("idle");
    match.fighters[1].setState("idle");
    match.fighters[0].x = 570;
    match.fighters[1].x = 675;
    match.fighters[0].meter = 100;
    match.fighters[0].domination!.charge = 100;
    const players = [host, guest];
    const checkpoints = players.map(socket => new Promise<StartPacket>(resolve => socket.once("match:start", resolve)));
    expect((await host.timeout(1000).emitWithAck("match:sync", { matchId: opening[0].matchId })).ok).toBe(true);
    const copies = (await Promise.all(checkpoints)).map(packet => {
      expect(packet.state.fighters[0].characterId).toBe("xebec");
      return restore(packet.state);
    });
    const history: string[] = [];
    const rejected: unknown[] = [];
    for (const player of players) player.on("input:rejected", event => rejected.push(event));
    let powered = false, projectile = false, phase = false;
    for (let i = 1; i <= 965; i++) {
      await new Promise(resolve => setTimeout(resolve, 14));
      const packets = players.map(socket => new Promise<StepPacket>(resolve => socket.once("match:step", resolve)));
      const frame = neutral();
      if (i === 1) frame.down = true;
      if (i === 2) { frame.down = true; frame.direction = -1; }
      if (i === 3) { frame.direction = -1; frame.pressed = ["heavy"]; }
      if (i >= 100 && i < 143 && match.fighters[1].x - match.fighters[0].x > 70) frame.direction = 1;
      if (i === 147) frame.pressed = ["ultimate"];
      const tick = room.tick + INPUT_DELAY + 1;
      host.emit("match:input", { matchId: room.matchId, tick, input: frame });
      guest.emit("match:input", { matchId: room.matchId, tick, input: neutral() });
      // The ack follows input delivery on each connection before the real Rooms clock advances.
      await Promise.all(players.map(socket => new Promise<void>(resolve => socket.emit("net:ping", () => resolve()))));
      expect(room.players.map(p => p?.accepted), `accepted input for tick ${tick}, room ${room.status}, rejected ${JSON.stringify(rejected)}`).toEqual([tick, tick]);
      room.nextAt = performance.now() - 1;
      app!.rooms.pump();
      expect(room.tick, `step ${i}, status ${room.status}`).toBe(i);
      const steps = await Promise.all(packets);
      for (let seat = 0; seat < copies.length; seat++) {
        copies[seat].step(steps[seat].inputs);
        expect(hashState(snapshot(copies[seat]))).toBe(steps[seat].hash);
        expect(steps[seat].hash).toBe(steps[0].hash);
      }
      powered ||= match.fighters[0].domination!.powered;
      projectile ||= match.kiProjectiles.some(p => p.move === "xebecLowWave");
      phase ||= !!match.pandemonium;
      history.push(...match.hits.map(h => h.move));
      if (phase && !match.cinematicActive) break;
    }
    expect({ powered, projectile, phase }).toEqual({ powered: true, projectile: true, phase: true });
    expect(history.filter(move => move.startsWith("pandemonium"))).toEqual(["pandemonium_cleave", "pandemonium_ground"]);
    expect(match.cinematicActive).toBe(false);
  }, 45000);

  it("does not expose health/results updates and rejects hostile input payloads", async () => {
    const a = await connect(),
      b = await connect();
    const made = await a
      .timeout(1000)
      .emitWithAck("room:create", { version: ENGINE_VERSION });
    await b.timeout(1000).emitWithAck("room:join", {
      code: made.data.room.code,
      version: ENGINE_VERSION,
    });
    for (const socket of [a, b]) {
      await socket
        .timeout(1000)
        .emitWithAck("room:select", { character: "samurai" });
      await socket.timeout(1000).emitWithAck("room:confirm", {});
      await socket.timeout(1000).emitWithAck("room:ready", { ready: true });
    }
    await a.timeout(1000).emitWithAck("room:start", {});
    const room = app!.rooms.rooms.get(made.data.room.code)!;
    const rejected = new Promise<any>((resolve) =>
      a.once("input:rejected", resolve),
    );
    a.emit("match:input", {
      matchId: room.matchId,
      tick: 7,
      input: { ...neutral(), health: 99999 },
    });
    expect((await rejected).code).toBe("invalidInput");
    a.emit("match:state", { health: 99999, wins: [2, 0] });
    a.emit("match:end", { winner: 0 });
    await a.timeout(1000).emitWithAck("room:ready", { ready: false });
    expect(room.match!.fighters[0].health).toBe(1000);
    expect(room.match!.wins).toEqual([0, 0]);
    expect(room.status).toBe("playing");
  });
});
