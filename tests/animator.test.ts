import { describe, expect, it } from "vitest";
import { Animator, type AnimationData } from "../src/render/animator";
import metadata from "../src/data/animations.json";

const atlas: AnimationData = {
  ...metadata,
  clips: {
    ...metadata.clips,
    idle: {
      sheet: "samurai/idle.png",
      frames: [0, 1, 2, 3, 4, 5],
      ticks: 8,
      durations: [10, 8, 8, 10, 8, 8],
      frameWidth: 256,
      frameHeight: 256,
      columns: 3,
      pivot: { x: 128, y: 208 },
      scale: 1,
    },
  },
};

describe("sprite animation metadata", () => {
  it("advances six different frames and wraps using the individual holds", () => {
    const animator = new Animator(atlas);
    for (const [index, duration] of [10, 8, 8, 10, 8, 8].entries()) {
      for (let tick = 0; tick < duration; tick++) {
        expect(animator.frame()).toBe(index);
        animator.update("idle");
      }
    }
    expect(animator.frame()).toBe(0);
  });

  it("uses the second atlas row without changing the source pivot", () => {
    const animator = new Animator(atlas);
    for (let tick = 0; tick < 26; tick++) animator.update("idle");
    expect(animator.sprite()).toEqual({
      sheet: "samurai/idle.png",
      x: 0,
      y: 256,
      width: 256,
      height: 256,
      pivot: { x: 128, y: 208 },
      scale: 1,
    });
  });

  it("uses the reused reaction/fallback pose and resets on state changes", () => {
    const animator = new Animator(atlas);
    for (let tick = 0; tick < 12; tick++) animator.update("idle");
    animator.update("attack");
    expect(animator.frame()).toBe(2);
    expect(animator.sprite().sheet).toBe("samurai/stand_heavy.png");
    expect(animator.sprite().width).toBe(256);
    animator.update("idle");
    expect(animator.frame()).toBe(0);
  });
});
