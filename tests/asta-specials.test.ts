import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { astaSwords, practiceSword } from "../src/engine/asta-stances";
import {
  astaSpecialIds,
  astaSpecialMoves,
  astaTechniques,
  astaCells,
  astaSpecialBlade,
  astaReach,
} from "../src/engine/asta-specials";
import { snapshot, restore, hashState } from "../src/engine/state";
function arena(
  side: 1 | -1 = 1,
  gap = 85,
  opponent: keyof typeof characters = "samurai",
) {
  const m = new Match(
    characters.asta,
    { training: true },
    characters[opponent],
  );
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  a.facing = side;
  b.facing = -side;
  const hits: typeof m.hits = [];
  const step = (i: Partial<InputFrame> = {}, j: Partial<InputFrame> = {}) => {
    m.step([
      { ...neutral(), ...i },
      { ...neutral(), ...j },
    ]);
    hits.push(...m.hits);
  };
  return { m, a, b, hits, step };
}
describe("Asta 2.2 shared integration and preserved six specials", () => {
  it.each(astaSpecialIds)(
    "%s respects relative input and retained equipment from all four swords",
    (id) => {
      for (const side of [1, -1] as const)
        for (const sword of astaSwords) {
          const p = arena(side, 500),
            s = astaTechniques[id];
          practiceSword(p.a, sword);
          p.step({ down: true });
          p.step(
            s.family === 2
              ? {}
              : { direction: (s.family === 0 ? side : -side) as 1 | -1 },
          );
          p.step(
            s.family === 2
              ? { down: true, pressed: [s.button] }
              : {
                  direction: (s.family === 0 ? side : -side) as 1 | -1,
                  pressed: [s.button],
                },
          );
          expect(p.a.moveId).toBe(id);
          for (let t = 0; t < 180; t++) p.step();
          expect(p.a.asta!.equipped).toBe(
            id === "astaDualBreak" ? sword : s.stages[0].sword,
          );
          expect(p.a.asta!.pending).toBeUndefined();
          expect(p.a.attackShapes()).toHaveLength(0);
        }
    },
  );
  it.each(astaSpecialIds)(
    "%s has finite body timing and replayable state",
    (id) => {
      const p = arena();
      p.a.attack(id);
      const m = p.a.move!;
      expect(
        astaCells(id, p.a.asta?.relay).reduce((n, c) => n + c.ticks, 0),
      ).toBe(m.startup + m.active + m.recovery);
      for (let t = 0; t < 6; t++) p.step();
      const q = restore(snapshot(p.m));
      for (let t = 0; t < 140; t++) {
        p.step();
        q.step([neutral(), neutral()]);
        expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
      }
    },
  );
  it.each(astaSpecialIds.slice(0, 6))(
    "%s preserves its approved contact count, guard behavior and collision",
    (id) => {
      for (const side of [1, -1] as const)
        for (const guard of [false, true]) {
          const p = arena(side);
          if (guard) {
            p.a.x = side === 1 ? 1150 : 130;
            p.b.x = side === 1 ? 1235 : 45;
          }
          p.a.attack(id);
          for (let t = 0; t < 140; t++)
            p.step({}, guard ? { direction: side } : {});
          expect(p.hits).toHaveLength(
            id === "astaIaiSlash"
              ? 2
              : id === "astaFlashSteps"
                ? 4
                : id === "astaSeveringLine"
                  ? 6
                  : 1,
          );
          expect(p.hits.every((h) => h.blocked === guard)).toBe(true);
          expect(p.a.invulnerable).toBe(false);
        }
    },
  );
  it("keeps Slayer advances and physical hops and matches Divider reach", () => {
    for (const id of [
      "astaBlackRush",
      "astaRisingDemon",
      "astaBlackDivider",
    ] as const) {
      const p = arena(1, 450),
        x = p.a.x;
      let high = FLOOR;
      p.a.attack(id);
      for (let t = 0; t < 100; t++) {
        p.step();
        high = Math.min(high, p.a.y);
      }
      expect(p.a.x).toBeGreaterThan(x + 45);
      if (id === "astaBlackRush") expect(high).toBe(FLOOR);
      else expect(high).toBeLessThan(FLOOR - 15);
      expect(p.a.y).toBe(FLOOR);
    }
    const m = astaSpecialMoves.astaBlackDivider;
    for (let t = m.startup; t < m.startup + m.active; t++) {
      expect(astaSpecialBlade("astaBlackDivider", t).b.y).toBeLessThanOrEqual(
        0,
      );
      expect(astaReach("astaBlackDivider", t)).toBe(210);
    }
  });
  it("Black Slash prepares a three-cut long-range volley without pursuit", () => {
    for (const side of [1, -1] as const) {
      const p = arena(side, 800),
        x = p.a.x;
      p.a.attack("astaBlackSlash");
      for (let t = 0; t < 28; t++) {
        p.step();
        expect(p.m.kiProjectiles).toHaveLength(0);
      }
      p.step();
      expect(p.m.kiProjectiles).toHaveLength(1);
      expect(Math.abs(p.m.kiProjectiles[0].vx)).toBe(18);
      expect(p.m.kiProjectiles[0].life).toBeGreaterThan(60);
      p.step({ pressed: ["light"] });
      for (let t = 0; t < 110; t++) p.step();
      expect(p.a.x).toBe(x);
      expect(p.hits).toHaveLength(3);
      expect(
        p.hits.reduce((total, h) => total + h.damage, 0),
      ).toBeLessThanOrEqual(90);
      expect(p.hits.every((h) => h.damage > 0 && h.damage <= 30)).toBe(true);
      expect(p.a.asta!.blackSlashShots).toBe(3);
      expect(p.a.asta!.equipped).toBe("dweller");
      expect(p.m.kiProjectiles).toHaveLength(0);
      expect(p.a.moveId).not.toBe("astaBlackSlashPursuit");
    }
  });
  it("Black Slash is physically vulnerable and interruption before release creates no projectile", () => {
    const p = arena();
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 8; t++) p.step();
    p.b.attack("stand_light");
    for (let t = 0; t < 90; t++) p.step();
    expect(p.a.health).toBeLessThan(1000);
    expect(p.b.health).toBe(1000);
    expect(p.m.kiProjectiles).toHaveLength(0);
    expect(p.a.asta!.equipped).toBe("dweller");
  });
  it("Black Slash can be guarded or jumped and cannot be spammed", () => {
    const p = arena(1, 450);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 130; t++) p.step({}, { direction: 1 });
    expect(p.hits).toHaveLength(3);
    expect(p.hits.every((h) => h.blocked)).toBe(true);
    expect(p.b.health).toBe(1000);
    expect(p.b.attack("stand_light")).toBe(true);
    const q = arena(1, 450);
    q.a.attack("astaBlackSlash");
    for (let t = 0; t < 29; t++) q.step();
    q.step({}, { pressed: ["jump"] });
    for (let t = 0; t < 22; t++) q.step();
    expect(q.hits).toHaveLength(0);
    for (let t = 0; t < 90; t++) q.step();
    expect(q.hits.length).toBeLessThan(3);
    const z = arena(1, 800);
    z.a.attack("astaBlackSlash");
    for (let t = 0; t < 52; t++) z.step();
    expect(z.a.attack("astaBlackSlash")).toBe(false);
    for (let t = 0; t < 100; t++) z.step();
    expect(z.a.attack("astaBlackSlash")).toBe(true);
  });
  it("emits each of three cuts once and replays a snapshot taken between releases", () => {
    const p = arena(1, 950);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 44; t++) p.step();
    expect(p.a.asta!.blackSlashShots).toBe(2);
    const q = restore(snapshot(p.m));
    for (let t = 0; t < 140; t++) {
      p.step();
      q.step([neutral(), neutral()]);
      expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
    }
    expect(p.a.asta!.blackSlashShots).toBe(3);
    expect(p.hits).toHaveLength(3);
    expect(p.m.kiProjectiles).toHaveLength(0);
  });
  it("cancels the remaining volley releases when interrupted after the first emission", () => {
    const p = arena(1, 900);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 32; t++) p.step();
    expect(p.a.asta!.blackSlashShots).toBe(1);
    p.a.setState("hitstun");
    p.a.stun = 18;
    for (let t = 0; t < 120; t++) p.step();
    expect(p.a.asta!.blackSlashShots).toBe(1);
    expect(p.hits.length).toBeLessThanOrEqual(1);
    expect(p.m.kiProjectiles).toHaveLength(0);
  });
  it("never invents a grimoire exchange when already using the required sword", () => {
    for (const id of astaSpecialIds.slice(0, 8)) {
      const p = arena(),
        spec = astaTechniques[id];
      practiceSword(p.a, spec.stages[0].sword);
      p.a.attack(id);
      expect(p.a.asta!.draw).toBeUndefined();
    }
    for (const id of astaSpecialIds.slice(0, 8)) {
      const p = arena(),
        spec = astaTechniques[id];
      practiceSword(
        p.a,
        spec.stages[0].sword === "slayer" ? "destroyer" : "slayer",
      );
      p.a.attack(id);
      const d = p.a.asta!.draw!;
      expect(d.to).toBe(spec.stages[0].sword);
      expect(d.commitAt).toBe(spec.stages[0].at);
      expect(d.handAt).toBeLessThanOrEqual(p.a.move!.startup);
    }
  });
});
