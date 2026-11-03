import { describe, expect, it } from "vitest";
import { characters, characterById } from "../src/engine/characters";
import { Match, FLOOR } from "../src/engine/combat";
import { neutral } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import { GameSession } from "../src/game/session";
import { elasticGeometry, placeElastic } from "../src/engine/elastic";
import elastic from "../src/data/luffy-elastic.json";
import { selectionScreen } from "../src/ui/screens";
import { ONLINE_CHARACTERS } from "../src/net/protocol";

describe("Luffy local roster", () => {
  it("registers Luffy in training, versus and LAN", () => {
    expect(characterById("luffy")).toBe(characters.luffy);
    expect(ONLINE_CHARACTERS).toContain("luffy");
    expect(selectionScreen("training")).toContain('value="luffy"');
    expect(selectionScreen("versus")).toContain('value="luffy"');
    expect(selectionScreen("arcade")).not.toContain('value="luffy"');
    for (const invalid of ["__proto__", "toString", "luffy-gear5"])
      expect(() => characterById(invalid)).toThrow("Unknown character");
  });
  it.each(["training", "versus"] as const)(
    "runs %s without substituting another fighter",
    (mode) => {
      const session = new GameSession(mode, "easy", "luffy", "samurai");
      session.match.phase = "fight";
      const f = session.match.fighters[0],
        start = f.x;
      for (let i = 0; i < 12; i++) session.step({ ...neutral(), direction: 1 });
      expect(f.x).toBeGreaterThan(start);
      expect(f.data.id).toBe("luffy");
      expect(f.move).toBeUndefined();
      session.step({ ...neutral(), pressed: ["jump"] });
      for (let i = 0; i < 14; i++) session.step(neutral());
      expect(f.y).toBeLessThan(FLOOR);
    },
  );
  it("keeps grab and Super reserved", () => {
    const m = new Match(
      characters.luffy,
      { training: true },
      characters.samurai,
    );
    m.phase = "fight";
    const f = m.fighters[0];
    f.meter = 100;
    f.x = 500;
    m.fighters[1].x = 570;
    for (const button of [
      "throw",
      "ultimate",
    ] as const) {
      m.step([{ ...neutral(), pressed: [button] }, neutral()]);
      expect(f.moveId).toBe("");
      expect(f.attackShapes()).toEqual([]);
    }
    expect(f.canStartSuper()).toBe(false);
    expect(m.fighters[1].health).toBe(1000);
    expect(m.capture).toBeFalsy();
    expect(m.roadRoller).toBeFalsy();
    expect(m.fury).toBeFalsy();
  });
  it("can receive existing combat damage and restore a deterministic checkpoint", () => {
    const m = new Match(
      characters.samurai,
      { training: true },
      characters.luffy,
    );
    m.phase = "fight";
    m.fighters[0].x = 500;
    m.fighters[1].x = 565;
    m.step([{ ...neutral(), pressed: ["light"] }, neutral()]);
    for (let i = 0; i < 30; i++) m.step([neutral(), neutral()]);
    expect(m.fighters[1].health).toBeLessThan(1000);
    const replay = restore(snapshot(m));
    for (let i = 0; i < 80; i++) {
      const inputs = [
        neutral(),
        { ...neutral(), direction: -1 as const },
      ] as const;
      m.step([...inputs]);
      replay.step([...inputs]);
      expect(hashState(snapshot(replay))).toBe(hashState(snapshot(m)));
    }
  });
});

describe("elastic limb foundation, without a pretend attack", () => {
  const pose = {
    root: elastic.root,
    tip: { x: 216, y: -92 },
    radius: elastic.radius,
    bend: 8,
    maximumLength: elastic.maximumLength,
    active: false,
  };
  it("samples a connected pixel contour with a stable thickness and no active hitbox", () => {
    const g = elasticGeometry(pose);
    expect(g.centers[0]).toEqual(pose.root);
    expect(g.tip).toEqual(pose.tip);
    expect(g.hitboxes).toEqual([]);
    expect(elastic.combatEnabled).toBe(false);
    expect(g.radii.every((r) => r >= 2 && r <= 3)).toBe(true);
    expect(
      g.centers.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y)),
    ).toBe(true);
    for (let i = 1; i < g.centers.length; i++)
      expect(
        Math.hypot(
          g.centers[i].x - g.centers[i - 1].x,
          g.centers[i].y - g.centers[i - 1].y,
        ),
      ).toBeLessThanOrEqual(10);
  });
  it("limits reach, mirrors the tip and collision capsules with the same transform", () => {
    const g = elasticGeometry({
      ...pose,
      tip: { x: 9999, y: -90 },
      active: true,
    });
    expect(g.tip.x).toBe(pose.root.x + elastic.maximumLength);
    const right = placeElastic(g, { x: 600, y: 580 }, 1),
      left = placeElastic(g, { x: 600, y: 580 }, -1);
    expect(right.tip.x + left.tip.x).toBe(1200);
    expect(left.hitboxes[0].a).toEqual(left.tip);
    expect(right.hitboxes[0].b.x + left.hitboxes[0].b.x).toBe(1200);
    expect(left.hitboxes[0].r).toBe(6);
  });
  it("is deterministic and rejects malformed geometry", () => {
    expect(elasticGeometry(pose)).toEqual(
      elasticGeometry(structuredClone(pose)),
    );
    expect(() => elasticGeometry({ ...pose, radius: 0 })).toThrow(RangeError);
    expect(() => elasticGeometry({ ...pose, tip: { x: NaN, y: 0 } })).toThrow(
      RangeError,
    );
    expect(() => elasticGeometry({ ...pose, maximumLength: Infinity })).toThrow(
      RangeError,
    );
    expect(elasticGeometry({ ...pose, tip: pose.root }).centers).toHaveLength(
      2,
    );
  });
});
