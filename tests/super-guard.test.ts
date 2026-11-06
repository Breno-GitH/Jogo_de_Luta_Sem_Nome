import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { Match } from "../src/engine/combat";
import { neutral, type InputFrame } from "../src/engine/types";
import { isSuperMove } from "../src/engine/moves";

const fighters = [
  ["samurai", "ultimate_start", 130],
  ["dio", "road_roller", 85],
  ["goku", "ssj1_fury", 240],
  ["luffy", "jet_gigant", 160],
  ["sasuke", "kirin_start", 57],
] as const;

describe.each(fighters)("%s Super guard rule", (name, id, near) => {
  const start = (gap: number) => {
    const m = new Match(characters[name], {}, name === "dio" ? characters.sasuke : characters.samurai);
    m.phase = "fight";
    const [a, b] = m.fighters;
    b.x = 1240;
    a.x = b.x - gap;
    a.meter = a.meterMaximum;
    if (a.stand) {
      a.stand.s.x = a.x - 30 * a.facing;
      a.stand.s.y = a.y - 18;
    }
    const step = (first?: Partial<InputFrame>, second?: Partial<InputFrame>) =>
      m.step([
        { ...neutral(), ...first },
        { ...neutral(), ...second },
      ]);
    return { m, a, b, step };
  };
  it.each([false, true])(
    "opens through valid held guard, crouching=%s, and resolves KO",
    (down) => {
      const { m, a, b, step } = start(near);
      b.health = 60;
      const guard = { direction: 1, down } as const;
      step({ pressed: ["ultimate"] }, guard);
      expect(a.moveId).toBe(id);
      expect(isSuperMove(a.move)).toBe(true);
      let confirmed = false,
        blocked = false;
      for (let i = 0; i < 760 && m.phase === "fight"; i++) {
        step(undefined, guard);
        confirmed ||= m.cinematicActive || m.capture?.kind === "ultimate";
        blocked ||= m.hits.some((hit) => hit.move === id && hit.blocked);
      }
      expect(confirmed).toBe(true);
      expect(blocked).toBe(false);
      expect(m.wins).toEqual([1, 0]);
      expect(b.health).toBe(0);
    },
  );
  it("cannot capture past its range and returns to ordinary combat", () => {
    const { m, a, b, step } = start(890);
    step({ pressed: ["ultimate"] }, { direction: 1 });
    for (let i = 0; i < 300; i++) {
      step(undefined, { direction: 1, down: i % 2 === 0 });
      expect(m.cinematicActive || !!m.capture).toBe(false);
    }
    expect(b.health).toBe(b.data.health);
    expect(a.meter).toBe(0);
    expect(a.state).toBe("idle");
  });

  it("cannot grab a fighter protected by the existing get-up invulnerability", () => {
    const { m, a, b, step } = start(near);
    step({ pressed: ["ultimate"] });
    const startup = a.move!.startup;
    for (let i = 0; i < startup - 1; i++) step();
    b.setState("getup");
    expect(b.invulnerable).toBe(true);
    for (let i = 0; i < 130; i++) {
      step();
      expect(m.cinematicActive || !!m.capture).toBe(false);
    }
    expect(b.health).toBe(b.data.health);
  });

  it("can be evaded with timed jumps and a retreat", () => {
    const { m, a, b, step } = start(near);
    b.x = 795;
    a.x = b.x - near;
    if (a.stand) a.stand.s.x = a.x - 30;
    step({ pressed: ["ultimate"] });
    const lead = Math.max(0, a.move!.startup - 15);
    for (let i = 0; i < lead; i++) step(undefined, { direction: 1 });
    step(undefined, { direction: 1, pressed: ["jump"] });
    for (let i = 0; i < 145; i++) {
      step(undefined, { direction: 1 });
      expect(m.cinematicActive || !!m.capture).toBe(false);
    }
    expect(b.health).toBe(b.data.health);
  });
});
