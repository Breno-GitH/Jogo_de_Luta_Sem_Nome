import { describe, it, expect } from "vitest";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  astaSwords,
  practiceSword,
  type AstaSword,
} from "../src/engine/asta-stances";
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
    const input = { ...neutral(), ...i },
      other = { ...neutral(), ...j };
    m.step([input, other]);
    hits.push(...m.hits);
    return [input, other] as [InputFrame, InputFrame];
  };
  return { m, a, b, hits, step };
}
function choice(s: AstaSword, side: number): Partial<InputFrame> {
  return s === "slayer"
    ? { direction: side as 1 | -1, pressed: ["light"] }
    : s === "slasher"
      ? { direction: -side as 1 | -1, pressed: ["light"] }
      : { down: true, pressed: [s === "dweller" ? "light" : "medium"] };
}
const routes = astaSwords.flatMap((initial) =>
  astaSwords.flatMap((first) =>
    astaSwords.map((second) => [initial, first, second] as const),
  ),
);
describe("Anti-Magic Relay: 64 manually chosen routes", () => {
  it.each(routes)(
    "%s → %s → %s uses real contacts, two manual choices and deterministic snapshots",
    (initial, first, second) => {
      for (const side of [1, -1] as const) {
        const p = arena(side);
        practiceSword(p.a, initial);
        p.a.attack("astaDualBreak");
        expect(p.a.asta!.relay!.initial).toBe(initial);
        let extensions = 0,
          finished = false,
          q: Match | undefined,
          maxCombo = 0;
        const events = new Set<string>();
        for (let t = 0; t < 240; t++) {
          const r = p.a.asta!.relay;
          if (r) {
            extensions = Math.max(extensions, r.extensions);
            finished ||= r.phase === "finish";
            r.contacts.forEach((x) => events.add(x));
          }
          const input =
            r?.confirmed &&
            r.phase !== "finish" &&
            r.extensions < 2 &&
            p.a.stateFrame >= r.windowFrom
              ? choice(r.extensions === 0 ? first : second, side)
              : {};
          const frames = p.step(input);
          if (q) {
            q.step(frames);
            expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
          }
          if (!q && p.a.asta!.relay?.extensions === 1)
            q = restore(snapshot(p.m));
          maxCombo = Math.max(maxCombo, p.b.combo);
          expect(p.m.capture).toBeFalsy();
          expect(p.m.cinematicActive).toBe(false);
        }
        expect(
          extensions,
          initial + "/" + first + "/" + second + "/" + side,
        ).toBe(2);
        expect(finished).toBe(true);
        expect(p.a.asta!.equipped).toBe(second);
        expect(p.a.asta!.relay).toBeUndefined();
        expect(p.a.asta!.pending).toBeUndefined();
        expect(p.a.state).toBe("idle");
        expect(p.a.attackShapes()).toHaveLength(0);
        expect(p.b.health).toBeGreaterThan(700);
        expect(p.b.health).toBeLessThan(1000);
        expect(maxCombo).toBeGreaterThanOrEqual(4);
        expect(maxCombo).toBeLessThanOrEqual(8);
        expect(events.size).toBe(p.hits.length);
      }
    },
  );
  it.each(astaSwords)(
    "%s whiff and guard never enter an interactive capture",
    (s) => {
      for (const guard of [false, true]) {
        const p = arena(1, guard ? 85 : 500);
        practiceSword(p.a, s);
        if (guard) {
          p.a.x = 1150;
          p.b.x = 1235;
        }
        p.a.attack("astaDualBreak");
        let ext = 0;
        for (let t = 0; t < 150; t++) {
          p.step(
            t === 10 ? choice("dweller", 1) : {},
            guard ? { direction: 1 } : {},
          );
          ext = Math.max(ext, p.a.asta!.relay?.extensions ?? 0);
        }
        expect(ext).toBe(0);
        expect(p.a.asta!.equipped).toBe(s);
        expect(p.m.capture).toBeFalsy();
        expect(p.a.asta!.relay).toBeUndefined();
        if (guard) expect(p.hits.every((h) => h.blocked)).toBe(true);
      }
    },
  );
  it.each(astaSwords)(
    "%s times out into a short finisher with the same sword",
    (s) => {
      const p = arena();
      practiceSword(p.a, s);
      p.a.attack("astaDualBreak");
      let ext = 0,
        finish = false;
      for (let t = 0; t < 180; t++) {
        const r = p.a.asta!.relay;
        if (r) {
          ext = Math.max(ext, r.extensions);
          finish ||= r.phase === "finish";
        }
        p.step();
      }
      expect(ext).toBe(0);
      expect(finish).toBe(true);
      expect(p.a.asta!.equipped).toBe(s);
      expect(p.a.asta!.relay).toBeUndefined();
      expect(p.b.state).not.toBe("grabbed");
    },
  );
  it("does not reuse held/consumed input, a late choice, or another special", () => {
    const p = arena();
    p.a.attack("astaDualBreak");
    let chosen = false,
      max = 0;
    for (let t = 0; t < 180; t++) {
      const r = p.a.asta!.relay;
      let input: Partial<InputFrame> = {};
      if (r?.confirmed && p.a.stateFrame >= r.windowFrom && !chosen) {
        input = choice("dweller", 1);
        chosen = true;
      }
      if (r) max = Math.max(max, r.extensions);
      p.step(input);
    }
    expect(max).toBe(1);
    expect(p.a.asta!.equipped).toBe("dweller");
    expect(p.a.attack("astaDualBreak")).toBe(true);
    expect(p.a.attack("astaBlackRush")).toBe(false);
  });
  it("ignores late continuation edges and consumes them without leaking a normal", () => {
    const p = arena();
    p.a.attack("astaDualBreak");
    for (let t = 0; t < 80 && p.a.asta!.relay?.phase !== "finish"; t++)
      p.step();
    expect(p.a.asta!.relay?.phase).toBe("finish");
    p.step(choice("slasher", 1));
    for (let t = 0; t < 100; t++) {
      p.step();
      if(p.a.state==="attack")expect(p.a.moveId).toBe("astaDualBreak");
    }
    expect(p.a.asta!.equipped).toBe("slayer");
    expect(p.a.moveId).toBe("");
    expect(p.a.state).toBe("idle");
  });
  it("interruptions retain only the last committed sword and release all Relay state", () => {
    for (const tick of [1, 3]) {
      const p = arena();
      p.a.attack("astaDualBreak");
      for (let t = 0; t < 50; t++) {
        const r = p.a.asta!.relay;
        if (r?.confirmed && p.a.stateFrame >= r.windowFrom) {
          p.step(choice("slasher", 1));
          break;
        }
        p.step();
      }
      for (let t = 0; t < tick; t++) p.step();
      p.a.setState("hitstun");
      expect(p.a.asta!.equipped).toBe(tick < 2 ? "slayer" : "slasher");
      expect(p.a.asta!.relay).toBeUndefined();
      expect(p.a.asta!.pending).toBeUndefined();
    }
  });
  it.each(["ben", "goku"] as const)(
    "works against %s at either corner without forced position or arena escape",
    (opponent) => {
      for (const side of [1, -1] as const) {
        const p = arena(side, 85, opponent);
        p.a.x = side === 1 ? 1150 : 130;
        p.b.x = side === 1 ? 1235 : 45;
        p.a.attack("astaDualBreak");
        let ext = 0;
        for (let t = 0; t < 200; t++) {
          const r = p.a.asta!.relay;
          ext = Math.max(ext, r?.extensions ?? 0);
          p.step(
            r?.confirmed && r.extensions < 2 && p.a.stateFrame >= r.windowFrom
              ? choice(r.extensions ? "destroyer" : "slasher", side)
              : {},
          );
          for (const f of p.m.fighters) {
            expect(f.x).toBeGreaterThanOrEqual(0);
            expect(f.x).toBeLessThanOrEqual(1280);
          }
          expect(p.m.capture).toBeFalsy();
        }
        expect(ext).toBe(2);
        expect(p.a.asta!.relay).toBeUndefined();
        expect(p.b.state).not.toBe("grabbed");
      }
    },
  );
  it("ends safely on legitimate KO and cannot reset combo limits", () => {
    const p = arena();
    p.b.health = 15;
    p.a.attack("astaDualBreak");
    for (let t = 0; t < 100; t++) p.step();
    expect(p.b.health).toBe(0);
    expect(p.a.asta!.relay).toBeUndefined();
    expect(p.m.capture).toBeFalsy();
    const q = arena();
    q.a.attack("astaDualBreak");
    for (let t = 0; t < 100 && q.a.asta!.relay; t++) q.step();
    if (q.b.combo) expect(q.a.attack("astaDualBreak")).toBe(false);
  });
});
