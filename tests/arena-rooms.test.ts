import { describe, expect, it } from "vitest";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { createArena, stepArena } from "../src/engine/arenas";
import { beginDojoTravel, dojoRoomOrder, dojoTravelTicks, stepDojoRooms } from "../src/engine/arena-rooms";
import { applyEventConsequence } from "../src/engine/arena-terrain";
import { createArenaEvent } from "../src/engine/arena-events";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral } from "../src/engine/types";
const fight = () => { const m = new Match(characters.samurai, { arenaId: "dojo", arenaMode: "interativo" }); m.phase = "fight"; return m; };
const tick = (m: Match, ticks: number) => { for (let i = 0; i < ticks; i++) m.step([neutral(), neutral()]); };
describe("connected dojo rooms", () => {
  it("starts in the original hall and preserves all four distinct spaces", () => {
    const m = fight(); expect(m.arena.dojo!.room).toBe("hall"); expect(dojoRoomOrder).toEqual(["west", "hall", "veranda", "garden"]);
    expect(createArena("undertown", "interativo").dojo).toBeUndefined();
  });
  it("walking or crouching at an exit never changes rooms without a combat impact", () => {
    const m = fight(); m.fighters[0].x = 1060; m.fighters[1].x = 800;
    for (let i = 0; i < 60; i++) m.step([{ ...neutral(), down: true }, neutral()]);
    m.fighters[0].x = 1230;
    for (let i = 0; i < 60; i++) m.step([{ ...neutral(), direction: 1 }, neutral()]);
    expect(m.arena.dojo!.transition).toBeUndefined(); expect(m.arena.dojo!.room).toBe("hall");
  });
  it("a real heavy strike launches the victim into the next room while the attacker follows", () => {
    const m = fight(); m.fighters[0].x = 1060; m.fighters[1].x = 1140;
    m.step([{ ...neutral(), pressed: ["heavy"] }, neutral()]);
    for (let n = 0; n < 80 && !m.arena.dojo!.transition; n++) tick(m, 1);
    expect(m.arena.dojo!.transition?.to).toBe("veranda");
    expect(m.arena.dojo!.transition?.impact).toMatchObject({ attacker: 0, victim: 1 });
    const hp = m.fighters.map(f => f.health); tick(m, 22);
    expect(m.fighters[1].y).toBeLessThan(550); expect(m.fighters[1].state).toBe("hitstun");
    expect(m.fighters[0].state).toBe("dash");
    tick(m, dojoTravelTicks); expect(m.arena.dojo!.room).toBe("veranda"); expect(m.arena.dojo!.transition).toBeUndefined();
    expect(m.fighters.map(f => f.health)).toEqual(hp); expect(m.fighters.every(f => f.y === 580 && f.state === "idle")).toBe(true);
  });
  it("edge impacts work both ways and connect the veranda to the garden", () => {
    for (const [room, x, attackerX, to] of [["hall", 120, 230, "west"], ["veranda", 1160, 1050, "garden"], ["garden", 120, 230, "veranda"]] as const) {
      const m = fight(); m.arena.dojo!.room = room; m.fighters[0].x = attackerX; m.fighters[1].x = x;
      m.hits = [{ serial: 1, frame: m.frame, attacker: 0, victim: 1, move: "heavy", damage: 60, blocked: false, combo: 1 }];
      tick(m, 1); expect(m.arena.dojo!.transition?.to).toBe(to); tick(m, dojoTravelTicks); expect(m.arena.dojo!.room).toBe(to);
    }
  });
  it("blocked, weak, central or fatal hits cannot force a room change", () => {
    for (const [x, damage, blocked, hp] of [[1160, 60, true, 1000], [1160, 12, false, 1000], [640, 60, false, 1000], [1160, 60, false, 0]] as const) {
      const m = fight(); m.fighters[0].x = 1000; m.fighters[1].x = x; m.fighters[1].health = hp;
      m.hits = [{ serial: 1, frame: m.frame, attacker: 0, victim: 1, move: "heavy", damage, blocked, combo: 1 }]; tick(m, 1);
      expect(m.arena.dojo!.transition).toBeUndefined();
    }
  });
  it("a single fighter cannot teleport a distant opponent into another room", () => {
    const m = fight(); m.fighters[0].x = 1230; m.fighters[1].x = 200;
    for (let i = 0; i < 80; i++) m.step([{ ...neutral(), direction: 1 }, neutral()]);
    expect(m.arena.dojo!.transition).toBeUndefined(); expect(m.arena.dojo!.room).toBe("hall");
  });
  it("rejects travel in Classic or outside combat and clears Ben's old room objects", () => {
    const m = fight(); m.arena.mode = "classico";
    expect(beginDojoTravel(m, "garden", 1)).toBe(false);
    m.arena.mode = "interativo"; m.phase = "intro";
    expect(beginDojoTravel(m, "garden", 1)).toBe(false);
    const ben = new Match(characters.ben, { arenaId: "dojo", arenaMode: "interativo" }); ben.phase = "fight";
    ben.fighters[0].omnitrix!.objects.push({ kind: "old-room" } as never);
    expect(beginDojoTravel(ben, "garden", 1)).toBe(true);
    expect(ben.fighters[0].omnitrix!.objects).toEqual([]);
  });
  it("pauses combat, timer and damage during travel, clears attack inputs and restores control", () => {
    const m = fight(), health = m.fighters.map(f => f.health), timer = m.timer;
    beginDojoTravel(m, "west", -1);
    for (let i = 0; i < dojoTravelTicks; i++) m.step([{ ...neutral(), pressed: ["ultimate", "heavy"] }, { ...neutral(), pressed: ["heavy"] }]);
    expect(m.timer).toBe(timer); expect(m.fighters.map(f => f.health)).toEqual(health); expect(m.fighters.every(f => f.state === "idle")).toBe(true);
    m.step([{ ...neutral(), direction: -1 }, neutral()]); expect(m.fighters[0].state).toBe("walk");
  });
  it("restores room-specific damage and gives the garden a pergola instead of a wooden floor hole", () => {
    const m = fight(), event = createArenaEvent(m.arena, "transformation"); applyEventConsequence(m.arena, event);
    const terrain = structuredClone(m.arena.terrain); beginDojoTravel(m, "garden", 1, true); tick(m, dojoTravelTicks);
    expect(m.arena.terrain).toEqual([]);
    const garden = createArenaEvent(m.arena, "transformation"); expect(garden.source.y).toBe(220); applyEventConsequence(m.arena, garden);
    expect(m.arena.terrain.some(t => t.kind === "wood-floor")).toBe(false);
    beginDojoTravel(m, "hall", -1, true); tick(m, dojoTravelTicks); expect(m.arena.terrain).toEqual(terrain);
  });
  it("snapshots synchronize every room-transition tick and DIO can freeze the transition", () => {
    const m = fight(); beginDojoTravel(m, "veranda", 1); const mirror = restore(snapshot(m));
    for (let i = 0; i < dojoTravelTicks + 10; i++) { tick(m, 1); tick(mirror, 1); expect(hashState(snapshot(mirror))).toBe(hashState(snapshot(m))); }
    beginDojoTravel(m, "garden", 1); const before = JSON.stringify(m.arena); m.temporal.activate(0);
    for (let i = 0; i < 30; i++) stepArena(m, []); expect(JSON.stringify(m.arena)).toBe(before);
  });
});
