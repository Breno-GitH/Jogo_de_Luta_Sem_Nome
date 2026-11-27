import { describe, expect, it } from "vitest";
import { Match, FLOOR, type CombatHit } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { arenaIds, arenaForCharacter, stepArena } from "../src/engine/arenas";
import { hashState, restore, snapshot } from "../src/engine/state";
import { Rooms } from "../server/rooms";
import { neutral } from "../src/engine/types";

const strongHit = (serial: number): CombatHit => ({
  serial, frame: serial, attacker: 0, victim: 1,
  move: "test", damage: 60, blocked: false, combo: 1,
});
const fight = (arenaId: typeof arenaIds[number], arenaMode: "classico" | "interativo" | "caotico") => {
  const m = new Match(characters.samurai, { training: true, arenaId, arenaMode }, characters.goku);
  m.phase = "fight";
  return m;
};

describe("nine living arenas", () => {
  it("maps the nine playable universes to nine distinct scenes", () => {
    expect(arenaIds).toHaveLength(9);
    expect(new Set(Object.values(arenaForCharacter)).size).toBe(9);
    for (const id of arenaIds) expect(fight(id, "classico").arena.id).toBe(id);
  });

  it("keeps classic mode cosmetic and transitions Uchiha only after strong impacts", () => {
    const classic = fight("uchiha", "classico");
    for (let i = 0; i < 4; i++) stepArena(classic, [strongHit(i)]);
    expect(classic.arena.phase).toBe(0);
    expect(classic.arena.hazard).toBeUndefined();
    const interactive = fight("uchiha", "interativo");
    for (let i = 0; i < 3; i++) stepArena(interactive, [strongHit(i)]);
    expect(interactive.arena.phase).toBe(1);
    expect(interactive.arena.phaseStart).toBe(3);
    expect(interactive.arena.hazard).toBeUndefined();
    expect(hashState(snapshot(restore(snapshot(interactive))))).toBe(hashState(snapshot(interactive)));
  });

  it("telegraphs chaotic hazards, applies only one nonlethal hit per fighter, then cools down", () => {
    const m = fight("undertown", "caotico");
    m.fighters[1].x = 880;
    m.fighters[1].y = FLOOR;
    m.fighters[1].health = 9;
    stepArena(m, [strongHit(1)]);
    stepArena(m, [strongHit(2)]);
    expect(m.arena.hazard?.phase).toBe("warning");
    const before = m.fighters[1].health;
    for (let i = 0; i < 63; i++) stepArena(m, []);
    expect(m.fighters[1].health).toBe(before);
    stepArena(m, []);
    expect(m.arena.hazard?.phase).toBe("active");
    stepArena(m, []);
    expect(m.fighters[1].health).toBe(1);
    for (let i = 0; i < 20; i++) stepArena(m, []);
    expect(m.fighters[1].health).toBe(1);
    expect(m.arena.hazard?.phase).toBe("cooldown");
  });

  it("uses a visible optional Budokai boundary for ring-out and ends only a valid hit", () => {
    const m = fight("budokai", "caotico");
    const victim = m.fighters[1];
    victim.x = 65;
    victim.y = FLOOR;
    victim.stun = 20;
    m.hits = [strongHit(1)];
    m.step([neutral(), neutral()]);
    expect(m.arena.ringOutSeat).toBe(1);
    expect(m.message).toBe("FORA DO RINGUE");
    expect(m.phase).toBe("roundEnd");
    const classic = fight("budokai", "classico");
    classic.fighters[1].x = 65;
    classic.fighters[1].stun = 20;
    classic.hits = [strongHit(2)];
    classic.step([neutral(), neutral()]);
    expect(classic.arena.ringOutSeat).toBeUndefined();
  });

  it("suspends hazards during intros and cinematics while retaining impact reactions", () => {
    const m = fight("godvalley", "caotico");
    stepArena(m, [strongHit(1), strongHit(2)]);
    const ticks = m.arena.hazard!.ticks;
    m.phase = "intro";
    stepArena(m, []);
    expect(m.arena.hazard!.ticks).toBe(ticks);
    m.phase = "fight";
    m.pandemonium = {} as Match["pandemonium"];
    stepArena(m, [{ ...strongHit(3), damage: 150 }]);
    expect(m.arena.reactionKind).toBe("super");
    expect(m.arena.hazard!.ticks).toBe(ticks);
  });

  it("lets the host choose an arena and mode, resetting ready votes", () => {
    const rooms = new Rooms(() => {});
    const code = rooms.create("host").room.code;
    rooms.join("guest", code);
    for (const [socket, character] of [["host", "asta"], ["guest", "dio"]]) {
      rooms.select(socket, character);
      rooms.confirm(socket);
      rooms.ready(socket, true);
    }
    expect(() => rooms.selectArena("guest", "cairo", "caotico")).toThrow();
    expect(() => rooms.selectArena("host", "wrong", "caotico")).toThrow();
    rooms.selectArena("host", "godvalley", "caotico");
    expect(rooms.rooms.get(code)!.players.every(p => !p?.ready)).toBe(true);
    rooms.ready("host", true);
    rooms.ready("guest", true);
    rooms.startMatch("host");
    expect(rooms.rooms.get(code)!.match!.arena.id).toBe("godvalley");
    expect(rooms.rooms.get(code)!.match!.arena.mode).toBe("caotico");
  });

  it("keeps two LAN replays identical through a telegraph and hazard contact", () => {
    let now = 0;
    const packets: any[] = [];
    const rooms = new Rooms((_, event, packet) => { if (event === "match:step") packets.push(packet); }, () => now);
    const code = rooms.create("host").room.code;
    rooms.join("guest", code);
    rooms.selectArena("host", "undertown", "caotico");
    for (const [socket, character] of [["host", "samurai"], ["guest", "goku"]]) {
      rooms.select(socket, character); rooms.confirm(socket); rooms.ready(socket, true);
    }
    rooms.startMatch("host");
    const room = rooms.rooms.get(code)!;
    const m = room.match!;
    m.phase = "fight";
    m.fighters[1].x = 880;
    m.fighters[1].y = FLOOR;
    m.hits = [strongHit(1), strongHit(2)];
    const clients = [restore(snapshot(m)), restore(snapshot(m))];
    for (let t = 1; t <= 84; t++) {
      for (const socket of ["host", "guest"]) rooms.input(socket, { matchId: room.matchId, tick: t + rooms.delay, input: neutral() });
      now += 1000 / 60 + 0.001;
      rooms.pump();
      const packet = packets.at(-1);
      expect(packet).toBeDefined();
      for (const client of clients) {
        client.step(packet.inputs);
        expect(hashState(snapshot(client))).toBe(packet.hash);
      }
    }
    expect(m.arena.hazard).toBeDefined();
  });
});
