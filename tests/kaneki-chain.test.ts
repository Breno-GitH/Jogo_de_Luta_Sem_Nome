import { expect, it } from "vitest";
import { Bot } from "../src/engine/bot";
import { FLOOR, Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import {
  chainFinishes,
  chainPick,
  type ChainRoute,
} from "../src/engine/kaneki-chain";
import {
  canKaguneCapture,
  kanekiOffensiveKagunes,
} from "../src/engine/kaneki-combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type Button } from "../src/engine/types";

function fight(gap = 100, side = 1, actorX = 620) {
  const m = new Match(characters.kaneki, {}, characters.sasuke);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = actorX;
  b.x = actorX + side * gap;
  a.facing = side;
  b.facing = -side;
  const step = (pressed: Button[] = [], defender: Button[] = []) =>
    m.step([
      { ...neutral(), pressed },
      { ...neutral(), pressed: defender },
    ]);
  const until = (predicate: () => unknown, limit = 180) => {
    for (let i = 0; i < limit && !predicate(); i++) step();
    expect(predicate()).toBeTruthy();
  };
  const chain = () => m.capture?.kaneki?.chain;
  const open = () => {
    step(["throw"]);
    until(chain, 20);
  };
  const second = (button: Button) => {
    step([button]);
    until(() => chain()?.phase === "choice2" && !m.hitstop);
  };
  return { m, a, b, step, until, chain, open, second };
}

const routes = [
  ["medium", undefined, "throw"],
  ["light", "light", "embrace"],
  ["light", "medium", "pendulum"],
  ["light", "heavy", "centipede"],
  ["heavy", "light", "lasso"],
  ["heavy", "medium", "spin"],
  ["heavy", "heavy", "meteor"],
] as const;

for (const [first, second, route] of routes) {
  it.each([1, -1])(
    `${first} → ${route} stays deterministic (facing %s)`,
    (side) => {
      const { m, a, b, step, until, chain, open } = fight(95, side);
      open();
      step([first]);
      until(() => !m.capture || chain()?.phase === "choice2");
      if (second) expect(chain()?.phase).toBe("choice2");
      const replica = restore(snapshot(m));
      let height = 0,
        landedFirst = false,
        maxLimbs = 0;
      const timer = m.timer;
      let count = 0;
      for (let i = 0; i < 145 && m.capture; i++) {
        const press = i === 7 && second ? [second] : [];
        step(press);
        replica.step([{ ...neutral(), pressed: press }, neutral()]);
        expect(hashState(snapshot(replica))).toBe(hashState(snapshot(m)));
        height = Math.max(height, FLOOR - a.y);
        if (chain()?.finish) expect(chain()?.finish).toBe(route);
        for (const e of m.events)
          if (e.kind === "chainImpact" && e.life === e.total && m.hits.length) {
            count++;
            landedFirst = b.y === FLOOR && a.y < FLOOR;
          }
        if (m.capture)
          maxLimbs = Math.max(
            maxLimbs,
            kanekiOffensiveKagunes(a, FLOOR).length,
          );
        expect(a.y).toBeLessThanOrEqual(FLOOR);
        expect(b.y).toBeLessThanOrEqual(FLOOR);
      }
      expect(m.capture).toBeUndefined();
      expect(b.knockedDown).toBe(true);
      expect(canKaguneCapture(a, b, "ground")).toBe(false);
      if (second) {
        const config = chainFinishes[route as ChainRoute];
        expect(b.health).toBe(
          1000 -
            (first === "light" ? 27 : 54) -
            Math.round(config.damage * 0.925),
        );
        expect(count).toBe(1);
        expect(a.kanekiSpecialRecovery).toBe(config.recovery);
        expect(m.timer).toBe(timer);
        if (config.slam) {
          expect(height).toBeGreaterThan(250);
          expect(landedFirst).toBe(true);
          expect(maxLimbs).toBe(4);
        }
      } else expect(b.health).toBe(908);
    },
  );
}

it("falls back once without any choice, and again after a starter without a second choice", () => {
  const f = fight();
  f.open();
  f.until(() => !f.m.capture);
  expect(f.b.health).toBe(922);
  const g = fight();
  g.open();
  g.second("light");
  g.until(() => g.chain()?.finish === "release");
  g.until(() => !g.m.capture);
  expect(g.b.health).toBe(926);
});

it("ignores an early second press, accepts a distinct buffered edge, and rejects held repeats", () => {
  const h = fight();
  h.open();
  for (let i = 0; i < 100 && !h.chain()?.finish; i++) h.step(["light"]);
  expect(h.chain()?.finish).toBe("release");

  const g = fight();
  g.open();
  g.step(["light"]);
  g.until(
    () =>
      g.chain()?.phase === "action" &&
      g.m.capture!.tick - g.chain()!.since === 1,
  );
  g.step(["heavy"]); // Too early.
  g.until(() => g.m.capture!.tick - g.chain()!.since === 10);
  g.step(["medium"]); // Buffered in the last six ticks of the pull.
  g.until(() => g.chain()?.phase === "choice2");
  g.until(() => g.chain()?.finish === "pendulum");
});

it.each([true, false])(
  "one matching recent guess escapes (match %s)",
  (correct) => {
    const f = fight();
    f.open();
    f.second("light");
    for (let i = 0; i < 6; i++) f.step();
    f.step([], ["light", "medium", "heavy"]); // Chords are ignored.
    expect(f.chain()?.escape).toBeUndefined();
    f.step([], [correct ? "heavy" : "light"]);
    f.step([], ["heavy"]); // Cannot replace the first guess.
    f.step(["heavy"]);
    if (correct) {
      expect(f.m.capture).toBeUndefined();
      expect(f.b.health).toBe(973);
      expect(f.b.knockedDown).toBe(false);
      expect(f.m.events.some((e) => e.kind === "chainEscape")).toBe(true);
    } else expect(f.chain()?.finish).toBe("centipede");
  },
);

it("expires a correct but early escape guess", () => {
  const f = fight();
  f.open();
  f.second("heavy");
  f.step([], ["heavy"]);
  for (let i = 0; i < 12; i++) f.step();
  f.step(["heavy"]);
  expect(f.chain()?.finish).toBe("meteor");
});

it.each([
  ["light", 198],
  ["medium", 214],
  ["heavy", 246],
] as const)("Rush %s opens its compatible routes", (strength, gap) => {
  const f = fight(gap);
  f.m.step([{ ...neutral(), down: true }, neutral()]);
  f.step();
  f.m.step([{ ...neutral(), down: true, pressed: [strength] }, neutral()]);
  f.until(f.chain);
  expect(f.m.capture?.kaneki?.specialId).toBe("rinkakuRush_" + strength);
  f.step(["heavy"]);
  f.until(() => f.chain()?.phase === "finisher");
  expect(f.chain()?.finish).toBe({ light: "rushShortLift", medium: "rushAirSet", heavy: "rushSlam" }[strength]);
  f.until(() => !f.m.capture);
});

it("misses at long range, and interrupts a vulnerable grab startup", () => {
  const f = fight(390);
  f.step(["throw"]);
  for (let i = 0; i < 50; i++) {
    f.step();
    expect(f.chain()).toBeUndefined();
  }
  const g = fight(54);
  g.step(["throw"], ["light"]);
  g.until(() => g.a.state === "hitstun", 15);
  expect(g.chain()).toBeUndefined();
});

it("keeps the meteor in the corner and leaves KO to the release frame", () => {
  const f = fight(70, 1, 1165);
  f.b.health = 20;
  f.open();
  f.second("heavy");
  expect(f.b.health).toBe(1);
  for (let i = 0; i < 8; i++) f.step();
  f.step(["heavy"]);
  for (let i = 0; i < 100 && f.m.capture; i++) {
    f.step();
    expect(f.a.x).toBeLessThanOrEqual(1240);
    expect(f.b.x).toBeLessThanOrEqual(1240);
    if (f.m.capture) expect(f.m.phase).toBe("fight");
  }
  expect(f.b.health).toBe(0);
  expect(f.m.phase).toBe("roundEnd");
});

it.each(["easy", "hard"] as const)(
  "uses the %s bot chain policy",
  (difficulty) => {
    const f = fight(80, 1, 1145);
    f.open();
    const bot = new Bot(difficulty, 3417, 0);
    let finish: ChainRoute | undefined, first: string | undefined;
    for (let i = 0; i < 155 && f.m.capture; i++) {
      const input = bot.sample(f.m);
      if (!first) first = chainPick(input.pressed);
      f.m.step([input, neutral()]);
      finish ??= f.chain()?.finish;
    }
    expect(first).toBe(difficulty === "easy" ? "medium" : "light");
    expect(finish).toBe(difficulty === "easy" ? undefined : "centipede");
  },
);
