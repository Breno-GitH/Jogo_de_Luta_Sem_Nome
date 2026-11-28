import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/server";
import { ENGINE_VERSION } from "../src/net/version";
import { INPUT_DELAY, type StepPacket } from "../src/net/protocol";
import { restore, snapshot, hashState } from "../src/engine/state";
import { neutral } from "../src/engine/types";
import { arenaIds, createArena } from "../src/engine/arenas";
import { forceArenaEvent, impactAt, isArenaEvent, eventStage } from "../src/engine/arena-events";
import { benEventOrder, type BenArenaEventKind } from "../src/engine/ben-arena";

it("replays all nine authored events, terrain, a descent and a fatal ledge fall over two actual Socket.IO connections", async () => {
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
    const extraBen = [...benEventOrder.market, ...benEventOrder.smoothy];
    for (const stage of [...arenaIds, "enies-descent", "clover-fall", "ben-lift", "ben-return", "dojo-rooms", ...extraBen] as const) {
      const id = stage === "enies-descent" ? "enies" : stage === "clover-fall" ? "clover" : stage === "dojo-rooms" ? "dojo" : stage === "ben-lift" || stage === "ben-return" || extraBen.includes(stage as BenArenaEventKind) ? "undertown" : stage as typeof arenaIds[number];
      match.phase = "fight";
      match.arena = createArena(id, "interativo");
      for (const f of match.fighters) { f.health = 1000; f.y = 580; f.vx = f.vy = 0; f.stun = 0; f.setState("idle"); }
      match.fighters[0].x = stage === "clover-fall" ? 90 : 400;
      match.fighters[1].x = 880;
      let duration = 135;
      if (stage === "ben-lift") {
        match.arena.ben!.supports = 3; match.arena.ben!.exposed = true;
        match.fighters[0].x = 1060; match.fighters[1].x = 1130; duration = 240;
      } else if (stage === "ben-return") {
        match.arena.ben!.area = "smoothy"; match.arena.ben!.used = true;
        match.fighters[0].x = 1140; match.fighters[1].x = 940; duration = 230;
      } else if (stage === "dojo-rooms") {
        match.fighters[0].x = 1060; match.fighters[1].x = 1140; duration = 130;
      } else if (stage !== "clover-fall") {
        if (extraBen.includes(stage as BenArenaEventKind)) match.arena.ben!.area = benEventOrder.smoothy.includes(stage as BenArenaEventKind) ? "smoothy" : "market";
        forceArenaEvent(match.arena, stage === "enies-descent" ? "transformation" : "primary", extraBen.includes(stage as BenArenaEventKind) ? stage as BenArenaEventKind : undefined);
        const event = match.arena.hazard;
        if (!isArenaEvent(event)) throw Error("Missing event");
        match.fighters[0].x = event.x;
        duration = impactAt(match.arena, event) + (stage === "enies-descent" ? 100 : 270);
        if (extraBen.includes(stage as BenArenaEventKind)) {
          event.age = impactAt(match.arena, event) - 8; event.stage = eventStage(match.arena, event).stage; event.ticks = 8; duration = 64;
        }
      }
      const mirrors = clients.map(() => restore(snapshot(match)));
      for (let n = 0; n < duration; n++) {
        // Respect the production input flood limit while retaining actual transport delivery.
        await new Promise(resolve => setTimeout(resolve, 10));
        const packets = clients.map(socket => new Promise<StepPacket>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Missing ${stage} step ${n}`)), 3000);
          socket.once("match:step", packet => { clearTimeout(timer); resolve(packet); });
        }));
        const tick = room.tick + INPUT_DELAY + 1;
        clients.forEach((socket, seat) => socket.emit("match:input", { matchId: room.matchId, tick, input: seat === 0 && ["ben-lift", "dojo-rooms"].includes(stage) && n === 0 ? { ...neutral(), pressed: ["heavy"] } : seat === 0 && stage === "ben-return" ? { ...neutral(), down: true } : neutral() }));
        await Promise.all(clients.map(socket => new Promise<void>(resolve => socket.emit("net:ping", resolve))));
        room.nextAt = performance.now() - 1; app.rooms.pump();
        const steps = await Promise.all(packets);
        for (let seat = 0; seat < 2; seat++) {
          mirrors[seat].step(steps[seat].inputs);
          expect(hashState(snapshot(mirrors[seat])), `${stage} tick ${n}`).toBe(steps[seat].hash);
        }
        if (stage === "clover-fall" && match.arena.ringOutSeat !== undefined) break;
      }
      if (stage === "enies-descent") expect(match.arena.level).toBe(1);
      else if (stage === "ben-lift") expect(match.arena.ben!.area).toBe("smoothy");
      else if (stage === "ben-return") expect(match.arena.ben!.area).toBe("market");
      else if (stage === "dojo-rooms") expect(match.arena.dojo!.room).toBe("veranda");
      else if (stage === "clover-fall") {
        expect(match.fighters[0].health).toBe(0); expect(match.phase).toBe("roundEnd");
        expect(match.arena.ringOutSeat).toBe(0); expect(match.fighters[0].y).toBeGreaterThan(920);
        expect(mirrors.every(m => m.fighters[0].health === 0 && m.phase === "roundEnd")).toBe(true);
      }
    }
  } finally {
    clients.forEach(socket => socket.disconnect()); await app.close();
  }
}, 180000);
