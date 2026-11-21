import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import {
  astaUnionId,
  astaUnionConfig,
  astaUnionScene,
  astaEquinoxPlane,
} from "../src/engine/asta-super";
import {
  unionBeats,
  unionContacts,
  unionPose,
} from "../src/engine/asta-super-acts";
import { astaSwords } from "../src/engine/asta-stances";
import { FighterPresentation } from "../src/render/presentation";
import { astaAnimations } from "../src/render/asta-animations";
function arena(side = 1, gap = 220, p2 = false, opponent = characters.samurai) {
  const m = new Match(
    p2 ? opponent : characters.asta,
    {},
    p2 ? characters.asta : opponent,
  );
  m.phase = "fight";
  m.message = "";
  const a = m.fighters[p2 ? 1 : 0],
    b = m.fighters[p2 ? 0 : 1];
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  a.facing = side;
  b.facing = -side;
  a.meter = 100;
  const hits: typeof m.hits = [];
  const step = (
    input: Partial<InputFrame> = {},
    guard: Partial<InputFrame> = {},
  ) => {
    const pair = [
      { ...neutral(), ...input },
      { ...neutral(), ...guard },
    ] as [InputFrame, InputFrame];
    m.step(p2 ? [pair[1], pair[0]] : pair);
    hits.push(...m.hits);
  };
  const confirm = () => {
    step({ pressed: ["ultimate"] });
    for (let i = 0; i < 80 && !m.astaUnion; i++) step();
    expect(m.astaUnion).toBeDefined();
  };
  return { m, a, b, step, hits, confirm };
}
describe("Asta R: Black Meteorite into Devil Union", () => {
  it.each([1, -1])("uses a guardable real opener, side %s", (side) => {
    const { m, a, b, step, hits } = arena(side);
    step({ pressed: ["ultimate"] }, { direction: side as 1 | -1 });
    expect(a.moveId).toBe(astaUnionId);
    expect(a.meter).toBe(0);
    for (let i = 0; i < 100; i++) {
      step({}, { direction: side as 1 | -1 });
      expect(m.cinematicActive).toBe(false);
    }
    expect(
      hits.filter((h) => h.move === astaUnionId && h.blocked),
    ).toHaveLength(1);
    expect(b.health).toBe(1000);
    expect(a.state).toBe("idle");
  });
  it("whiffs outside the finite rush and returns without a transformation", () => {
    const { m, a, b, step } = arena(1, 850);
    step({ pressed: ["ultimate"] });
    for (let i = 0; i < 110; i++) {
      step();
      expect(m.astaUnion).toBeUndefined();
    }
    expect(a.state).toBe("idle");
    expect(a.meter).toBe(0);
    expect(b.health).toBe(1000);
    expect(a.asta!.equipped).toBe("slayer");
  });
  it.each(astaSwords)(
    "commits Slayer during the opener from %s and finishes with Slasher",
    (sword) => {
      const p = arena();
      p.a.asta!.equipped = sword;
      p.confirm();
      expect(p.a.asta!.equipped).toBe("slayer");
      for (let i = 0; i < 1300 && p.m.astaUnion; i++) p.step();
      expect(p.m.astaUnion).toBeUndefined();
      expect(p.a.state).toBe("idle");
      expect(p.a.asta!.equipped).toBe("slasher");
      expect(p.a.asta!.draw).toBeUndefined();
      expect(p.b.health).toBe(660);
      expect(p.hits.filter((h) => h.move.startsWith(astaUnionId))).toHaveLength(
        7,
      );
      expect(p.a.y).toBe(FLOOR);
      expect(p.b.y).toBe(FLOOR);
    },
  );
  it("preserves the previous sword when interrupted before the draw commit", () => {
    const p = arena();
    p.a.asta!.equipped = "destroyer";
    p.step({ pressed: ["ultimate"] });
    for (let i = 0; i < 5; i++) p.step();
    p.a.setState("hitstun");
    p.a.stun = 15;
    expect(p.a.asta!.equipped).toBe("destroyer");
    expect(p.a.asta!.pending).toBeUndefined();
    for (let i = 0; i < 100; i++) p.step();
    expect(p.m.astaUnion).toBeUndefined();
  });
  it("requires full meter, grounded free state and never begins twice", () => {
    const p = arena();
    p.a.meter = 99;
    expect(p.a.attack(astaUnionId)).toBe(false);
    p.a.meter = 100;
    p.a.y -= 40;
    expect(p.a.attack(astaUnionId)).toBe(false);
    p.a.y = FLOOR;
    p.confirm();
    const state = p.m.astaUnion;
    p.a.meter = 100;
    expect(p.a.attack(astaUnionId)).toBe(false);
    expect(p.m.astaUnion).toBe(state);
  });
  it.each([false, true])(
    "restores every phase without duplicate damage, player2=%s",
    (p2) => {
      const p = arena(p2 ? -1 : 1, 220, p2);
      p.confirm();
      const phases = new Set<string>(),
        forms = new Set<string>(),
        presentation = new FighterPresentation(astaAnimations);
      let previous = { x: p.b.x, y: p.b.y };
      for (let i = 0; i < 1300 && p.m.astaUnion; i++) {
        const scene = astaUnionScene(p.m.astaUnion);
        phases.add(scene.phase);
        forms.add(scene.form);
        expect(
          Math.hypot(scene.victim.x - previous.x, scene.victim.y - previous.y),
        ).toBeLessThan(24);
        previous = scene.victim;
        presentation.tick(p.a);
        expect(presentation.animator.sprite().sheet).toMatch(
          /^asta\/r(?:-|41-)/,
        );
        if (
          [
            4, 90, 158, 232, 352, 484, 580, 724, 824, 872, 945, 956, 1004, 1070,
          ].includes(p.m.astaUnion.tick) &&
          !p.m.astaUnion.hold
        ) {
          const copy = restore(snapshot(p.m));
          p.step();
          copy.step([neutral(), neutral()]);
          expect(hashState(snapshot(copy))).toBe(hashState(snapshot(p.m)));
        } else p.step();
      }
      expect(phases.size).toBe(13);
      expect(forms).toEqual(
        new Set(["black", "changing", "union", "return", "base"]),
      );
      expect(p.b.health).toBe(660);
      expect(p.m.cinematicActive).toBe(false);
      for (let i = 0; i < 150; i++) p.step();
      expect(p.b.state).toBe("idle");
      p.step({ direction: 1 });
      expect(p.a.state).toBe("walk");
    },
  );
  it("keeps a low-life victim alive until the final event and resolves KO once", () => {
    const p = arena();
    p.b.health = 20;
    p.confirm();
    while (p.m.astaUnion && p.m.astaUnion.tick < unionBeats.impact) {
      p.step();
      expect(p.m.phase).toBe("fight");
      if (p.m.astaUnion!.tick < unionBeats.impact)
        expect(p.b.health).toBeGreaterThan(0);
    }
    while (p.m.astaUnion) p.step();
    expect(p.b.health).toBe(0);
    expect(p.m.wins).toEqual([1, 0]);
  });
  it("scales a confirmed combo and has a finite documented total", () => {
    const p = arena();
    p.b.combo = 8;
    p.confirm();
    const scale = p.m.astaUnion!.scale;
    expect(scale).toBeGreaterThanOrEqual(0.55);
    while (p.m.astaUnion) p.step();
    expect(1000 - p.b.health).toBe(
      astaUnionConfig.hits.reduce(
        (n, h) => n + Math.round(h.damage * scale),
        0,
      ),
    );
  });

  it.each([1, -1])(
    "retreats before a separate sky-to-floor Equinox, side %s",
    (side) => {
      const p = arena(side);
      p.confirm();
      const s = p.m.astaUnion!;
      const before = astaUnionScene({ ...s, tick: 824 }),
        away = astaUnionScene({ ...s, tick: 932 });
      expect(Math.abs(away.attacker.x - away.victim.x)).toBeGreaterThan(500);
      expect((away.attacker.x - before.attacker.x) * side).toBeLessThan(-300);
      expect(away.sword).toBe("slasher");
      const plane = astaEquinoxPlane({ ...s, tick: 945 });
      expect(plane.top).toBeLessThan(150);
      expect(plane.bottom).toBe(FLOOR);
      expect(plane.impact - plane.release).toBe(11);
      expect(astaUnionScene({ ...s, tick: 956 }).victim.x).toBe(plane.x);
      expect(astaUnionConfig.hits.filter((h) => h.tick >= 945)).toEqual([
        {
          tick: 956,
          damage: 140,
          kind: "explosion",
          hold: 9,
          angle: Math.PI / 2,
        },
      ]);
      const health = p.b.health;
      while (p.m.astaUnion && p.m.astaUnion.tick < 945) p.step();
      const preImpact = p.b.health;
      while (p.m.astaUnion && p.m.astaUnion.tick < 956) p.step();
      expect(health - preImpact).toBe(200);
      expect(preImpact - p.b.health).toBe(140);
      for (let i = 0; i < 15; i++) p.step();
      expect(p.b.health).toBe(660);
    },
  );
  it.each(["goku", "dio", "ben", "luffy", "kaneki"] as const)(
    "finishes at either corner against %s without heals or orphan states",
    (opponent) => {
      for (const side of [1, -1]) {
        const p = arena(side, 130, false, characters[opponent]);
        p.a.x = side > 0 ? 1060 : 220;
        p.b.x = side > 0 ? 1190 : 90;
        p.a.health = 650;
        p.confirm();
        let previous = { x: p.a.x, y: p.a.y },
          maximum = 0;
        while (p.m.astaUnion) {
          p.step();
          maximum = Math.max(
            maximum,
            Math.hypot(p.a.x - previous.x, p.a.y - previous.y),
          );
          previous = { x: p.a.x, y: p.a.y };
        }
        expect(maximum).toBeLessThan(65);
        expect(p.a.health).toBe(650);
        expect(p.b.health).toBe(660);
        expect(p.a.x).toBeGreaterThan(40);
        expect(p.a.x).toBeLessThan(1240);
        expect(p.b.x).toBeGreaterThan(40);
        expect(p.b.x).toBeLessThan(1240);
        expect(p.a.asta!.equipped).toBe("slasher");
        expect(p.m.capture).toBeUndefined();
      }
    },
  );
  it("keeps the eleven-chapter performance within 16–20 seconds and separates visual contacts from damage", () => {
    const ticks =
      unionBeats.end + unionContacts.reduce((sum, h) => sum + h.hold, 0) + 14;
    expect(ticks / 60).toBeGreaterThanOrEqual(16);
    expect(ticks / 60).toBeLessThanOrEqual(20);
    expect(astaUnionConfig.hits).toHaveLength(7);
    expect(unionContacts.length).toBe(18);
    expect(astaUnionConfig.hits.reduce((n, h) => n + h.damage, 0)).toBe(340);
    expect(unionPose(232).sword).toBe("slayer");
    expect(unionPose(352).sword).toBe("dweller");
    expect(unionPose(484).sword).toBe("destroyer");
    expect(unionPose(580).sword).toBe("slasher");
  });
  it.each([1, -1])(
    "keeps both bodies inside the cinematic viewport, side %s",
    (side) => {
      const p = arena(side);
      p.confirm();
      const initial = p.m.astaUnion!;
      for (let tick = 0; tick <= 1100; tick++) {
        const scene = astaUnionScene({ ...initial, tick }),
          c = scene.camera;
        for (const actor of [scene.attacker, scene.victim]) {
          const foot = 360 + (actor.y - c.y) * c.scale;
          const head = 360 + (actor.y - 130 - c.y) * c.scale;
          expect(foot, `feet at ${tick}`).toBeLessThanOrEqual(585);
          expect(head, `head at ${tick}`).toBeGreaterThanOrEqual(145);
        }
      }
    },
  );
});
