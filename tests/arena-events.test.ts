import { describe, expect, it } from "vitest";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { arenaIds, createArena, stepArena, type ArenaId } from "../src/engine/arenas";
import { advanceEventClock, applyEventContacts, arenaEventSpecs, createArenaEvent, eventProjectile, eventStage, eventTiming, eventVolumes, forceArenaEvent, impactAt, isArenaEvent } from "../src/engine/arena-events";
import { applyEventConsequence, mainFloorHeight, ringBounds, stepArenaTerrain } from "../src/engine/arena-terrain";
import { arenaPlatforms } from "../src/engine/arena-layouts";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral } from "../src/engine/types";

const fight = (id: ArenaId, classic = false) => {
  const m = new Match(characters.samurai, { training: true, arenaId: id, arenaMode: classic ? "classico" : "interativo" }, characters.goku);
  m.phase = "fight"; return m;
};
const tick = (m: Match, n = 1) => { for (let i = 0; i < n; i++) m.step([neutral(), neutral()]); };
describe("authored environmental events", () => {
  for (const id of arenaIds) {
    it(`${id}: full warning, physical origin, one primary contact and deterministic consequence`, () => {
      const m = fight(id), a = m.arena, h = createArenaEvent(a); a.hazard = h;
      const t = eventTiming(a, h), impact = impactAt(a, h);
      expect(t.preparation + t.warning).toBeGreaterThanOrEqual(96);
      expect(eventVolumes(a, h)).toEqual([]);
      h.age = t.preparation + t.warning;
      expect(eventProjectile(a, h).x).toBe(h.source.x);
      expect(eventProjectile(a, h).y).toBe(h.source.y);
      expect(eventVolumes(a, h)).toEqual([]);
      h.age = impact - 1;
      expect(eventVolumes(a, h)).toEqual([]);
      h.age = impact; h.stage = "impact";
      const actor = m.fighters[1]; actor.x = h.x; actor.health = 100;
      const other = m.fighters[0]; other.x = id === "enies" ? h.x - 66 : h.x;
      if (id === "enies") actor.x = h.x - 66;
      applyEventConsequence(a, h); applyEventConsequence(a, h);
      const terrainCount = a.terrain.length;
      for (let i = 0; i < t.impact; i++) { h.age = impact + i; applyEventContacts(m, h); }
      expect(actor.health).toBe(100 - arenaEventSpecs[id].damage);
      expect(other.health).toBe(1000 - arenaEventSpecs[id].damage);
      expect(a.terrain).toHaveLength(terrainCount);
      actor.health = 1; h.affected[1] = false; h.age = impact;
      applyEventContacts(m, h); expect(actor.health).toBe(1);
      actor.health = 0; h.affected[1] = false; applyEventContacts(m, h); expect(actor.health).toBe(0);
    });
    it(`${id}: clocks visit all phases in order and snapshots replay identically`, () => {
      const m = fight(id), h = createArenaEvent(m.arena); m.arena.hazard = h;
      const mirror = restore(snapshot(m)), seen: string[] = [];
      // No combat inputs or target chasing affect event selection.
      for (let n = 0; n < 410; n++) {
        stepArena(m, []); stepArena(mirror, []);
        if (isArenaEvent(m.arena.hazard) && seen.at(-1) !== m.arena.hazard.stage) seen.push(m.arena.hazard.stage);
        expect(hashState(snapshot(mirror))).toBe(hashState(snapshot(m)));
      }
      expect(seen.slice(0, 5)).toEqual(["preparation", "warning", "action", "impact", "aftermath"]);
      const stages = new Set<string>();
      while (advanceEventClock(m.arena, h)) stages.add(eventStage(m.arena, h).stage);
      expect(stages.has("cooldown")).toBe(true);
    });
    it(`${id}: classic has no event or terrain after a full scheduling cycle`, () => {
      const m = fight(id, true); for (let i = 0; i < 2400; i++) stepArena(m, []);
      expect(m.arena.hazard).toBeUndefined(); expect(m.arena.terrain).toEqual([]);
    });
  }
  it("fixed lanes vary by serial rather than fighter position or health", () => {
    const m = fight("enies"), mirror = restore(snapshot(m));
    m.fighters[0].health = 5; m.fighters[0].x = 12; mirror.fighters[0].x = 1200;
    const sequence = Array.from({ length: 8 }, () => createArenaEvent(m.arena));
    const other = Array.from({ length: 8 }, () => createArenaEvent(mirror.arena));
    expect(sequence).toEqual(other); expect(new Set(sequence.map(h => h.x)).size).toBe(3);
    expect(sequence[2].variant).toBe("transformation");
  });
  it("the staggered Buster Call shells have matching impact windows", () => {
    const a = createArena("enies", "interativo"), h = createArenaEvent(a), impact = impactAt(a, h);
    for (let shot = 0; shot < 3; shot++) {
      h.age = impact + shot * 13;
      const shell = eventProjectile(a, h, shot);
      expect(shell.progress).toBe(1); expect(shell.x).toBe(h.x + (shot - 1) * 66);
      expect(eventVolumes(a, h).some(v => v.x + v.w / 2 === shell.x)).toBe(true);
    }
  });
  it("electrical residue is shallow, escapable and cannot repeatedly stun", () => {
    for (const id of ["cairo", "anteiku"] as const) {
      const m = fight(id), h = createArenaEvent(m.arena); m.arena.hazard = h;
      h.age = impactAt(m.arena, h) + eventTiming(m.arena, h).impact; h.stage = "aftermath";
      const actor = m.fighters[1]; actor.x = h.x; actor.y = 520;
      applyEventContacts(m, h); expect(actor.health).toBe(1000);
      actor.y = 580;
      for (let n = 0; n < 400; n++) applyEventContacts(m, h);
      expect(actor.health).toBe(997); expect(actor.stun).toBe(7);
    }
  });
  it("DIO freezes every environmental clock and resumes from the exact snapshot", () => {
    const m = fight("cairo"); forceArenaEvent(m.arena); const h = m.arena.hazard!;
    if (!isArenaEvent(h)) throw new Error("event");
    applyEventConsequence(m.arena, h); const before = JSON.stringify(m.arena);
    m.temporal.activate(0); for (let n = 0; n < 90; n++) stepArena(m, []);
    expect(JSON.stringify(m.arena)).toBe(before);
    m.temporal.finish();
    stepArena(m, []); expect(h.age).toBe(1); expect(m.arena.terrain[0].age).toBe(1);
  });
  it("intros, cinematics and hitstop do not consume warning or terrain duration", () => {
    const m = fight("cairo"); forceArenaEvent(m.arena); const h = m.arena.hazard!;
    if (!isArenaEvent(h)) throw new Error("event"); applyEventConsequence(m.arena, h);
    m.phase = "intro"; stepArena(m, []); m.phase = "fight"; m.hitstop = 8; stepArena(m, []);
    m.hitstop = 0; m.pandemonium = {} as Match["pandemonium"]; stepArena(m, []);
    expect(h.age).toBe(0); expect(m.arena.terrain[0].age).toBe(0);
  });
  it("Undertown keeps its floor continuous and has no service platforms", () => {
    const m = fight("undertown");
    for (const x of [40,90,640,1190,1240]) { const f=m.fighters[0]; f.x=x; f.y=590; f.setState("air"); tick(m,1); expect(f.y).toBe(580); expect(f.health).toBeGreaterThan(0); }
    expect(arenaPlatforms(m.arena)).toEqual([]);
  });
  it("Clover forms a delayed platform and terrain expires without trapping actors", () => {
    const m = fight("clover"), h = createArenaEvent(m.arena); applyEventConsequence(m.arena, h);
    expect(arenaPlatforms(m.arena)).toHaveLength(2);
    for (let i = 0; i < 36; i++) stepArenaTerrain(m);
    expect(arenaPlatforms(m.arena)).toHaveLength(3);
    const platform = m.arena.terrain[0]; m.fighters[0].x = 640; m.fighters[0].y = platform.y; m.arena.supports[0] = platform.id;
    platform.life = platform.age + 1; stepArenaTerrain(m); tick(m, 60);
    expect(m.fighters[0].y).toBe(580); expect(m.fighters[0].state).toBe("idle");
  });
  it("wood depression, damaged ring boundary and open roof are actual persistent consequences", () => {
    const dojo = fight("dojo"), timber = createArenaEvent(dojo.arena, "transformation"); applyEventConsequence(dojo.arena, timber);
    expect(mainFloorHeight(dojo.arena, timber.x)).toBe(604); expect(mainFloorHeight(dojo.arena, 640)).toBe(580);
    const ring = fight("budokai"); applyEventConsequence(ring.arena, createArenaEvent(ring.arena)); expect(ringBounds(ring.arena)).toEqual([150, 1212]);
    const hall = fight("uchiha"); applyEventConsequence(hall.arena, createArenaEvent(hall.arena, "transformation"));
    expect(hall.arena.terrain.some(t => t.kind === "roof" && !t.life)).toBe(true); expect(hall.arena.phase).toBe(3);
  });
  it("an attack breaks terrain only once per cast, while a fresh cast can finish it", () => {
    const m = fight("dojo"), h = createArenaEvent(m.arena); applyEventConsequence(m.arena, h);
    const beam = m.arena.terrain[0], f = m.fighters[0]; beam.health = 130;
    f.x = beam.x - 20; f.y = 580; f.facing = 1;
    expect(f.attack("crouch_medium")).toBe(true); f.stateFrame = f.move!.startup + 1;
    stepArenaTerrain(m); const remaining = beam.health;
    expect(remaining).toBeLessThan(130); expect(remaining).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) stepArenaTerrain(m);
    expect(beam.health).toBe(remaining);
    f.setState("idle"); m.combatFrame += 50;
    expect(f.attack("crouch_medium")).toBe(true); f.stateFrame = f.move!.startup + 1;
    stepArenaTerrain(m); expect(m.arena.terrain).toHaveLength(0);
  });
});
