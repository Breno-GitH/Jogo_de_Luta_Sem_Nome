import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame, type Button } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import { CommandBuffer } from "../src/engine/input";
import { TemporalController } from "../src/engine/temporal";
import { projectileHits } from "../src/engine/projectiles";
import balance from "../src/data/dio-specials.json";

function fixture(
  enemy: "samurai" | "dio" = "samurai",
  mirror = false,
  gap = 65,
  training = true,
) {
  const m = new Match(
    characters.dio,
    training ? { training: true } : {},
    characters[enemy],
  );
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = 600;
  b.x = 600 + (mirror ? -gap : gap);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  for (const f of m.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  return m;
}
const step = (m: Match, a = neutral(), b = neutral()) => m.step([a, b]);
function direction(value: number, facing: number, button?: Button): InputFrame {
  return {
    direction: ([3, 6].includes(value)
      ? facing
      : [1, 4].includes(value)
        ? -facing
        : 0) as -1 | 0 | 1,
    down: [1, 2, 3].includes(value),
    pressed: button ? [button] : [],
  };
}
function command(
  m: Match,
  type: "knives" | "rush" | "time",
  button: Button = "heavy",
  diagonal = true,
  enemy = neutral(),
) {
  const pattern =
    type === "time"
      ? diagonal
        ? [6, 3, 2]
        : [6, 2]
      : type === "rush"
        ? diagonal
          ? [2, 1, 4]
          : [2, 4]
        : diagonal
          ? [2, 3, 6]
          : [2, 6];
  for (let i = 0; i < pattern.length; i++)
    step(
      m,
      direction(
        pattern[i],
        m.fighters[0].facing,
        i === pattern.length - 1 ? button : undefined,
      ),
      enemy,
    );
}
function until(m: Match, test: () => boolean, max = 500) {
  for (let i = 0; i < max && !test(); i++) step(m);
  expect(test()).toBe(true);
}
function activate(m: Match) {
  command(m, "time");
  until(m, () => m.temporal.active);
}
function stationaryGuard(m: Match) {
  const b = m.fighters[1];
  b.data = {
    ...b.data,
    speed: 0,
    locomotion: b.data.locomotion
      ? { ...b.data.locomotion, backSpeed: 0 }
      : undefined,
  };
  return { ...neutral(), direction: -b.facing as -1 | 1 };
}

describe("Dio ordinary specials", () => {
  for (const enemy of ["samurai", "dio"] as const)
    for (const mirror of [false, true])
      for (const strength of ["light", "medium", "heavy"] as const) {
        it(`knives ${strength}, ${enemy}, facing ${mirror ? "left" : "right"}`, () => {
          const m = fixture(enemy, mirror, 330),
            a = m.fighters[0];
          a.meter = 75;
          command(m, "knives", strength);
          expect(a.moveId).toBe(`knives_${strength}`);
          expect(a.meter).toBe(75);
          let hits = 0;
          const ids = new Set<number>();
          for (let i = 0; i < 220; i++) {
            step(m);
            hits += m.hits.filter((h) => h.attacker === 0).length;
            for (const p of m.projectiles) ids.add(p.id);
            expect(a.attackShapes()).toEqual([]);
          }
          expect(ids.size).toBe(
            strength === "light" ? 1 : strength === "medium" ? 2 : 3,
          );
          expect(hits).toBe(ids.size);
          expect(a.state).toBe("idle");
          expect(m.projectiles).toEqual([]);
          expect(a.stand!.s.mode).toBe("follow");
        });
        it(`Rush ${strength}, ${enemy}, facing ${mirror ? "left" : "right"}`, () => {
          const m = fixture(enemy, mirror),
            a = m.fighters[0];
          a.meter = 77;
          command(m, "rush", strength);
          expect(a.moveId).toBe(`rush_${strength}`);
          expect(a.meter).toBe(77);
          let hits = 0;
          const windows = new Set<number>();
          let prematurelyReturned = false;
          for (let i = 0; i < 260; i++) {
            step(m);
            hits += m.hits.filter((h) => h.attacker === 0).length;
            if (a.hitWindow) windows.add(a.hitWindow.id);
            if (a.state === "attack" && a.stand!.s.mode === "return")
              prematurelyReturned = true;
            if (a.attackShapes().length)
              expect(a.attackShapes()).toEqual(a.stand!.hitboxes(a));
            expect(m.capture).toBeUndefined();
            expect(m.temporal.active).toBe(false);
          }
          expect(hits).toBe(balance.rush[strength].hits);
          expect(windows.size).toBe(hits);
          expect(prematurelyReturned).toBe(false);
          expect(a.state).toBe("idle");
          expect(a.stand!.s.mode).toBe("follow");
        });
      }
  it("blocks every knife and all ten Rush contacts without damage", () => {
    for (const type of ["knives", "rush"] as const) {
      const m = fixture("dio", false, type === "knives" ? 250 : 65),
        guard = stationaryGuard(m);
      command(m, type, "heavy", true, guard);
      let blocks = 0;
      for (let i = 0; i < 250; i++) {
        step(m, neutral(), guard);
        blocks += m.hits.filter((h) => h.blocked).length;
      }
      expect(m.fighters[1].health).toBe(1000);
      expect(blocks).toBe(type === "knives" ? 3 : 10);
    }
  });
  it("respects knife recovery, projectile capacity and interrupted releases", () => {
    const m = fixture("dio", false, 600),
      a = m.fighters[0];
    a.x = 100;
    expect(a.attack("knives_heavy")).toBe(true);
    expect(a.attack("knives_light")).toBe(false);
    until(m, () => m.projectiles.length === 3);
    until(m, () => a.state === "idle");
    activate(m);
    until(m, () => a.state === "idle");
    expect(a.attack("knives_heavy")).toBe(true);
    until(m, () => m.projectiles.length === 6);
    until(m, () => a.state === "idle");
    expect(a.attack("knives_light")).toBe(false);
    const n = fixture("samurai", false, 400);
    n.fighters[0].attack("knives_medium");
    until(n, () => n.projectiles.length === 1);
    n.fighters[0].setState("hitstun");
    n.fighters[0].stun = 30;
    let max = 1;
    for (let i = 0; i < 60; i++) {
      step(n);
      max = Math.max(max, n.projectiles.length);
    }
    expect(max).toBe(1);
  });
  it("sweeps fast projectiles through narrow hurtboxes", () => {
    expect(
      projectileHits(
        { previousX: 0, previousY: 100, x: 80, y: 100, facing: 1 } as any,
        [{ x: 40, y: 98, w: 2, h: 4 }],
      ),
    ).toBe(true);
  });
  it("cancels a confirmed heavy normal into Rush using the real command buffer", () => {
    const m = fixture();
    const a = m.fighters[0];
    a.attack("stand_heavy");
    until(m, () => a.connected);
    command(m, "rush", "heavy");
    until(m, () => a.moveId === "rush_heavy", 15);
    expect(a.stand!.s.chainCount).toBe(2);
    expect(a.stand!.s.bridgeClip).toContain("bridge_heavyPunch");
    let rushHits = 0;
    for (let i = 0; i < 220; i++) {
      step(m);
      rushHits += m.hits.filter((h) => h.move === "rush_heavy").length;
    }
    expect(rushHits).toBe(10);
    expect(a.stand!.ready).toBe(true);
  });
  it("Rush loses its remaining boxes immediately on damage and returns", () => {
    const m = fixture();
    const a = m.fighters[0];
    a.attack("rush_heavy");
    until(m, () => a.connected);
    a.setState("hitstun");
    a.stun = 22;
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      step(m);
      hits += m.hits.filter((h) => h.attacker === 0).length;
      expect(a.attackShapes()).toEqual([]);
    }
    expect(hits).toBe(0);
    expect(a.stand!.ready).toBe(true);
  });
});

describe("relative motion recognition and priority", () => {
  for (const mirror of [false, true])
    for (const diagonal of [false, true])
      for (const type of ["knives", "rush", "time"] as const)
        it(`${type}, mirror ${mirror}, diagonal ${diagonal}`, () => {
          const m = fixture("samurai", mirror, 400);
          command(m, type, "heavy", diagonal);
          expect(m.fighters[0].moveId).toBe(
            type === "time" ? "time_stop" : type + "_heavy",
          );
        });
  it("does not recognise reversed order, missing cardinal, stale motion, or directions after the button", () => {
    for (const seq of [
      [6, 4, 6],
      [3, 6],
      [2, 4, 6],
    ]) {
      const b = new CommandBuffer();
      seq.forEach((d, i) =>
        b.push(
          direction(d, 1, i === seq.length - 1 ? "light" : undefined),
          i,
          1,
        ),
      );
      expect(b.dioSpecial("light")).toBeUndefined();
    }
    const b = new CommandBuffer();
    b.push(direction(2, 1), 0, 1);
    b.push(direction(6, 1), 1, 1);
    b.push(direction(6, 1, "light"), 30, 1);
    expect(b.dioSpecial("light")).toBeUndefined();
    b.clear();
    b.push(direction(2, 1, "light"), 40, 1);
    b.push(direction(6, 1), 41, 1);
    expect(b.dioSpecial("light")).toBeUndefined();
  });
  it("consumes a motion once and cannot fall through to heavy while time is unavailable", () => {
    const m = fixture();
    m.temporal.s.ledger[0].cooldown = 300;
    command(m, "time");
    expect(m.fighters[0].state).not.toBe("attack");
    for (let i = 0; i < 20; i++) step(m, direction(2, 1));
    expect(m.fighters[0].moveId).toBe("");
    const b = new CommandBuffer();
    b.push(direction(2, 1), 0, 1);
    b.push(direction(6, 1, "light"), 1, 1);
    expect(b.dioSpecial("light")).toBe("knives");
    b.consumeSpecial("light");
    expect(b.dioSpecial("light")).toBeUndefined();
  });
});

describe("selective time freeze and match-persistent recharge", () => {
  it("also lets player two stop player one, with an independent match ledger", () => {
    const m = fixture("dio", false, 400),
      [a, b] = m.fighters;
    for (const [i, value] of [6, 3, 2].entries())
      step(
        m,
        neutral(),
        direction(value, b.facing, i === 2 ? "heavy" : undefined),
      );
    until(m, () => m.temporal.active);
    expect(m.temporal.s.owner).toBe(1);
    expect(m.temporal.s.ledger[0].uses).toBe(0);
    expect(m.temporal.s.ledger[1].uses).toBe(1);
    const x = a.x;
    for (let i = 0; i < 120; i++)
      step(m, direction(6, 1, "heavy"), direction(4, b.facing));
    expect(a.x).toBe(x);
    expect(m.temporal.s.ledger[0].cooldown).toBe(0);
    expect(m.temporal.s.ledger[1].cooldown).toBe(1200);
  });
  it("resolves simultaneous activations once, without overlapping clocks or charging the frozen player", () => {
    const m = fixture("dio", false, 400);
    expect(m.fighters[0].attack("time_stop")).toBe(true);
    expect(m.fighters[1].attack("time_stop")).toBe(true);
    until(m, () => m.temporal.active);
    expect(m.temporal.s.owner).toBe(0);
    until(m, () => !m.temporal.active);
    for (let i = 0; i < 50; i++) step(m);
    expect(m.temporal.s.ledger[0].uses).toBe(1);
    expect(m.temporal.s.ledger[1].uses).toBe(0);
    expect(m.fighters[1].state).toBe("idle");
  });
  it("freezes physics, animations' clocks, controls, timer and projectiles for exactly 120 steps", () => {
    const m = fixture("dio", false, 600, false),
      [a, b] = m.fighters;
    a.x = 100;
    a.attack("knives_light");
    until(m, () => a.state === "idle");
    activate(m);
    expect(m.projectiles.length).toBe(1);
    const p = structuredClone(m.projectiles[0]);
    const frozen = {
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      state: b.state,
      stateFrame: b.stateFrame,
      stand: structuredClone(b.stand!.s),
    };
    const timer = m.timer;
    const x = a.x;
    for (let i = 0; i < 120; i++) {
      expect(m.temporal.active).toBe(true);
      step(m, direction(4, 1), direction(6, -1, "heavy"));
      expect({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        state: b.state,
        stateFrame: b.stateFrame,
        stand: b.stand!.s,
      }).toEqual(frozen);
      expect(m.projectiles[0]).toEqual(p);
      expect(m.timer).toBe(timer);
    }
    expect(m.temporal.active).toBe(false);
    expect(a.x).toBeLessThan(x);
    expect(m.temporal.s.ledger[0]).toEqual({ uses: 1, cooldown: 1200 });
    step(m);
    expect(m.projectiles[0].x).not.toBe(p.x);
    expect(m.timer).toBe(timer - 1);
    expect(b.moveId).toBe("");
  });
  it("keeps a frozen attack pose until resume, queues reaction, and applies temporal damage limits", () => {
    const m = fixture("dio"),
      [a, b] = m.fighters;
    activate(m);
    const state = b.state,
      frame = b.stateFrame;
    const y = b.y;
    expect(a.attack("rush_heavy")).toBe(false);
    until(m, () => a.state === "idle");
    expect(a.attack("rush_heavy")).toBe(true);
    let temporalHits = 0;
    while (m.temporal.active) {
      step(m);
      temporalHits += m.hits.filter((h) => h.attacker === 0).length;
      if (m.temporal.active) {
        expect(b.state).toBe(state);
        expect(b.stateFrame).toBe(frame);
        expect(b.y).toBe(y);
      }
    }
    expect(temporalHits).toBeLessThanOrEqual(balance.timeStop.maximumHits);
    expect(1000 - b.health).toBeGreaterThan(0);
    expect(1000 - b.health).toBeLessThanOrEqual(balance.timeStop.maximumDamage);
    expect(b.state).toBe("hitstun");
    expect(a.meter).toBeGreaterThanOrEqual(0);
    const t = new TemporalController();
    t.activate(0);
    for (let i = 0; i < 30; i++) t.budget(999);
    expect(t.s.hits).toBeLessThanOrEqual(8);
    expect(t.s.damage).toBe(220);
  });
  it("has 20/30/40/50/60 second cooldowns, starting only after the effect", () => {
    const t = new TemporalController();
    for (let uses = 1; uses <= 5; uses++) {
      expect(t.activate(0)).toBe(true);
      expect(t.s.ledger[0].uses).toBe(uses);
      for (let i = 0; i < 120; i++) {
        const active = t.beginStep(true);
        expect(t.s.ledger[0].cooldown).toBe(0);
        t.endStep(active);
      }
      expect(t.s.ledger[0].cooldown).toBe((20 + (uses - 1) * 10) * 60);
      expect(t.activate(0)).toBe(false);
      while (t.s.ledger[0].cooldown) t.beginStep(true);
    }
  });
  it("preserves uses and remaining cooldown through round loss, intro and damage; only new Match resets", () => {
    const m = fixture("samurai", false, 400, false);
    activate(m);
    until(m, () => !m.temporal.active);
    for (let i = 0; i < 10; i++) step(m);
    m.fighters[0].setState("hitstun");
    m.fighters[0].stun = 20;
    const uses = m.temporal.s.ledger[0].uses;
    expect(uses).toBe(1);
    m.fighters[0].health = 0;
    step(m);
    const cooldown = m.temporal.s.ledger[0].cooldown;
    for (let i = 0; i < 250; i++) step(m);
    expect(m.round).toBe(2);
    expect(m.temporal.s.ledger[0]).toEqual({ uses: 1, cooldown });
    until(m, () => m.temporal.s.ledger[0].cooldown === 0, 1300);
    activate(m);
    until(m, () => !m.temporal.active);
    expect(m.temporal.s.ledger[0]).toEqual({ uses: 2, cooldown: 1800 });
    expect(new Match(characters.dio).temporal.s.ledger[0]).toEqual({
      uses: 0,
      cooldown: 0,
    });
  });
  it("does not advance cooldown during hitstop, capture or intervals and has separate ledgers for Dio mirrors", () => {
    const m = fixture("dio");
    m.temporal.s.ledger[0] = { uses: 2, cooldown: 88 };
    m.temporal.s.ledger[1] = { uses: 1, cooldown: 44 };
    m.hitstop = 5;
    for (let i = 0; i < 5; i++) step(m);
    expect(m.temporal.s.ledger[0].cooldown).toBe(88);
    m.phase = "roundEnd";
    m.phaseFrames = 50;
    for (let i = 0; i < 10; i++) step(m);
    expect(m.temporal.s.ledger[1].cooldown).toBe(44);
    m.phase = "fight";
    step(m);
    expect(m.temporal.s.ledger[0].cooldown).toBe(87);
    expect(m.temporal.canActivate(1)).toBe(false);
  });
  it("restores mid-freeze projectiles, pending impacts, history and all cooldowns deterministically", () => {
    const m = fixture("dio");
    activate(m);
    until(m, () => m.fighters[0].state === "idle");
    m.fighters[0].attack("rush_medium");
    until(m, () => m.temporal.s.hits >= 2);
    const copy = restore(JSON.parse(JSON.stringify(snapshot(m))));
    for (let i = 0; i < 220; i++) {
      step(m);
      step(copy);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    }
  });
  it("does not charge a use when startup is interrupted, prevents overlapping stops and terminates safely on KO", () => {
    const m = fixture("dio"),
      a = m.fighters[0];
    command(m, "time");
    a.setState("hitstun");
    a.stun = 30;
    for (let i = 0; i < 60; i++) step(m);
    expect(m.temporal.s.ledger[0].uses).toBe(0);
    activate(m);
    expect(m.fighters[1].attack("time_stop")).toBe(false);
    expect(a.attack("time_stop")).toBe(false);
    m.fighters[1].health = 0;
    step(m);
    expect(m.temporal.active).toBe(false);
    expect(m.temporal.s.ledger[0].cooldown).toBe(1200);
    expect(m.phase).toBe("roundEnd");
    expect(m.projectiles).toEqual([]);
  });
  it("is vulnerable during activation and Rush startup to real Samurai collisions", () => {
    for (const id of ["time_stop", "rush_heavy"]) {
      const m = fixture(),
        [a, b] = m.fighters;
      a.attack(id);
      b.attack("stand_light");
      for (let i = 0; i < 90; i++) step(m);
      expect(a.health).toBeLessThan(1000);
      expect(m.temporal.s.ledger[0].uses).toBe(0);
      expect(a.attackShapes()).toEqual([]);
      expect(a.stand!.ready).toBe(true);
    }
  });
  it("preserves an opponent's unfinished attack clock and resumes it after time returns", () => {
    const m = fixture("dio", false, 400),
      [a, b] = m.fighters;
    command(m, "time");
    until(m, () => a.stateFrame === 20);
    expect(b.attack("stand_heavy")).toBe(true);
    until(m, () => m.temporal.active);
    const frame = b.stateFrame,
      stand = structuredClone(b.stand!.s);
    for (let i = 0; i < 120; i++) {
      step(m);
      expect(b.stateFrame).toBe(frame);
      expect(b.stand!.s).toEqual(stand);
    }
    step(m);
    expect(b.stateFrame).toBe(frame + 1);
    expect(b.state).toBe("attack");
  });
});
