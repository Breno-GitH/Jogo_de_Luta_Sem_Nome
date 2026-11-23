import { describe, it, expect } from "vitest";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  astaSwords,
  practiceSword,
  type AstaSword,
} from "../src/engine/asta-stances";
import { relayOptions } from "../src/engine/asta-relay";
import { Bot } from "../src/engine/bot";
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
    const pair: [InputFrame, InputFrame] = [
      { ...neutral(), ...i },
      { ...neutral(), ...j },
    ];
    m.step(pair);
    hits.push(...m.hits);
    return pair;
  };
  return { m, a, b, hits, step };
}
const buttons = ["light", "medium", "heavy"] as const;
const routes = astaSwords.flatMap((initial) =>
  buttons.map((button, i) => ({
    initial,
    button,
    selected: relayOptions(initial)[i],
  })),
);
const branchHits: Record<AstaSword, number> = {
  slayer: 2,
  slasher: 4,
  dweller: 2,
  destroyer: 3,
};
describe("Relay 2.2: one dynamic J/K/L choice and twelve physical routes", () => {
  it.each(routes)(
    "$initial + $button → $selected connects its distinct finisher and restores deterministically",
    ({ initial, button, selected }) => {
      for (const side of [1, -1] as const) {
        const p = arena(side);
        practiceSword(p.a, initial);
        p.a.attack("astaDualBreak");
        let picked = false,
          branch = false,
          q: Match | undefined,
          maxAction = 0;
        const contacts = new Set<string>();
        const original = [...p.a.asta!.relay!.options];
        expect(original).toEqual(astaSwords.filter((x) => x !== initial));
        for (let t = 0; t < 190; t++) {
          const r = p.a.asta!.relay;
          if (r) {
            branch ||= r.phase === "branch";
            maxAction = Math.max(maxAction, r.action);
            r.contacts.forEach((c) => contacts.add(c));
            expect(r.options).toEqual(original);
          }
          const input =
            r?.phase === "choice" && !picked
              ? { direction: -side as 1 | -1, down: true, pressed: [button] }
              : {};
          if (r?.phase === "choice") picked = true;
          const frames = p.step(input);
          if (q) {
            q.step(frames);
            expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
          }
          if (!q && p.a.asta!.relay?.phase === "branch")
            q = restore(snapshot(p.m));
          expect(p.m.capture).toBeFalsy();
          expect(p.m.cinematicActive).toBe(false);
        }
        expect(picked).toBe(true);
        expect(branch).toBe(true);
        expect(maxAction).toBe(1);
        expect(p.hits.filter((x) => x.move === "astaDualBreak")).toHaveLength(
          (initial === "slasher" ? 2 : 1) + branchHits[selected],
        );
        expect(contacts.size).toBe(p.hits.length);
        expect(p.b.health).toBeGreaterThan(800);
        expect(p.b.health).toBeLessThan(930);
        expect(p.a.asta!.equipped).toBe(selected);
        expect(p.a.asta!.relay).toBeUndefined();
        expect(p.a.asta!.pending).toBeUndefined();
        expect(p.a.asta!.draw).toBeUndefined();
        expect(p.a.state).toBe("idle");
        expect(p.a.attackShapes()).toHaveLength(0);
      }
    },
  );
  it.each(astaSwords)(
    "%s keeps its sword on whiff, block and timeout without an automatic continuation",
    (initial) => {
      for (const mode of ["whiff", "guard", "timeout"] as const) {
        const p = arena(1, mode === "whiff" ? 500 : 85);
        practiceSword(p.a, initial);
        if (mode === "guard") {
          p.a.x = 1150;
          p.b.x = 1235;
        }
        p.a.attack("astaDualBreak");
        let branch = false;
        for (let t = 0; t < 130; t++) {
          branch ||= p.a.asta!.relay?.phase === "branch";
          p.step({}, mode === "guard" ? { direction: 1 } : {});
        }
        expect(branch).toBe(false);
        expect(p.a.asta!.equipped).toBe(initial);
        expect(p.a.asta!.relay).toBeUndefined();
        expect(p.a.state).toBe("idle");
        expect(p.hits.length).toBe(
          mode === "whiff" ? 0 : initial === "slasher" ? 2 : 1,
        );
        if (mode === "guard") expect(p.hits.every((x) => x.blocked)).toBe(true);
        expect(p.m.capture).toBeFalsy();
      }
    },
  );
  it("never reuses activating L or a pre-hit input, and ignores a late button", () => {
    for (const timing of ["activation", "early", "late"] as const) {
      const p = arena();
      p.step({ down: true });
      p.step();
      p.step({ down: true, pressed: ["heavy"] });
      let injected = false;
      for (let t = 0; t < 130; t++) {
        const r = p.a.asta!.relay;
        const press =
          !injected &&
          (timing === "early"
            ? t === 0
            : timing === "late" && r && p.a.stateFrame > r.windowTo);
        p.step(press ? { pressed: ["medium"] } : {});
        if (press) injected = true;
        expect(p.a.asta!.relay?.phase).not.toBe("branch");
      }
      expect(p.a.asta!.equipped).toBe("slayer");
      expect(p.a.state).toBe("idle");
      expect(p.hits).toHaveLength(1);
    }
  });
  it("accepts a fresh L after confirmation through hitstop, consumes subsequent choices and rejects simultaneous specials", () => {
    const p = arena();
    p.a.attack("astaDualBreak");
    for (let t = 0; t < 30 && !p.a.asta!.relay?.confirmed; t++) p.step();
    expect(p.m.hitstop).toBeGreaterThan(0);
    p.step({ pressed: ["heavy"] });
    for (let t = 0; t < 20 && p.a.asta!.relay?.phase !== "branch"; t++)
      p.step();
    expect(p.a.asta!.relay?.sword).toBe("destroyer");
    expect(p.a.attack("astaBlackRush")).toBe(false);
    for (let t = 0; t < 90; t++)
      p.step(
        p.a.asta!.relay?.phase === "branch"
          ? { pressed: ["light", "medium", "heavy"] }
          : {},
      );
    expect(p.a.asta!.equipped).toBe("destroyer");
    expect(p.a.state).toBe("idle");
    expect(p.hits).toHaveLength(4);
  });
  it("commits the grimoire exchange once and keeps the last committed sword when interrupted", () => {
    for (const tick of [2, 5]) {
      const p = arena();
      p.a.attack("astaDualBreak");
      for (let t = 0; t < 50; t++) {
        if (p.a.asta!.relay?.phase === "choice") {
          p.step({ pressed: ["light"] });
          break;
        }
        p.step();
      }
      expect(p.a.asta!.relay?.phase).toBe("branch");
      expect(p.a.asta!.draw).toMatchObject({
        from: "slayer",
        to: "slasher",
        commitAt: 3,
      });
      for (let t = 0; t < tick; t++) p.step();
      p.a.setState("hitstun");
      expect(p.a.asta!.equipped).toBe(tick < 3 ? "slayer" : "slasher");
      expect(p.a.asta!.pending).toBeUndefined();
      expect(p.a.asta!.draw).toBeUndefined();
      expect(p.a.asta!.relay).toBeUndefined();
    }
  });
  it.each(["ben", "goku"] as const)(
    "all twelve routes work at either corner against %s without forcing positions",
    (opponent) => {
      for (const { initial, button, selected } of routes)
        for (const side of [1, -1] as const) {
          const p = arena(side, 85, opponent);
          p.a.x = side === 1 ? 1150 : 130;
          p.b.x = side === 1 ? 1235 : 45;
          practiceSword(p.a, initial);
          p.a.attack("astaDualBreak");
          let picked = false;
          for (let t = 0; t < 180; t++) {
            const r = p.a.asta!.relay;
            const input =
              r?.phase === "choice" && !picked ? { pressed: [button] } : {};
            if (r?.phase === "choice") picked = true;
            p.step(input);
            for (const f of p.m.fighters) {
              expect(f.x).toBeGreaterThanOrEqual(0);
              expect(f.x).toBeLessThanOrEqual(1280);
            }
            expect(p.m.capture).toBeFalsy();
          }
          expect(picked).toBe(true);
          expect(p.a.asta!.equipped).toBe(selected);
          expect(p.a.asta!.relay).toBeUndefined();
          expect(p.b.state).not.toBe("grabbed");
        }
    },
  );
  it("does not heal through the Destroyer branch, resurrect, or restart its combo limit", () => {
    const p = arena();
    p.a.health = 700;
    p.a.asta!.recentDamage = [
      { id: 1, at: 0, amount: 300, claimed: false, restored: 0 },
    ];
    p.a.attack("astaDualBreak");
    for (let t = 0; t < 150; t++)
      p.step(p.a.asta!.relay?.phase === "choice" ? { pressed: ["heavy"] } : {});
    expect(p.a.health).toBe(700);
    expect(p.a.asta!.restorationReadyAt).toBe(0);
    const q = arena();
    q.b.health = 10;
    q.a.attack("astaDualBreak");
    for (let t = 0; t < 100; t++) q.step();
    expect(q.b.health).toBe(0);
    expect(q.a.asta!.relay).toBeUndefined();
    expect(q.m.capture).toBeFalsy();
    const z = arena();
    z.a.attack("astaDualBreak");
    for (let t = 0; t < 60 && !z.a.asta!.relay?.confirmed; t++) z.step();
    expect(z.a.attack("astaDualBreak")).toBe(false);
  });
  it("does not confirm a new Relay opening through an earlier residual projected slash", () => {
    const p = arena(1, 400);
    p.a.attack("astaDualBreak");
    p.m.kiProjectiles.push({
      id: ++p.m.projectileSerial,
      owner: 0,
      move: "astaDualBreak",
      cast: p.a.asta!.cast - 1,
      x: p.b.x - 5,
      y: p.b.y - 65,
      previousX: p.b.x - 5,
      previousY: p.b.y - 65,
      vx: 14,
      vy: 0,
      facing: 1,
      radius: 23,
      age: 0,
      life: 22,
      state: "flight",
      impactAge: 0,
    });
    p.step();
    expect(p.b.health).toBeLessThan(1000);
    expect(p.a.asta!.relay!.confirmed).toBe(false);
    for (let t = 0; t < 55; t++) {
      p.step({ pressed: ["heavy"] });
      expect(p.a.asta!.relay?.phase).not.toBe("choice");
      expect(p.a.asta!.relay?.phase).not.toBe("branch");
    }
    expect(p.a.asta!.equipped).toBe("slayer");
  });
  it("lets the BOT choose one ordinary J/K/L continuation", () => {
    const p = arena(),
      bot = new Bot("normal", 3417, 0);
    p.a.attack("astaDualBreak");
    let max = 0;
    for (let t = 0; t < 150 && p.a.asta!.relay; t++) {
      max = Math.max(max, p.a.asta!.relay?.action ?? 0);
      p.step(bot.sample(p.m));
    }
    expect(max).toBe(1);
    expect(p.a.asta!.equipped).toBe("slasher");
    expect(p.a.asta!.relay).toBeUndefined();
  });
});
