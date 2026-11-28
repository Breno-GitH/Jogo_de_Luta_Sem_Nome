import { describe, expect, it } from "vitest";
import { Match, type CombatHit } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { arenaPlatforms, hasMainFloor, openStage } from "../src/engine/arena-layouts";
import { benEventOrder, benEventSpecs, beginBenLift, benLiftTicks, benVehicleX } from "../src/engine/ben-arena";
import { applyEventContacts, createArenaEvent, eventSpec, eventStage, eventTiming, eventVolumes, forceArenaEvent, impactAt, isArenaEvent } from "../src/engine/arena-events";
import { applyEventConsequence } from "../src/engine/arena-terrain";
import { neutral, type InputFrame } from "../src/engine/types";
import { hashState, restore, snapshot } from "../src/engine/state";
import { stepArena } from "../src/engine/arenas";
const fight = (classic = false) => { const m = new Match(characters.ben, { training: false, arenaId: "undertown", arenaMode: classic ? "classico" : "interativo" }, characters.asta); m.phase = "fight"; return m; };
const tick = (m: Match, n = 1) => { for (let i = 0; i < n; i++) m.step([neutral(), neutral()]); };
const hit = (serial: number, damage = 60): CombatHit => ({ serial, frame: serial, attacker: 0, victim: 1, move: "structural-test", damage, blocked: false, combo: 1 });
describe("Undertown and Mr Smoothy inside one match", () => {
  it("keeps Undertown traditional at both edges while preserving three wins and Clover's separate layout", () => {
    const m = fight(); expect(openStage(m.arena)).toBe(false); expect(arenaPlatforms(m.arena)).toEqual([]); expect(m.roundsToWin).toBe(3);
    for (const x of [40, 90, 1190, 1240]) { expect(hasMainFloor(m.arena, x)).toBe(true); const f = m.fighters[0]; f.x = x; f.y = 600; f.setState("air"); tick(m); expect(f.y).toBe(580); expect(f.health).toBe(1000); }
    const clover = new Match(characters.asta, { arenaId: "clover", arenaMode: "interativo" }); expect(openStage(clover.arena)).toBe(true); expect(arenaPlatforms(clover.arena)).toHaveLength(2); expect(clover.roundsToWin).toBe(3);
  });
  it("cycles four events per area, with fixed routes independent of fighter position", () => {
    const m = fight(); expect(Array.from({ length: 4 }, () => createArenaEvent(m.arena).kind)).toEqual(benEventOrder.market);
    m.arena.ben!.area = "smoothy"; expect(Array.from({ length: 4 }, () => createArenaEvent(m.arena).kind)).toEqual(benEventOrder.smoothy);
    const mirror = restore(snapshot(m)); m.fighters[0].x = 40; mirror.fighters[0].x = 1240;
    expect(createArenaEvent(m.arena)).toEqual(createArenaEvent(mirror.arena));
  });
  for (const area of ["market", "smoothy"] as const) for (const kind of benEventOrder[area]) {
    it(`${area}/${kind}: telegraphs, contacts once, creates its own consequence and synchronizes`, () => {
      const m = fight(); m.arena.ben!.area = area; forceArenaEvent(m.arena, "primary", kind);
      const h = m.arena.hazard!; if (!isArenaEvent(h)) throw Error("Expected authored event");
      expect(eventSpec(m.arena, h)).toBe(benEventSpecs[kind]); expect(eventTiming(m.arena, h).warning).toBeGreaterThanOrEqual(84);
      m.fighters[1].x = h.x; const health = m.fighters[1].health;
      h.age = ["cargo-cart", "delivery-cart"].includes(kind) ? benEventSpecs[kind].timing.preparation + benEventSpecs[kind].timing.warning - 1 : impactAt(m.arena, h) - 1;
      applyEventContacts(m, h); expect(m.fighters[1].health).toBe(health);
      h.age = impactAt(m.arena, h); h.stage = "impact"; applyEventConsequence(m.arena, h);
      for (let i = 0; i < 12; i++) applyEventContacts(m, h);
      expect(m.fighters[1].health).toBe(health - benEventSpecs[kind].damage);
      const mirror = restore(snapshot(m)); for (let i = 0; i < 90; i++) { tick(m); tick(mirror); expect(hashState(snapshot(mirror))).toBe(hashState(snapshot(m))); }
      if (kind === "smoothie-spill") expect(m.arena.terrain.some(t => t.kind === "slick")).toBe(true);
      if (kind === "patio-collapse") expect(m.arena.terrain.some(t => t.kind === "patio-wreck")).toBe(true);
    });
  }
  it("requires three nearby structural hits to expose access, then another strong hit to board", () => {
    const m = fight(); m.fighters[1].x = 450; m.hits = [hit(1)]; tick(m); expect(m.arena.ben!.supports).toBe(0);
    m.fighters[1].x = 1120;
    for (let n = 1; n <= 3; n++) { m.hits = [hit(n + 1)]; tick(m); expect(m.arena.ben!.supports).toBe(n); expect(m.arena.ben!.lift).toBeUndefined(); }
    expect(m.arena.ben!.exposed).toBe(true); m.hits = [hit(5)]; tick(m); expect(m.arena.ben!.lift).toBeDefined();
  });
  it("keeps HP, meters and forms through ascent; purges old projectiles and ignores queued attacks", () => {
    const m = fight(); m.fighters[0].omnitrix!.active = "echoEcho"; m.fighters[0].health = 700; m.fighters[1].health = 810; m.fighters[0].meter = 90;
    const before = m.fighters.map(f => ({ hp: f.health, meter: f.meter, active: f.omnitrix?.active, asta: f.asta?.equipped }));
    const timer = m.timer; expect(beginBenLift(m)).toBe(true);
    const mirror = restore(snapshot(m));
    for (let n = 0; n < benLiftTicks; n++) {
      const inputs: [InputFrame, InputFrame] = [{ ...neutral(), pressed: ["ultimate", "heavy"] }, neutral()];
      m.step(inputs); mirror.step(inputs);
      expect(hashState(snapshot(mirror))).toBe(hashState(snapshot(m)));
    }
    expect(m.arena.ben!.area).toBe("smoothy"); expect(m.arena.ben!.used).toBe(true); expect(m.timer).toBe(timer);
    expect(m.fighters.map(f => ({ hp: f.health, meter: f.meter, active: f.omnitrix?.active, asta: f.asta?.equipped }))).toEqual(before);
    expect(m.projectiles).toEqual([]); expect(m.beams).toEqual([]); expect(m.kiProjectiles).toEqual([]);
    expect(beginBenLift(m)).toBe(false); m.step([{ ...neutral(), direction: 1 }, neutral()]); expect(m.fighters[0].state).toBe("walk");
  });
  it("disables forced transitions in Classic and waits out hitstop and cinematics", () => {
    expect(beginBenLift(fight(true))).toBe(false);
    const m = fight(); m.hitstop = 5; expect(beginBenLift(m)).toBe(false); m.hitstop = 0; m.pandemonium = {} as Match["pandemonium"]; expect(beginBenLift(m)).toBe(false);
    m.pandemonium = undefined; expect(beginBenLift(m)).toBe(true); m.temporal.activate(0); const before = JSON.stringify(m.arena);
    for (let i = 0; i < 20; i++) stepArena(m, []); expect(JSON.stringify(m.arena)).toBe(before);
  });
  it("a smoothie spill changes traction gently and still accepts movement, crouch and jump", () => {
    const m = fight(), base = fight(); m.arena.ben!.area = "smoothy"; forceArenaEvent(m.arena, "primary", "smoothie-spill");
    const h = m.arena.hazard!; if (!isArenaEvent(h)) throw Error("event"); applyEventConsequence(m.arena, h);
    m.fighters[0].x = base.fighters[0].x = h.x;
    m.step([{ ...neutral(), direction: 1 }, neutral()]); base.step([{ ...neutral(), direction: 1 }, neutral()]);
    expect(m.fighters[0].vx).toBeGreaterThan(base.fighters[0].vx); expect(m.fighters[0].vx).toBeLessThan(base.fighters[0].vx * 1.15);
    tick(m); expect(Math.abs(m.fighters[0].vx)).toBeLessThanOrEqual(2);
    m.step([{ ...neutral(), pressed: ["jump"] }, neutral()]); tick(m, 10); expect(m.fighters[0].airborne).toBe(true);
  });
  it("a new round restores underground access and all area-specific objects", () => {
    const m = fight(); m.arena.ben!.area = "smoothy"; m.arena.ben!.used = true; m.fighters[1].health = 0; tick(m, 200);
    expect(m.arena.ben!.area).toBe("market"); expect(m.arena.ben!.used).toBe(false); expect(m.arena.terrain).toEqual([]);
  });
  it("returns through the maintenance access and preserves each area's destruction and resources", () => {
    const m = fight(); forceArenaEvent(m.arena, "primary", "alien-sign");
    const marketEvent = m.arena.hazard!; if (!isArenaEvent(marketEvent)) throw Error("event"); applyEventConsequence(m.arena, marketEvent);
    const marketTerrain = m.arena.terrain.map(t => t.id); expect(beginBenLift(m)).toBe(true); tick(m, benLiftTicks);
    expect(m.arena.ben!.area).toBe("smoothy"); forceArenaEvent(m.arena, "primary", "smoothy-sign");
    const plazaEvent = m.arena.hazard!; if (!isArenaEvent(plazaEvent)) throw Error("event"); applyEventConsequence(m.arena, plazaEvent); m.arena.hazard = undefined;
    const plazaTerrain = m.arena.terrain.map(t => t.id), resources = m.fighters.map(f => [f.health, f.meter]);
    tick(m, 180); m.fighters[0].x = 1140; m.fighters[1].x = 940;
    for (let n = 0; n < 38; n++) m.step([{ ...neutral(), down: true }, neutral()]);
    expect(m.arena.ben!.lift?.to).toBe("market"); tick(m, benLiftTicks);
    expect(m.arena.ben!.area).toBe("market"); expect(m.arena.terrain.map(t => t.id)).toEqual(marketTerrain);
    expect(m.fighters.map(f => [f.health, f.meter])).toEqual(resources);
    tick(m, 180); expect(beginBenLift(m)).toBe(true); tick(m, benLiftTicks);
    expect(m.arena.ben!.area).toBe("smoothy"); expect(m.arena.terrain.map(t => t.id)).toEqual(plazaTerrain);
  });
  it("the return access requires both fighters nearby and respects its cooldown", () => {
    const m = fight(); beginBenLift(m); tick(m, benLiftTicks);
    m.fighters[0].x = 1140; m.fighters[1].x = 940;
    for (let n = 0; n < 40; n++) m.step([{ ...neutral(), down: true }, neutral()]);
    expect(m.arena.ben!.lift).toBeUndefined(); m.arena.ben!.cooldown = 0; m.fighters[1].x = 300;
    for (let n = 0; n < 50; n++) m.step([{ ...neutral(), down: true }, neutral()]);
    expect(m.arena.ben!.lift).toBeUndefined(); expect(m.arena.ben!.accessHold).toBe(0);
    expect(benVehicleX(75, 440, 0)).toBeLessThan(-180); expect(benVehicleX(1205, 840, 0)).toBeGreaterThan(1460);
  });
  it("vehicle collision follows the full-size moving body after the warning and hits each actor only once", () => {
    const m = fight(); forceArenaEvent(m.arena, "primary", "cargo-cart"); const event = m.arena.hazard!;
    if (!isArenaEvent(event)) throw Error("event"); const timing = eventTiming(m.arena, event);
    event.age = timing.preparation + timing.warning - 1; expect(eventVolumes(m.arena, event)).toEqual([]);
    event.age++; const first = eventVolumes(m.arena, event)[0]; expect(first.w).toBeGreaterThan(300);
    event.age += Math.floor(timing.action / 2); const moving = eventVolumes(m.arena, event)[0]; expect(moving.x).toBeGreaterThan(first.x);
    m.fighters[0].x = moving.x + moving.w / 2; const hp = m.fighters[0].health;
    applyEventContacts(m, event); applyEventContacts(m, event);
    expect(m.fighters[0].health).toBe(hp - benEventSpecs["cargo-cart"].damage);
  });
});
