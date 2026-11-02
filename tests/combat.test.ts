import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { neutral, overlaps, type InputFrame } from "../src/engine/types";
import { CommandBuffer } from "../src/engine/input";
const input = (
  direction: -1 | 0 | 1 = 0,
  down = false,
  pressed: InputFrame["pressed"] = [],
): InputFrame => ({ direction, down, pressed });
function match() {
  const m = new Match();
  m.phase = "fight";
  m.fighters[0].x = 500;
  m.fighters[1].x = 600;
  return m;
}
function advance(m: Match, n: number, a = neutral(), b = neutral()) {
  for (let i = 0; i < n; i++) m.step([a, b]);
}
describe("combat simulation", () => {
  it("directional specials have strength variants without ultimate energy cost", () => {
    const m = match();
    m.fighters[0].meter = 60;
    m.step([input(0, true), neutral()]);
    m.step([input(1, true), neutral()]);
    m.step([input(1, false, ["heavy"]), neutral()]);
    expect(m.fighters[0].moveId).toBe("draw_heavy");
    expect(m.fighters[0].meter).toBe(60);
  });
  it("does not activate the ultimate without enough meter", () => {
    const m = match();
    m.fighters[0].meter = 99;
    m.step([input(0, false, ["ultimate"]), neutral()]);
    expect(m.fighters[0].state).toBe("idle");
    expect(m.fighters[0].meter).toBe(99);
  });
  it("distinguishes forward dash and backdash speed", () => {
    const forward = match(),
      backward = match();
    forward.step([input(1, false, ["dash"]), neutral()]);
    backward.step([input(-1, false, ["dash"]), neutral()]);
    expect(forward.fighters[0].x).toBe(514);
    expect(backward.fighters[0].x).toBe(489);
  });
  it("a launcher followed by jump and air light produces a real aerial combo", () => {
    const m = match();
    m.step([input(0, true, ["heavy"]), neutral()]);
    while (!m.fighters[0].connected) m.step([neutral(), neutral()]);
    while (m.hitstop > 0) m.step([neutral(), neutral()]);
    m.step([input(0, false, ["jump"]), neutral()]);
    m.step([input(0, false, ["light"]), neutral()]);
    advance(m, 5);
    expect(m.fighters[1].combo).toBe(2);
    expect(m.fighters[1].health).toBeLessThan(890);
  });
  it("applies a single hit per move and hitstop freezes combat", () => {
    const m = match();
    m.step([input(0, false, ["light"]), neutral()]);
    advance(m, 5);
    expect(m.fighters[1].health).toBe(955);
    const frame = m.fighters[0].stateFrame;
    advance(m, 3);
    expect(m.fighters[0].stateFrame).toBe(frame);
    advance(m, 30);
    expect(m.fighters[1].health).toBe(955);
  });
  it("standing defense blocks mid attacks without damage", () => {
    const m = match();
    m.fighters[1].data = { ...m.fighters[1].data, speed: 0 };
    m.step([input(0, false, ["light"]), input(1)]);
    advance(m, 5, neutral(), input(1));
    expect(m.fighters[1].health).toBe(1000);
    expect(m.fighters[1].state).toBe("blockstun");
  });
  it("low attacks beat standing guard but crouching guard blocks", () => {
    for (const down of [false, true]) {
      const m = match();
      m.step([input(0, true, ["light"]), input(1, down)]);
      advance(m, 5, neutral(), input(1, down));
      expect(m.fighters[1].health).toBe(down ? 1000 : 960);
    }
  });
  it("throws bypass defense", () => {
    const m = match();
    m.fighters[1].x = 565;
    m.fighters[1].data = { ...m.fighters[1].data, speed: 0 };
    m.step([input(0, false, ["throw"]), input(1)]);
    advance(m, 5, neutral(), input(1));
    advance(m, 55);
    expect(m.fighters[1].health).toBe(880);
  });
  it("launcher can jump cancel and chain aerial attacks", () => {
    const m = match();
    m.step([input(0, true, ["heavy"]), neutral()]);
    while (!m.fighters[0].connected) m.step([neutral(), neutral()]);
    expect(m.fighters[1].vy).toBeLessThan(0);
    while (m.hitstop > 0) m.step([neutral(), neutral()]);
    m.step([input(0, false, ["jump"]), neutral()]);
    expect(m.fighters[0].airborne).toBe(true);
    expect(m.fighters[0].state).toBe("air");
    m.step([input(0, false, ["light"]), neutral()]);
    expect(m.fighters[0].moveId).toBe("air_light");
  });
  it("prevents cancel on whiff", () => {
    const m = match();
    m.fighters[1].x = 1000;
    m.step([input(0, false, ["light"]), neutral()]);
    m.step([input(0, false, ["heavy"]), neutral()]);
    expect(m.fighters[0].moveId).toBe("stand_light");
  });
  it("separates pushboxes and clamps stage boundaries", () => {
    const m = match();
    m.fighters[1].x = 510;
    advance(m, 3);
    expect(overlaps(m.fighters[0].pushbox(), m.fighters[1].pushbox())).toBe(
      false,
    );
    advance(m, 150, input(-1));
    expect(m.fighters[0].x).toBe(40);
  });
  it("jump returns to the floor", () => {
    const m = match();
    m.step([input(0, false, ["jump"]), neutral()]);
    expect(m.fighters[0].state).toBe("jumpStart");
    expect(m.fighters[0].y).toBe(FLOOR);
    advance(m, 4);
    expect(m.fighters[0].y).toBeLessThan(FLOOR);
    advance(m, 100);
    expect(m.fighters[0].y).toBe(FLOOR);
  });
  it("awards rounds, resets health, and ends at two wins", () => {
    const m = match();
    m.fighters[1].health = 0;
    m.step([neutral(), neutral()]);
    expect(m.wins).toEqual([1, 0]);
    advance(m, 250);
    expect(m.phase).toBe("fight");
    expect(m.fighters[1].health).toBe(1000);
    m.fighters[1].health = 0;
    m.step([neutral(), neutral()]);
    advance(m, 150);
    expect(m.phase).toBe("finished");
  });
  it("uses timeout and handles a draw", () => {
    const m = match();
    m.timer = 1;
    m.step([neutral(), neutral()]);
    expect(m.message).toBe("EMPATE");
    expect(m.wins).toEqual([0, 0]);
  });
  it("replays the same input frames deterministically", () => {
    const a = match(),
      b = match();
    for (let i = 0; i < 300; i++) {
      const inputs: [InputFrame, InputFrame] = [
        input(i % 90 < 45 ? 1 : -1, false, i % 30 === 0 ? ["light"] : []),
        input(-1, i % 80 < 40, i % 43 === 0 ? ["heavy"] : []),
      ];
      a.step(inputs);
      b.step(inputs);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
describe("command buffer", () => {
  it("recognizes directional commands relative to facing", () => {
    for (const facing of [1, -1]) {
      const b = new CommandBuffer();
      b.push(input(0, true), 1, facing);
      b.push(input(facing as -1 | 1, true), 4, facing);
      b.push(input(facing as -1 | 1), 7, facing);
      expect(b.quarterCircle()).toBe(true);
    }
  });
  it("expires old button inputs", () => {
    const b = new CommandBuffer();
    b.push(input(0, false, ["light"]), 0, 1);
    b.push(neutral(), 9, 1);
    expect(b.consume("light")).toBe(false);
  });
});
