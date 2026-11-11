import { describe, expect, it } from "vitest";
import { characterPreviews } from "../src/engine/character-previews";
import { characters } from "../src/engine/characters";
import { kaguneIds, Rinkaku } from "../src/engine/kagune";
import { ONLINE_CHARACTERS } from "../src/net/protocol";
import { Animator } from "../src/render/animator";

const position = { x: 256, y: 154 };

describe("Kaneki visual registration", () => {
  it("plays all six authored drawings with the common animator and registers for matches", () => {
    const actor = characterPreviews.kaneki;
    const animator = new Animator(actor.animations);
    const clip = actor.animations.clips.idle;
    for (let i = 0; i < clip.frames.length; i++) {
      animator.seekFrame(i);
      expect(animator.frame()).toBe(i);
      expect(animator.sprite()).toMatchObject({
        scale: 1,
        pivot: { x: 128, y: 224 },
      });
      expect(actor.lumbar[i].y).toBeLessThan(-60);
    }
    animator.seekTick(
      clip.durations.reduce((sum, duration) => sum + duration, 0),
    );
    expect(animator.frame()).toBe(0);
    expect(characters.kaneki.id).toBe(actor.id);
    expect(characters.kaneki.moves.throw.kind).toBe("grab");
    expect(ONLINE_CHARACTERS).toContain(actor.id);
  });
});

describe("Rinkaku", () => {
  it("supplies four distinct anchored curves, real volume and independent idle motion", () => {
    const controller = new Rinkaku();
    const before = controller.poses(position, 1);
    expect(before.map((p) => p.id)).toEqual(kaguneIds);
    expect(new Set(before.map((p) => JSON.stringify(p.origin))).size).toBe(4);
    expect(new Set(before.map((p) => Math.round(p.length))).size).toBe(4);
    for (let i = 0; i < 19; i++) controller.step();
    const after = controller.poses(position, 1);
    expect(
      new Set(
        after.map((p, i) => Math.round((p.tip.y - before[i].tip.y) * 100)),
      ).size,
    ).toBe(4);
    for (const [i, pose] of after.entries()) {
      expect(pose.origin).toEqual(before[i].origin);
      expect(pose.spine[0]).toEqual(pose.origin);
      expect(pose.spine.at(-1)).toEqual(pose.tip);
      expect(pose.radius[0]).toBeGreaterThan(9);
      expect(pose.radius.at(-1)).toBeLessThan(1);
    }
  });

  it("mirrors the entire path and follows the lumbar anchor on the next drawing", () => {
    const controller = new Rinkaku();
    controller.move("upperFront", 1.7, 0);
    for (let i = 0; i < 29; i++) controller.step();
    const right = controller.poses(position, 1);
    const left = controller.poses({ x: position.x, y: position.y + 3 }, -1);
    for (const [i, pose] of right.entries()) {
      for (const [j, p] of pose.spine.entries()) {
        expect(p.x + left[i].spine[j].x).toBeCloseTo(position.x * 2);
        expect(left[i].spine[j].y - p.y).toBeCloseTo(3);
      }
      expect(left[i].length).toBeCloseTo(pose.length);
    }
  });

  it("extends one limb, then retracts every limb and clears temporary front layers on interruption", () => {
    const controller = new Rinkaku();
    const start = controller.poses(position, 1)[3].length;
    controller.setLayer("lowerFront", "front");
    controller.move("lowerFront", 2, 20);
    for (let i = 0; i < 10; i++) controller.step();
    const mid = controller.poses(position, 1);
    expect(
      mid.slice(0, 3).every((p) => p.phase === "idle" && p.layer === "behind"),
    ).toBe(true);
    expect(mid[3]).toMatchObject({ phase: "extending", layer: "front" });
    expect(mid[3].length).toBeGreaterThan(start);
    for (let i = 0; i < 10; i++) controller.step();
    const extended = controller.poses(position, 1)[3];
    expect(extended.phase).toBe("extended");
    expect(extended.length).toBeGreaterThan(mid[3].length);
    controller.interrupt(14);
    expect(
      controller
        .poses(position, 1)
        .every((p) => p.phase === "retracting" && p.layer === "behind"),
    ).toBe(true);
    for (let i = 0; i < 14; i++) controller.step();
    expect(
      controller
        .poses(position, 1)
        .every((p) => p.phase === "folded" && p.length < 60),
    ).toBe(true);
  });
});
