import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/server";
import { ENGINE_VERSION } from "../src/net/version";
import { INPUT_DELAY, type StepPacket } from "../src/net/protocol";
import { restore, snapshot, hashState } from "../src/engine/state";
import { neutral } from "../src/engine/types";

it("replays a stage descent and an open ledge fall over two actual Socket.IO connections", async () => {
  const app = createGameServer({ autoTick: false });
  const clients: Socket[] = [];
  try {
    await new Promise<void>(resolve => app.http.listen(0, "127.0.0.1", resolve));
    for (let n = 0; n < 2; n++) {
      const socket = io(`http://127.0.0.1:${(app.http.address() as { port: number }).port}`, { transports: ["websocket"], forceNew: true });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
    }
    const [host, guest] = clients;
    const made = await host.timeout(1000).emitWithAck("room:create", { version: ENGINE_VERSION });
    await guest.timeout(1000).emitWithAck("room:join", { code: made.data.room.code, version: ENGINE_VERSION });
    for (const [socket, character] of [[host, "asta"], [guest, "goku"]] as const) {
      await socket.timeout(1000).emitWithAck("room:select", { character });
      await socket.timeout(1000).emitWithAck("room:confirm", {});
      await socket.timeout(1000).emitWithAck("room:ready", { ready: true });
    }
    await host.timeout(1000).emitWithAck("room:start", {});
    const room = app.rooms.rooms.get(made.data.room.code)!, match = room.match!;
    match.phase = "fight";
    // Test starts from an authoritative checkpoint, before the environmental event.
    const { createArena } = await import("../src/engine/arenas");
    for (const stage of ["enies", "clover"] as const) {
      match.arena = createArena(stage, "interativo");
      for (const f of match.fighters) { f.y = 580; f.vx = f.vy = 0; f.stun = 0; f.setState("idle"); }
      match.fighters[0].x = stage === "clover" ? 90 : 400;
      match.fighters[1].x = 880;
      if (stage === "enies") match.arena.hazard = { kind: "fall", x: 400, phase: "warning", ticks: 4, affected: [false, false] };
      const mirrors = clients.map(() => restore(snapshot(match)));
      for (let n = 0; n < 135; n++) {
        // Respect the production input flood limit while retaining actual transport delivery.
        await new Promise(resolve => setTimeout(resolve, 10));
        const packets = clients.map(socket => new Promise<StepPacket>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Missing ${stage} step ${n}`)), 3000);
          socket.once("match:step", packet => { clearTimeout(timer); resolve(packet); });
        }));
        const tick = room.tick + INPUT_DELAY + 1;
        for (const socket of clients) socket.emit("match:input", { matchId: room.matchId, tick, input: neutral() });
        await Promise.all(clients.map(socket => new Promise<void>(resolve => socket.emit("net:ping", resolve))));
        room.nextAt = performance.now() - 1; app.rooms.pump();
        const steps = await Promise.all(packets);
        for (let seat = 0; seat < 2; seat++) {
          mirrors[seat].step(steps[seat].inputs);
          expect(hashState(snapshot(mirrors[seat])), `${stage} tick ${n}`).toBe(steps[seat].hash);
        }
        if (stage === "clover" && match.arena.ringOutSeat !== undefined) break;
      }
      if (stage === "enies") expect(match.arena.level).toBe(1);
      else {
        expect(match.fighters[0].health).toBe(0); expect(match.phase).toBe("roundEnd");
        expect(match.arena.ringOutSeat).toBe(0); expect(match.fighters[0].y).toBeGreaterThan(920);
        expect(mirrors.every(m => m.fighters[0].health === 0 && m.phase === "roundEnd")).toBe(true);
      }
    }
  } finally {
    clients.forEach(socket => socket.disconnect()); await app.close();
  }
}, 45000);
