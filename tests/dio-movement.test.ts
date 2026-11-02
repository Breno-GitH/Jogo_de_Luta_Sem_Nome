import { describe, it, expect } from "vitest";
import { DioMovement } from "../src/engine/dio-movement";
import { LinkedEntity } from "../src/engine/linked-entity";
import { FLOOR } from "../src/engine/combat";
import { neutral, type InputFrame } from "../src/engine/types";
import movement from "../src/data/dio-movement.json";
import data from "../src/data/the-world-visual.json";
import { Animator } from "../src/render/animator";
import dio from "../src/data/dio-animations.json";
import world from "../src/data/the-world-animations.json";

const input = (
  direction: -1 | 0 | 1 = 0,
  down = false,
  pressed: InputFrame["pressed"] = [],
): InputFrame => ({ direction, down, pressed });
describe("Dio locomotion and independently animated companion", () => {
  it("walks forwards/backwards without turning the guard and plays each crouch phase", () => {
    const d = new DioMovement();
    d.tick(input(1));
    expect(d.state).toBe("walkForward");
    expect(d.x).toBeCloseTo(520 + movement.walkSpeed);
    expect(d.facing).toBe(1);
    d.tick(input(-1));
    expect(d.state).toBe("walkBack");
    expect(d.x).toBeCloseTo(520 + movement.walkSpeed - movement.backSpeed);
    expect(d.facing).toBe(1);
    d.tick(input(0, true));
    expect(d.state).toBe("crouchStart");
    for (let i = 0; i < movement.crouchStartTicks; i++) d.tick(input(0, true));
    expect(d.state).toBe("crouchIdle");
    d.tick(neutral());
    expect(d.state).toBe("crouchEnd");
    for (let i = 0; i < movement.crouchEndTicks; i++) d.tick(neutral());
    expect(d.state).toBe("idle");
    d.turn();
    d.tick(input(-1));
    expect(d.state).toBe("walkForward");
  });
  it("plays all five jump phases, lands on the exact floor and carries the Stand in the air", () => {
    const d = new DioMovement(),
      w = new LinkedEntity(data, d),
      states = new Set<string>();
    d.tick(input(1, false, ["jump"]));
    w.tick();
    states.add(d.state);
    let highest = FLOOR,
      largestError = 0;
    for (let i = 0; i < 90; i++) {
      d.tick(neutral());
      w.tick();
      states.add(d.state);
      highest = Math.min(highest, d.y);
      const transform = w.transform;
      largestError = Math.max(
        largestError,
        Math.abs(transform.y - (d.y + data.hoverOffset.y)),
      );
      expect(transform.y).toBeLessThan(d.y - 8);
      if (d.airborne) expect(w.animation).toBe("jumpFollow");
    }
    expect([...states]).toEqual(
      expect.arrayContaining([
        "jumpStart",
        "jumpRise",
        "jumpApex",
        "jumpFall",
        "landing",
        "idle",
      ]),
    );
    expect(highest).toBeLessThan(FLOOR - 140);
    expect(d.y).toBe(FLOOR);
    expect(d.vy).toBe(0);
    expect(largestError).toBeLessThanOrEqual(data.maxLagY + 3.6);
  });
  it("accelerates and decelerates each dash and allows a jump to interrupt", () => {
    for (const direction of [1, -1] as const) {
      const d = new DioMovement(),
        start = d.x;
      d.tick(input(direction, false, ["dash"]));
      expect(d.state).toBe(direction === 1 ? "dashForward" : "backdash");
      const velocities =
        direction === 1 ? movement.dashForward : movement.backdash;
      for (let i = 1; i < velocities.length; i++) d.tick(neutral());
      expect(d.x - start).toBe(
        direction * velocities.reduce((s, v) => s + v, 0),
      );
      d.tick(neutral());
      expect(d.state).toBe("idle");
      d.tick(input(direction, false, ["dash"]));
      d.tick(input(0, false, ["jump"]));
      expect(d.state).toBe("jumpStart");
    }
  });
  it("bounds follow lag while walking/dashing and settles 25–35 pixels behind", () => {
    const d = new DioMovement(),
      w = new LinkedEntity(data, d),
      clips = new Set<string>();
    for (let i = 0; i < 200; i++) {
      d.tick(
        i < 30
          ? input(1)
          : i < 60
            ? input(-1)
            : i === 60
              ? input(1, false, ["dash"])
              : neutral(),
      );
      w.tick();
      clips.add(w.animation);
      expect(Math.abs(w.transform.x - w.reference.x)).toBeLessThanOrEqual(
        data.maxLagX + 0.5,
      );
      expect(w.transform.depth).toBe(0);
    }
    expect([...clips]).toEqual(
      expect.arrayContaining([
        "followForward",
        "followBackward",
        "dashFollow",
        "returnPosition",
        "standIdle",
        "floating",
      ]),
    );
    expect(d.x - w.transform.x).toBeGreaterThanOrEqual(25);
    expect(d.x - w.transform.x).toBeLessThanOrEqual(35);
  });
  it("crosses behind the owner on a turn with bounded steps and mirrored targets", () => {
    const d = new DioMovement(),
      w = new LinkedEntity(data, d);
    let previous = w.transform.x;
    d.turn();
    expect(w.reference.x).toBe(d.x + 30);
    for (let i = 0; i < data.turnTicks + 5; i++) {
      w.tick();
      expect(Math.abs(w.transform.x - previous)).toBeLessThanOrEqual(12);
      previous = w.transform.x;
      expect(w.transform.depth).toBe(0);
      expect(w.transform.facing).toBe(-1);
    }
    expect(w.transform.x).toBe(d.x + 30);
  });
  it("can advance all actual atlas cells with exact per-frame holds independently", () => {
    for (const data of [dio, world])
      for (const [name, clip] of Object.entries(data.clips)) {
        if (name === "base" || name === "hover") continue;
        const a = new Animator(data);
        a.update(name, true);
        for (let frame = 0; frame < clip.frames.length; frame++) {
          a.seekFrame(frame);
          expect(a.frame()).toBe(clip.frames[frame]);
          const start = clip.durations
            .slice(0, frame)
            .reduce((s, v) => s + v, 0);
          for (let tick = 0; tick < clip.durations[frame]; tick++) {
            a.seekTick(start + tick);
            expect(a.frame()).toBe(clip.frames[frame]);
          }
        }
      }
  });
});
