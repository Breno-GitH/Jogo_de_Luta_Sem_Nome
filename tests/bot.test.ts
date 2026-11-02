import { describe, it, expect } from "vitest";
import { Bot, type Difficulty } from "../src/engine/bot";
import { Match } from "../src/engine/combat";
import { neutral } from "../src/engine/types";

describe("delayed perception and believable decisions", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    it(`${difficulty} cannot see a pose change before its reaction latency`, () => {
      const m = new Match();
      m.phase = "fight";
      const bot = new Bot(difficulty);
      for (let tick = 0; tick < 50; tick++) {
        m.combatFrame = tick;
        bot.sample(m);
      }
      m.fighters[0].attack("stand_heavy");
      for (let tick = 50; tick < 50 + bot.profile.reaction; tick++) {
        m.combatFrame = tick;
        bot.sample(m);
        expect(bot.perceived?.state).not.toBe("attack");
      }
      m.combatFrame = 50 + bot.profile.reaction;
      bot.sample(m);
      expect(bot.perceived?.state).toBe("attack");
      expect(bot.perceived!.frame).toBeLessThanOrEqual(
        m.combatFrame - bot.profile.reaction,
      );
    });
  }
  it("never reads opponent input or command history", () => {
    const m = new Match();
    m.phase = "fight";
    const enemy = m.fighters[0];
    m.fighters[0] = new Proxy(enemy, {
      get(target, key, receiver) {
        if (key === "input" || key === "buffer")
          throw new Error("Forbidden input read");
        return Reflect.get(target, key, receiver);
      },
    });
    const bot = new Bot("hard");
    for (let tick = 0; tick < 120; tick++) {
      m.combatFrame = tick;
      expect(() => bot.sample(m)).not.toThrow();
    }
  });
  it("produces the same match for the same seeds and inputs", () => {
    function run() {
      const m = new Match();
      m.phase = "fight";
      const bot = new Bot("normal", 42);
      for (let i = 0; i < 500; i++)
        m.step([
          {
            ...neutral(),
            direction: i % 150 < 80 ? 1 : -1,
            pressed: i % 31 === 0 ? ["heavy"] : [],
          },
          bot.sample(m),
        ]);
      return JSON.stringify(m);
    }
    expect(run()).toBe(run());
  });
  it("difficulty profiles increase reaction, defense and combo consistency without perfect defense", () => {
    const easy = new Bot("easy").profile,
      normal = new Bot("normal").profile,
      hard = new Bot("hard").profile;
    expect(easy.reaction).toBeGreaterThan(normal.reaction);
    expect(normal.reaction).toBeGreaterThan(hard.reaction);
    expect(hard.reaction).toBeGreaterThanOrEqual(10);
    expect(hard.guard).toBeLessThan(1);
    expect(easy.combo).toBeLessThan(normal.combo);
    expect(normal.combo).toBeLessThan(hard.combo);
  });
  it("self-play uses real attacks, combos, throws, specials and meter without locks", () => {
    const moves = new Set<string>(),
      decisions = new Set<string>();
    let maxCombo = 0,
      ultimates = 0;
    for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
      const m = new Match(undefined, {
        training: true,
        infiniteHealth: [true, true],
      });
      m.phase = "fight";
      const left = new Bot(difficulty, 917, 0),
        right = new Bot(difficulty, 3417, 1);
      for (let tick = 0; tick < 9000; tick++) {
        const inputs = [left.sample(m), right.sample(m)] as const;
        m.step([inputs[0], inputs[1]]);
        for (const f of m.fighters) {
          if (f.moveId) moves.add(f.moveId);
          expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
          expect(f.health).toBe(1000);
        }
        decisions.add(left.lastDecision);
        decisions.add(right.lastDecision);
        for (const hit of m.hits) {
          maxCombo = Math.max(maxCombo, hit.combo);
          if (hit.move === "ultimate_start") ultimates++;
        }
      }
      expect(m.phase).toBe("fight");
    }
    expect([...moves].some((id) => id.endsWith("light"))).toBe(true);
    expect([...moves].some((id) => id.endsWith("medium"))).toBe(true);
    expect([...moves].some((id) => id.endsWith("heavy"))).toBe(true);
    expect(moves.has("throw")).toBe(true);
    expect([...moves].some((id) => id.startsWith("draw_"))).toBe(true);
    expect(ultimates).toBeGreaterThan(0);
    expect(maxCombo).toBeGreaterThanOrEqual(3);
    expect(decisions.has("aproximar")).toBe(true);
    expect([...decisions].some((value) => value.includes("defender"))).toBe(
      true,
    );
    expect(
      [...decisions].some(
        (value) => value.includes("recuar") || value.includes("variar"),
      ),
    ).toBe(true);
    expect(
      [...decisions].some((value) => value.includes("punir")),
      [...decisions].join(", "),
    ).toBe(true);
    expect(moves.has("air_medium"), [...moves].join(", ")).toBe(true);
  });
});
