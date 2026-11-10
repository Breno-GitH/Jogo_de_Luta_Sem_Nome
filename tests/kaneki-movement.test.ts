import { describe, expect, it } from "vitest";
import { FLOOR, Match } from "../src/engine/combat";
import { kanekiMotion } from "../src/engine/kaneki-motion";
import { kaguneCaptureStates, Rinkaku } from "../src/engine/kagune";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  KanekiPresentation,
  kanekiAnimations,
  kanekiClipTicks,
} from "../src/render/kaneki-presentation";

function practice(side: 1 | -1) {
  const match = new Match(kanekiMotion, { training: true }, kanekiMotion);
  match.phase = "fight";
  const [actor, opponent] = match.fighters;
  actor.x = 620;
  actor.facing = side;
  opponent.x = 620 + side * 470;
  const presentation = new KanekiPresentation(actor);
  function step(input: Partial<InputFrame> = {}) {
    match.step([{ ...neutral(), ...input }, neutral()]);
    presentation.step(actor);
    return presentation.clip;
  }
  return { actor, opponent, presentation, step };
}

describe("Kaneki locomotion presentation on the existing Match", () => {
  for (const side of [1, -1] as const) {
    it.each([true, false])(
      "plants each support foot through a half-stride when facing " +
        side +
        " (forward %s)",
      (forward) => {
        const { actor, presentation: p, step } = practice(side);
        const clip = forward ? "walkForward" : "walkBack";
        const direction = (forward ? side : -side) as 1 | -1;
        const frames = new Set();
        const soles = [];
        for (let tick = 0; tick < kanekiClipTicks(clip); tick++) {
          expect(step({ direction })).toBe(clip);
          expect(actor.y).toBe(FLOOR);
          frames.add(p.animator.frame());
          expect(p.planted).not.toBeNull();
          soles.push(actor.x + side * (p.offset + p.planted!));
        }
        expect(frames.size).toBe(6);
        const half = soles.length / 2;
        for (const plant of [soles.slice(0, half), soles.slice(half)]) {
          expect(Math.max(...plant) - Math.min(...plant)).toBeLessThan(1.01);
        }
        expect(step({ direction: -direction as 1 | -1 })).toBe(
          forward ? "walkBack" : "walkForward",
        );
        expect(p.offset).toBe(0);
        expect(step()).toBe("idle");
      },
    );

    it.each([true, false])(
      "displays all dash poses when facing " + side + " (forward %s)",
      (forward) => {
        const { actor, presentation: p, step } = practice(side);
        const clip = forward ? "dashForward" : "backdash";
        const speeds = kanekiMotion.locomotion![clip];
        const frames = new Set();
        for (let tick = 0; tick < speeds.length; tick++) {
          expect(
            step(
              tick
                ? {}
                : {
                    direction: (forward ? side : -side) as 1 | -1,
                    pressed: ["dash"],
                  },
            ),
          ).toBe(clip);
          frames.add(p.animator.frame());
        }
        expect(frames.size).toBe(5);
        expect(Math.abs(actor.x - 620)).toBeCloseTo(
          speeds.reduce((sum, speed) => sum + Math.abs(speed), 0),
        );
        expect(step()).toBe("idle");
      },
    );
  }

  it.each([-1, 0, 1] as const)(
    "passes all five jump phases with direction %d",
    (direction) => {
      const { actor, presentation: p, step } = practice(1);
      const frames = new Map<string, Set<number>>();
      for (let i = 0; i < 58; i++) {
        const clip = step({ direction, pressed: i === 0 ? ["jump"] : [] });
        if (clip === "idle" || clip.startsWith("walk")) continue;
        const set = frames.get(clip) ?? new Set();
        set.add(p.animator.frame());
        frames.set(clip, set);
      }
      expect([...frames.keys()]).toEqual([
        "jumpStart",
        "jumpRise",
        "jumpApex",
        "jumpFall",
        "landing",
      ]);
      expect([...frames.values()].map((set) => set.size)).toEqual([
        3, 2, 1, 2, 3,
      ]);
      expect(actor.y).toBe(FLOOR);
      expect(Math.sign(actor.x - 620)).toBe(direction);
    },
  );

  it("lowers and rises through their own drawings and flips on the next grounded tick", () => {
    const { actor, opponent, presentation: p, step } = practice(1);
    const frames = new Map<string, Set<number>>();
    for (let i = 0; i < 49; i++) {
      const clip = step({ down: i < 35 });
      const set = frames.get(clip) ?? new Set();
      set.add(p.animator.frame());
      frames.set(clip, set);
    }
    expect([...frames.keys()]).toEqual([
      "crouchStart",
      "crouchIdle",
      "crouchEnd",
      "idle",
    ]);
    for (const clip of ["crouchStart", "crouchIdle", "crouchEnd"]) {
      expect([...frames.get(clip)!]).toEqual(
        kanekiAnimations.clips[clip].frames,
      );
    }
    opponent.x = actor.x - 200;
    expect(step({ direction: -1 })).toBe("walkForward");
    expect(actor.facing).toBe(-1);
  });

  it("uses per-drawing origins and clearance for four independent mirrored limbs", () => {
    const { actor, presentation: p, step } = practice(1);
    for (let i = 0; i < 150; i++) {
      step({
        pressed: i === 2 ? ["dash"] : i === 61 ? ["jump"] : [],
        direction: i < 20 ? 1 : 0,
        down: i >= 24 && i < 50,
      });
      const root = { x: actor.x + p.lumbar.x, y: actor.y + p.lumbar.y };
      const right = p.rinkaku.poses(root, 1, FLOOR);
      const left = p.rinkaku.poses(root, -1, FLOOR);
      expect(
        new Set(right.map((limb) => JSON.stringify(limb.origin))).size,
      ).toBe(4);
      for (const [index, limb] of right.entries()) {
        expect(limb.spine[0]).toEqual(limb.origin);
        for (const [j, point] of limb.spine.entries()) {
          expect(point.x + left[index].spine[j].x).toBeCloseTo(root.x * 2);
          expect(point.y).toBeCloseTo(left[index].spine[j].y);
          expect(point.y + limb.radius[j]).toBeLessThan(FLOOR);
        }
      }
    }
    const rinkaku = new Rinkaku();
    const root = { x: 0, y: 0 };
    const initial = rinkaku.poses(root, 1);
    rinkaku.step({ state: "dash", relativeVx: 20, vy: 0, tick: 1 });
    const trailing = rinkaku.poses(root, 1);
    expect(
      new Set(trailing.map((p, i) => Math.round(p.tip.x - initial[i].tip.x)))
        .size,
    ).toBe(4);
    for (const state of kaguneCaptureStates) {
      rinkaku.step({ state, relativeVx: 0, vy: 0, tick: 0 });
      expect(
        rinkaku.poses(root, 1).every((limb) => limb.motion === state),
      ).toBe(true);
    }
  });
});
