import { describe, expect, it } from "vitest";
import { Match, FLOOR, type CombatHit } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { arenaIds, arenaModes, arenaForCharacter, createArena, stepArena } from "../src/engine/arenas";
import { arenaLayouts, arenaPlatforms, descentTicks } from "../src/engine/arena-layouts";
import { hashState, restore, snapshot } from "../src/engine/state";
import { Rooms } from "../server/rooms";
import { neutral } from "../src/engine/types";
import { Bot } from "../src/engine/bot";

const hit = (serial: number): CombatHit => ({ serial, frame: serial, attacker: 0, victim: 1, move: "test", damage: 60, blocked: false, combo: 1 });
const fight = (arenaId: typeof arenaIds[number], arenaMode: "classico" | "interativo" | "caotico" = "interativo", character = characters.samurai) => {
  const m = new Match(character, { training: true, arenaId, arenaMode }, characters.goku);
  m.phase = "fight"; return m;
};
const step = (m: Match, ticks: number) => { for (let n = 0; n < ticks; n++) m.step([neutral(), neutral()]); };

describe("unified living arenas", () => {
  it("offers nine identities, four structures and one live ruleset with a legacy alias", () => {
    expect(arenaIds).toHaveLength(9);
    expect(new Set(Object.values(arenaForCharacter)).size).toBe(9);
    expect(arenaModes).toEqual(["classico", "interativo"]);
    expect(createArena("dojo", "caotico").mode).toBe("interativo");
    expect(new Set(Object.values(arenaLayouts).map(a => a.structure)).size).toBe(4);
  });
  it("keeps classic gameplay flat and decorative after repeated supers", () => {
    for (const id of arenaIds) {
      const m = fight(id, "classico");
      for (let n = 0; n < 12; n++) stepArena(m, [{ ...hit(n), damage: 160 }]);
      expect(m.arena.phase, id).toBe(0);
      expect(m.arena.hazard, id).toBeUndefined();
      expect(arenaPlatforms(m.arena), id).toHaveLength(0);
      expect(m.arena.reactionKind, id).toBe("super");
    }
  });
  it("unified interactions telegraph for a second, damage once, remain nonlethal and cool down", () => {
    for (const id of arenaIds.filter(id => !["budokai", "enies", "godvalley"].includes(id))) {
      const m = fight(id); m.fighters[1].health = 5;
      stepArena(m, [hit(1), hit(2)]);
      const h = m.arena.hazard!;
      expect(h?.phase, id).toBe("warning");
      expect(h.ticks, id).toBeGreaterThanOrEqual(60);
      for (let n = h.ticks; n > 1; n--) stepArena(m, []);
      expect(m.fighters[1].health, id).toBe(5);
      stepArena(m, []); stepArena(m, []);
      expect(m.fighters[1].health, id).toBe(1);
      for (let n = 0; n < 30; n++) stepArena(m, []);
      expect(m.fighters[1].health, id).toBe(1);
      expect(h.phase, id).toBe("cooldown");
      expect(h.ticks, id).toBeGreaterThan(390);
    }
  });
  it("does not resurrect a KO with nonlethal environmental damage", () => {
    const m = fight("undertown"); m.fighters[1].health = 0;
    m.arena.hazard = { kind: "surge", x: 880, phase: "active", ticks: 12, affected: [false, false] };
    stepArena(m, []); expect(m.fighters[1].health).toBe(0);
  });
  it("records a real impact during hitstop but waits to advance the warning", () => {
    const m = fight("cairo"); m.hitstop = 8;
    stepArena(m, [hit(1), hit(2)]);
    expect(m.arena.hazard?.phase).toBe("warning");
    const ticks = m.arena.hazard!.ticks;
    stepArena(m, []); expect(m.arena.hazard!.ticks).toBe(ticks);
    m.hitstop = 0; stepArena(m, []); expect(m.arena.hazard!.ticks).toBe(ticks - 1);
  });
  for (const id of ["enies", "godvalley"] as const) it(`${id} descends and resumes in a persistent lower area with identical two-client hashes`, () => {
    const m = fight(id); stepArena(m, [hit(1), hit(2)]);
    step(m, m.arena.hazard!.ticks + 1);
    expect(m.arena.transition).toBeDefined();
    const timer = m.timer, health = m.fighters.map(f => f.health);
    const mirrors = [restore(snapshot(m)), restore(snapshot(m))];
    for (let n = 0; n < descentTicks; n++) {
      step(m, 1);
      for (const mirror of mirrors) {
        step(mirror, 1);
        expect(hashState(snapshot(mirror)), `descent tick ${n}`).toBe(hashState(snapshot(m)));
      }
      if (n === 40) expect(m.fighters[1].y).toBeGreaterThan(FLOOR + 200);
    }
    expect(m.arena.level).toBe(1);
    expect(m.arena.transition).toBeUndefined();
    expect(m.timer).toBe(timer);
    expect(m.fighters.every(f => f.y === FLOOR && f.health >= 1)).toBe(true);
    expect(m.fighters[1].health).toBe(health[1] - 8);
    step(m, 12); m.step([{ ...neutral(), direction: 1 }, neutral()]);
    expect(m.fighters[0].state).toBe("walk");
    expect(m.arena.level).toBe(1);
    expect(Math.abs(m.fighters[0].x - m.fighters[1].x)).toBeGreaterThan(100);
    stepArena(m, [hit(3), hit(4)]);
    expect(m.arena.hazard?.kind).not.toBe("fall");
  });
  it("allows evading collapse, then entering the broken section later", () => {
    const m = fight("enies");
    m.arena.hazard = { kind: "fall", x: 640, phase: "warning", ticks: 1, affected: [false, false] };
    step(m, 36);
    expect(m.arena.level).toBe(0); expect(m.arena.collapsed).toContain(640);
    m.fighters[0].x = 640; step(m, 1); expect(m.arena.transition).toBeDefined();
  });
  it("suspends hazards during intros, time stop and cinematics", () => {
    const m = fight("enies"); stepArena(m, [hit(1), hit(2)]);
    const ticks = m.arena.hazard!.ticks;
    m.phase = "intro"; stepArena(m, []); expect(m.arena.hazard!.ticks).toBe(ticks);
    m.phase = "fight"; m.pandemonium = {} as Match["pandemonium"];
    stepArena(m, [{ ...hit(3), damage: 150 }]);
    expect(m.arena.reactionKind).toBe("super"); expect(m.arena.hazard!.ticks).toBe(ticks);
    m.pandemonium = undefined; m.temporal.activate(0); stepArena(m, []);
    expect(m.arena.hazard!.ticks).toBe(ticks);
  });
  it("retains tournament ring-out and correct round end", () => {
    const m = fight("budokai"); m.fighters[1].x = 65; m.fighters[1].stun = 30;
    m.hits = [hit(1)]; step(m, 28);
    expect(m.arena.ringOutSeat).toBe(1); expect(m.message).toBe("FORA DO RINGUE");
    expect(m.phase).toBe("roundEnd");
  });
  it("lets only the host select rules and clears readiness", () => {
    const rooms = new Rooms(() => {}), code = rooms.create("host").room.code; rooms.join("guest", code);
    expect(() => rooms.selectArena("guest", "cairo", "interativo")).toThrow();
    rooms.selectArena("host", "godvalley", "caotico");
    expect(rooms.rooms.get(code)!.arenaMode).toBe("interativo");
    expect(rooms.rooms.get(code)!.players.every(p => !p?.ready)).toBe(true);
  });
});

describe("one-way platforms in existing fighter physics", () => {
  it("requires three round wins on the two open maps, while classic and other arenas retain two", () => {
    for (const id of ["clover", "undertown"] as const) {
      const m = fight(id); m.rules.training = false;
      expect(m.roundsToWin).toBe(3); expect(fight(id, "classico").roundsToWin).toBe(2);
      for (let won = 1; won <= 3; won++) {
        m.phase = "fight";
        const loser = m.fighters[1]; loser.x = 1190; loser.y = 940; loser.setState("air");
        step(m, 25); expect(m.wins).toEqual([won, 0]);
        step(m, 150);
        expect(m.phase).toBe(won < 3 ? "intro" : "finished");
      }
    }
    for (const id of arenaIds.filter(id => !["clover", "undertown"].includes(id))) expect(fight(id).roundsToWin).toBe(2);
  });
  it("limits open-sided layouts to two arenas and awards a round for a fall regardless of HP", () => {
    expect(Object.values(arenaLayouts).filter(a => a.structure === "platform")).toHaveLength(2);
    for (const id of ["clover", "undertown"] as const) {
      const m = fight(id), f = m.fighters[0];
      f.x = 90; f.y = FLOOR; f.setState("air");
      step(m, 30); expect(f.y).toBeGreaterThan(FLOOR + 100);
      step(m, 70);
      expect(f.x).toBeLessThan(150); expect(f.y).toBeGreaterThan(920);
      expect(f.health).toBe(0); expect(m.phase).toBe("roundEnd");
      expect(m.arena.ringOutSeat).toBe(0); expect(m.wins).toEqual([0, 1]);
      expect(m.message).toBe("QUEDA · K.O.");
      expect(m.arena.falling[0]).toBeNull();
    }
  });
  it("keeps BOT movement aimed toward the island instead of chasing into the void", () => {
    const m = fight("undertown"), bot = new Bot("normal");
    m.fighters[1].x = 1060; m.fighters[1].setState("idle");
    expect(bot.sample(m).direction).toBe(-1);
  });
  it("eliminates either seat at either ledge once, then restores both fighters next round", () => {
    for (const id of ["clover", "undertown"] as const) for (const seat of [0, 1] as const) for (const x of [90, 1190]) {
      const m = fight(id), f = m.fighters[seat];
      m.rules.training = false;
      f.x = x; f.y = 940; f.health = seat ? 7 : 1000; f.setState("air");
      step(m, 25);
      expect(f.health).toBe(0); expect(m.wins[1 - seat]).toBe(1);
      expect(m.phase).toBe("roundEnd"); expect(f.y).toBeGreaterThan(920);
      step(m, 20); expect(m.wins[1 - seat]).toBe(1);
      step(m, 150);
      expect(m.phase).toBe("intro"); expect(m.arena.ringOutSeat).toBeUndefined();
      expect(m.fighters.every(actor => actor.health > 0 && actor.y === FLOOR)).toBe(true);
    }
  });
  it("resolves simultaneous falls as a draw without awarding two wins", () => {
    const m = fight("clover");
    for (const f of m.fighters) { f.x = f.id ? 1190 : 90; f.y = 940; f.setState("air"); }
    step(m, 25);
    expect(m.fighters.map(f => f.health)).toEqual([0, 0]);
    expect(m.message).toBe("EMPATE"); expect(m.wins).toEqual([0, 0]);
  });
  for (const id of ["undertown", "clover"] as const) for (const character of Object.values(characters))
    it(`${character.id} lands, attacks, drops through and walks off ${id}`, () => {
      const m = fight(id, "interativo", character), f = m.fighters[0], p = arenaPlatforms(m.arena)[0];
      f.x = p.x + p.width / 2; f.y = p.y - 8; f.vy = 8; f.setState("air"); step(m, 1);
      expect(f.y).toBe(p.y); expect(f.airborne).toBe(false); step(m, 12);
      m.step([{ ...neutral(), pressed: ["light"] }, neutral()]); expect(f.state).toBe("attack");
      step(m, 85); m.step([{ ...neutral(), down: true, pressed: ["jump"] }, neutral()]);
      expect(f.airborne).toBe(true); step(m, 60); expect(f.y).toBe(FLOOR);
      f.x = p.x + p.width - 1; f.y = p.y; f.vx = 8; f.setState("walk"); m.arena.supports[0] = p.id;
      for (let n = 0; n < 30; n++) m.step([{ ...neutral(), direction: 1 }, neutral()]);
      expect(f.y).toBeGreaterThan(p.y); expect(f.airborne || f.y === FLOOR).toBe(true);
    });
  it("does not catch a rising actor and replays platform motion identically", () => {
    const m = fight("undertown"), f = m.fighters[0]; f.x = 290; f.y = 465; f.vy = -8; f.setState("air");
    const mirror = restore(snapshot(m));
    for (let n = 0; n < 90; n++) {
      step(m, 1); step(mirror, 1); expect(hashState(snapshot(mirror))).toBe(hashState(snapshot(m)));
      if (n === 0) expect(f.y).toBeLessThan(460);
    }
    expect(f.groundY).toBe(460);
  });
});
