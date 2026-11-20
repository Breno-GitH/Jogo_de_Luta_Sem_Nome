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
  astaRuntimeMove,
} from "../src/engine/asta-specials";
import {
  stepAstaAntimagic,
  neutralizableEnergy,
} from "../src/engine/asta-antimagic";
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
describe("Asta 2.1 real nine-special combat", () => {
  it.each(astaSpecialIds)(
    "%s respects relative input and retained swords from every initial weapon",
    (id) => {
      for (const side of [1, -1] as const)
        for (const sword of astaSwords) {
          const p = arena(side, 450),
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
          expect(p.a.moveId, id + "/" + sword).toBe(id);
          for (let t = 0; t < 190; t++) p.step();
          expect(p.a.asta!.equipped).toBe(
            id === "astaDualBreak" ? sword : s.stages[0].sword,
          );
          expect(p.a.asta!.pending).toBeUndefined();
          expect(p.a.asta!.relay).toBeUndefined();
          expect(p.a.attackShapes()).toHaveLength(0);
        }
    },
  );
  it.each(astaSpecialIds)(
    "%s contacts and blocks only on its authored strike windows",
    (id) => {
      for (const side of [1, -1] as const)
        for (const guard of [false, true]) {
          const p = arena(side);
          if (guard) {
            p.a.x = side === 1 ? 1150 : 130;
            p.b.x = side === 1 ? 1235 : 45;
          }
          p.a.attack(id);
          for (let t = 0; t < 190; t++)
            p.step({}, guard ? { direction: side } : {});
          const primary = p.hits.filter((h) => h.move === id);
          const expected =
            id === "astaIaiSlash"
              ? 2
              : id === "astaFlashSteps"
                ? 4
                : id === "astaSeveringLine"
                  ? 6
                  : id === "astaDualBreak" && !guard
                    ? 2
                    : 1;
          expect(primary.length, id + "/" + side + "/" + guard).toBe(expected);
          expect(primary.every((h) => h.blocked === guard)).toBe(true);
          expect(p.a.attackShapes()).toHaveLength(0);
          expect(p.m.capture).toBeFalsy();
        }
    },
  );
  it.each(astaSpecialIds)(
    "%s has body-specific finite timing and deterministic replay",
    (id) => {
      const p = arena();
      p.a.attack(id);
      const m = p.a.move!;
      expect(
        astaCells(id, p.a.asta?.relay).reduce((n, c) => n + c.ticks, 0),
      ).toBe(m.startup + m.active + m.recovery);
      for (let t = 0; t < 6; t++) p.step();
      const q = restore(snapshot(p.m));
      for (let t = 0; t < 180; t++) {
        p.step();
        q.step([neutral(), neutral()]);
        expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
      }
    },
  );
  it("all three Slayer actions advance, K/L hop physically, and only K offers bounded aerial conversion", () => {
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
      if (id !== "astaBlackRush") expect(high).toBeLessThan(FLOOR - 15);
      expect(p.a.y).toBe(FLOOR);
      expect(p.a.invulnerable).toBe(false);
    }
  });
  it("Divider's full extension and physical collision use the same reach above the ground", () => {
    const m = astaSpecialMoves.astaBlackDivider;
    for (let t = m.startup; t < m.startup + m.active; t++) {
      const b = astaSpecialBlade("astaBlackDivider", t);
      expect(b.b.y).toBeLessThanOrEqual(0);
      expect(astaReach("astaBlackDivider", t)).toBe(210);
    }
  });
  it("Pursuit requires a second fresh J, advances, preserves Dweller and cannot repeat", () => {
    const p = arena(1, 220);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 80 && !p.hits.length; t++) p.step();
    expect(p.hits.map((h) => h.move)).toEqual(["astaBlackSlash"]);
    const x = p.a.x;
    p.step({ pressed: ["light"] });
    for (let t = 0; t < 8 && p.a.moveId !== "astaBlackSlashPursuit"; t++)
      p.step();
    expect(p.a.moveId).toBe("astaBlackSlashPursuit");
    for (let t = 0; t < 80; t++) p.step();
    expect(p.a.x).toBeGreaterThan(x + 60);
    expect(p.a.asta!.equipped).toBe("dweller");
    expect(p.hits.map((h) => h.move)).toEqual([
      "astaBlackSlash",
      "astaBlackSlashPursuit",
    ]);
    expect(p.a.attack("astaBlackSlashPursuit")).toBe(false);
    const q = arena(1, 220);
    q.a.attack("astaBlackSlash");
    for (let t = 0; t < 100; t++) q.step();
    expect(q.hits.map((h) => h.move)).toEqual(["astaBlackSlash"]);
  });
  it("buffers the fresh Pursuit edge through hitstop after a real double-down command", () => {
    const p = arena(1, 220);
    p.step({ down: true });
    p.step();
    p.step({ down: true, pressed: ["light"] });
    p.step();
    expect(p.a.moveId).toBe("astaBlackSlash");
    for (let t = 0; t < 80 && !p.hits.length; t++) p.step();
    expect(p.m.hitstop).toBeGreaterThan(0);
    p.step({ pressed: ["light"] });
    for (let t = 0; t < 15 && p.a.moveId !== "astaBlackSlashPursuit"; t++)
      p.step();
    expect(p.a.moveId).toBe("astaBlackSlashPursuit");
  });
  it("keeps only one finite Black Slash and never loops the same root during a combo", () => {
    const p = arena(1, 450);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 9; t++) p.step();
    expect(p.m.kiProjectiles).toHaveLength(1);
    p.a.setState("idle");
    expect(p.a.attack("astaBlackSlash")).toBe(false);
    for (let t = 0; t < 90; t++) p.step();
    expect(p.m.kiProjectiles).toHaveLength(0);
    expect(p.a.attack("astaBlackSlash")).toBe(true);
    const q = arena();
    q.a.attack("astaIaiSlash");
    for (let t = 0; t < 40 && !q.a.canCancel("special"); t++) q.step();
    expect(q.a.attack("astaIaiSlash")).toBe(false);
    expect(q.a.attack("astaBlackRush")).toBe(true);
  });
  it("Causality Rush is a physical response, not universal armor or a free counter", () => {
    const p = arena();
    p.a.attack("astaCausalityBreak");
    p.b.attack("stand_heavy");
    for (let t = 0; t < 80; t++) p.step();
    expect(p.b.health).toBeLessThan(1000);
    expect(p.a.asta!.neutralized).toBe(0);
    expect(p.a.invulnerable).toBe(false);
    const q = arena();
    q.a.attack("astaCausalityBreak");
    q.b.attack("stand_light");
    for (let t = 0; t < 50; t++) q.step();
    expect(q.a.health).toBeLessThan(1000);
  });
  it("neutralizes exactly one eligible energy and dissipates beams at the sword contact", () => {
    for (const beam of [false, true]) {
      const p = arena(1, 350, "goku");
      p.a.attack("astaCausalityBreak");
      p.a.stateFrame = 4;
      const blade = astaSpecialBlade("astaCausalityBreak", 4),
        x = p.a.x + blade.a.x,
        y = p.a.y + blade.a.y;
      if (beam)
        p.m.beams.push({
          id: 1,
          owner: 1,
          move: "kamehameha_light",
          cast: 1,
          facing: -1,
          x: x + 250,
          y,
          length: 260,
          radius: 18,
          age: 0,
          life: 40,
          state: "active",
          hitIds: [],
          impactAge: 0,
        });
      else
        for (const id of [1, 2])
          p.m.kiProjectiles.push({
            id,
            owner: 1,
            move: "ki_light",
            cast: 1,
            x,
            y,
            previousX: x,
            previousY: y,
            vx: -8,
            vy: 0,
            facing: -1,
            radius: 12,
            age: 0,
            life: 40,
            state: "flight",
            impactAge: 0,
          });
      stepAstaAntimagic(p.m);
      stepAstaAntimagic(p.m);
      expect(p.a.asta!.neutralized).toBe(1);
      if (beam) expect(p.m.beams[0].state).toBe("dissipate");
      else
        expect(
          p.m.kiProjectiles.filter((p) => p.state === "impact"),
        ).toHaveLength(1);
      expect(p.m.events).toHaveLength(1);
      expect(Math.abs(p.m.events[0].x - p.a.x)).toBeLessThan(90);
      expect(astaRuntimeMove(p.a, "astaCausalityBreak").damage).toBe(80);
    }
  });
  it("never neutralizes physical steel, Haki, anti-magic, dragons or Supers", () => {
    for (const [c, move] of [
      ["dio", "knives"],
      ["xebec", "xebecRift"],
      ["asta", "astaBlackSlash"],
      ["goku", "ultimate_start"],
      ["sasuke", "goryuka"],
    ] as const)
      expect(neutralizableEnergy(arena(1, 350, c).b, { move } as never)).toBe(
        false,
      );
    for (const [c, move] of [
      ["goku", "ki_light"],
      ["goku", "kamehameha_light"],
      ["sasuke", "gokakyu"],
      ["sasuke", "hosenka"],
    ] as const)
      expect(neutralizableEnergy(arena(1, 350, c).b, { move } as never)).toBe(
        true,
      );
  });
  it("preserves air normals after a down-forward pursuit and does not spend Super", () => {
    const p = arena();
    p.a.attack("crouch_heavy");
    for (let t = 0; t < 40 && !p.a.canCancel("jump"); t++)
      p.step({ down: true });
    p.step({ direction: 1, pressed: ["jump"] });
    for (let t = 0; t < 8 && !p.a.airborne; t++) p.step({ direction: 1 });
    p.step({ pressed: ["light"] });
    expect(p.a.moveId).toBe("air_light");
    const q = arena();
    q.a.meter = 100;
    q.a.attack("astaBlackDivider");
    expect(q.a.meter).toBe(100);
  });
});
