import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { CommandBuffer } from "../src/engine/input";
import {
  furyConfig as c,
  furyScene,
  furyContacts,
} from "../src/engine/goku-fury";
import { FighterPresentation } from "../src/render/presentation";
import { gokuAnimations } from "../src/render/goku-animations";
import { snapshot, restore, hashState } from "../src/engine/state";
const empty = () => [neutral(), neutral()] as [InputFrame, InputFrame];
function setup(
  enemy: "samurai" | "dio" | "goku" = "samurai",
  left = false,
  distance = 240,
) {
  const m = new Match(characters.goku, {}, characters[enemy]);
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = left ? 900 : 380;
  b.x = a.x + (left ? -distance : distance);
  a.facing = left ? -1 : 1;
  b.facing = -a.facing;
  a.meter = c.cost;
  return m;
}
function command(m: Match, diag = true) {
  m.step([{ ...neutral(), pressed: ["ultimate"] }, neutral()]);
}
function advance(m: Match, n: number, b = neutral()) {
  for (let i = 0; i < n; i++) m.step([neutral(), b]);
}
function confirm(m: Match) {
  for (let i = 0; i < 140 && !m.fury; i++) m.step(empty());
  expect(m.fury).toBeDefined();
}
describe("Fúria Saiyajin: only a confirmed cinematic owns SSJ1", () => {
  it("supports Goku as player two and a fresh match/rematch resets the sequence and energy", () => {
    const m = new Match(characters.samurai, {}, characters.goku);
    m.phase = "fight";
    const [b, a] = m.fighters;
    b.x = 400;
    a.x = 640;
    b.facing = 1;
    a.facing = -1;
    a.meter = c.cost;
    expect(a.attack("ssj1_fury")).toBe(true);
    confirm(m);
    expect(m.fury?.attacker).toBe(1);
    const copy = restore(snapshot(m));
    while (m.fury) {
      m.step(empty());
      copy.step(empty());
    }
    expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    expect(a.state).toBe("idle");
    expect(a.meter).toBe(0);
    expect(b.knockedDown).toBe(true);
    const fresh = new Match(characters.samurai, {}, characters.goku);
    expect(fresh.fury).toBeUndefined();
    expect(fresh.fighters[1].meter).toBe(0);
    expect(fresh.fighters[1].data).toBe(characters.goku);
  });
  it.each([false, true])(
    "authored strike contacts align with the captive and presentation clocks, left=%s",
    (left) => {
      const m = setup("goku", left),
        a = m.fighters[0],
        visual = new FighterPresentation(gokuAnimations);
      command(m);
      confirm(m);
      while (m.fury) {
        const s = furyScene(m.fury);
        visual.tick(a);
        expect(visual.animator.clipName).toBe(s.attacker.clip);
        const hit = c.hits.find((h) => h.tick === m.fury!.tick);
        if (hit && !["beam", "explosion"].includes(hit.kind)) {
          const p = furyContacts[s.attacker.clip];
          expect(p).toBeDefined();
          expect(
            Math.abs(s.attacker.x + p.x * s.attacker.facing - s.victim.x),
          ).toBeLessThanOrEqual(3);
          expect(
            Math.abs(s.attacker.y + p.y - (s.victim.y - 78)),
          ).toBeLessThanOrEqual(3);
        }
        // Keep bodies below HUD and above the bottom meter during each shot.
        const top = Math.min(s.attacker.y - 150, s.victim.y - 132),
          bottom = Math.max(s.attacker.y, s.victim.y);
        if (m.fury.tick < 398) {
          expect(360 + (top - s.camera.y) * s.camera.scale).toBeGreaterThan(
            140,
          );
          expect(360 + (bottom - s.camera.y) * s.camera.scale).toBeLessThan(
            620,
          );
        }
        m.step(empty());
      }
      visual.tick(a);
      expect(visual.animator.clipName).toBe("idle");
    },
  );
  it.each([false, true])(
    "R activates independent of facing, left=%s",
    (left) => {
      for (const diagonals of [false, true]) {
        const m = setup("samurai", left);
        command(m, diagonals);
        expect(m.fighters[0].moveId).toBe("ssj1_fury");
        expect(m.fighters[0].meter).toBe(0);
        expect(m.fury).toBeUndefined();
      }
    },
  );
  it("consumes an unavailable R without spending meter or firing Ki", () => {
    const m = setup();
    m.fighters[0].meter = c.cost - 1;
    command(m);
    advance(m, 15);
    expect(m.fighters[0].moveId).toBe("");
    expect(m.kiProjectiles).toEqual([]);
    expect(m.fighters[0].meter).toBe(c.cost - 1);
  });
  it("the former directional Super command now stays an ordinary Ki command", () => {
    const m = setup();
    for (const [i, d] of [2, 3, 6, 2, 3, 6].entries())
      m.step([
        {
          direction: d === 3 || d === 6 ? 1 : 0,
          down: d === 2 || d === 3,
          pressed: i === 5 ? ["heavy"] : [],
        },
        neutral(),
      ]);
    expect(m.fighters[0].moveId).toBe("ki_heavy");
    expect(m.fighters[0].meter).toBe(c.cost);
  });
  it("charges one full bar more slowly, and cannot use it twice without recharging", () => {
    const m = setup();
    const a = m.fighters[0];
    a.meter = 0;
    a.gainMeter(10);
    expect(a.meter).toBe(3.5);
    a.gainMeter(1000);
    expect(a.meter).toBe(c.meterMaximum);
    expect(a.attack("ssj1_fury")).toBe(true);
    expect(a.meter).toBe(0);
    expect(a.attack("ssj1_fury")).toBe(false);
    expect(characters.samurai.meterGainScale).toBeUndefined();
    expect(characters.dio.meterGainScale).toBeUndefined();
  });
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].map((left) => ({ enemy, left })),
    ),
  )(
    "complete cinema vs $enemy, left=$left; controls/camera release to base",
    ({ enemy, left }) => {
      const m = setup(enemy, left);
      const [a, b] = m.fighters;
      command(m);
      confirm(m);
      const timer = m.timer,
        ledger = structuredClone(m.temporal.s.ledger);
      let hits = 0,
        damage = 0;
      const phases = new Set<string>();
      while (m.fury) {
        const scene = furyScene(m.fury);
        phases.add(scene.phase);
        expect(Number.isFinite(a.x + a.y + b.x + b.y)).toBe(true);
        expect(a.x).toBeGreaterThanOrEqual(40);
        expect(a.x).toBeLessThanOrEqual(1240);
        m.step([
          {
            ...neutral(),
            direction: -1,
            pressed: ["heavy", "jump", "ultimate"],
          },
          { ...neutral(), pressed: ["light", "jump"] },
        ]);
        hits += m.hits.length;
        damage += m.hits.reduce((s, h) => s + h.damage, 0);
        expect(m.timer).toBe(timer);
      }
      expect(hits).toBe(c.hits.length);
      expect(damage + c.initialDamage).toBeLessThan(450);
      expect(phases.size).toBe(10);
      expect(a.state).toBe("idle");
      expect(a.y).toBe(FLOOR);
      expect(a.actionClip).toBe("");
      expect(a.meter).toBe(0);
      expect(a.attackShapes()).toEqual([]);
      expect(b.knockedDown).toBe(true);
      expect(b.health).toBeGreaterThan(0);
      expect(m.temporal.s.ledger).toEqual(ledger);
      expect(a.buffer.actions).toEqual([]);
      expect(a.buffer.directions).toEqual([]);
      advance(m, 65);
      expect(b.state).toBe("idle");
      m.step([{ ...neutral(), pressed: ["light"] }, neutral()]);
      expect(a.moveId).toBe("stand_light");
    },
  );
  it.each([false, true])(
    "blocked initial strike never captures, left=%s",
    (left) => {
      const m = setup("samurai", left);
      const [a, b] = m.fighters;
      b.x = left ? 40 : 1240;
      a.x = b.x - a.facing * 240;
      const guard = { ...neutral(), direction: -b.facing as -1 | 1 };
      expect(a.attack("ssj1_fury")).toBe(true);
      let blocked = 0;
      for (let i = 0; i < 220; i++) {
        m.step([neutral(), guard]);
        expect(m.fury).toBeUndefined();
        blocked += m.hits.filter((h) => h.blocked).length;
      }
      expect(blocked).toBe(1);
      expect(b.health).toBe(b.data.health);
      expect(a.state).toBe("idle");
      expect(a.meter).toBe(0);
    },
  );
  it("whiffs beyond its finite dash/strike range and returns to base recovery", () => {
    const m = setup("dio", false, 600);
    command(m);
    advance(m, 220);
    expect(m.fury).toBeUndefined();
    expect(m.fighters[1].health).toBe(1000);
    expect(m.fighters[0].state).toBe("idle");
  });
  it("vulnerable transformation can be interrupted and leaves no live hitbox", () => {
    const m = setup("goku", false, 70),
      [a, b] = m.fighters;
    a.attack("ssj1_fury");
    b.attack("stand_light");
    advance(m, 30);
    expect(a.health).toBeLessThan(1000);
    expect(m.fury).toBeUndefined();
    expect(a.moveId).not.toBe("ssj1_fury");
    expect(a.attackShapes()).toEqual([]);
  });
  it("can cancel a confirmed normal, cannot cancel a whiff or teleport", () => {
    const m = setup("goku", false, 70),
      a = m.fighters[0];
    a.attack("stand_light");
    while (!a.canSuperCancel() && m.frame < 40) m.step(empty());
    expect(a.canSuperCancel()).toBe(true);
    expect(a.attack("ssj1_fury")).toBe(true);
    const other = setup("goku", false, 600);
    other.fighters[0].attack("stand_light");
    advance(other, 7);
    expect(other.fighters[0].canStartSuper()).toBe(false);
  });
  it("defers round-ending KO until the movie and detransformation finish", () => {
    const m = setup("dio"),
      b = m.fighters[1];
    b.health = 40;
    command(m);
    confirm(m);
    while (m.fury && m.fury.tick < 334) m.step(empty());
    expect(b.health).toBe(0);
    expect(m.phase).toBe("fight");
    while (m.fury) m.step(empty());
    expect(m.phase).toBe("roundEnd");
    expect(m.fighters[0].state).toBe("victory");
    expect(m.fighters[0].actionClip).toBe("");
  });
  it("snapshots every phase, resumes identically and preserves temporal cooldowns", () => {
    const m = setup("dio");
    m.temporal.s.ledger[1] = { uses: 3, cooldown: 800 };
    command(m);
    confirm(m);
    const initial = m.temporal.s.ledger[1].cooldown;
    for (let t = 0; t < 434; t++) {
      if ([0, 34, 60, 116, 164, 224, 278, 334, 384, 410, 430].includes(t)) {
        const copy = restore(snapshot(m));
        advance(m, 1);
        advance(copy, 1);
        expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
      } else advance(m, 1);
    }
    expect(m.fury).toBeUndefined();
    expect(m.temporal.s.ledger[1]).toEqual({ uses: 3, cooldown: initial });
  });
  it.each([false, true])(
    "corner staging never exits arena and integer camera returns, left=%s",
    (left) => {
      const m = setup("samurai", left);
      const [a, b] = m.fighters;
      b.x = left ? 40 : 1240;
      a.x = b.x - a.facing * 240;
      a.attack("ssj1_fury");
      confirm(m);
      while (m.fury) {
        const s = furyScene(m.fury);
        expect(s.attacker.x).toBeGreaterThanOrEqual(40);
        expect(s.attacker.x).toBeLessThanOrEqual(1240);
        expect([1, 2]).toContain(s.camera.scale);
        m.step(empty());
      }
      expect(m.fighters.every((f) => f.y === FLOOR)).toBe(true);
    },
  );
});
