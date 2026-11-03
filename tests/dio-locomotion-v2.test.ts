import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { FighterPresentation } from "../src/render/presentation";
import animation from "../src/data/dio-animations.json";
import movement from "../src/data/dio-movement.json";
import { neutral, type InputFrame } from "../src/engine/types";
import gait from "../src/data/dio-gait.json";

function fixture() {
  const match = new Match(
    characters.dio,
    { training: true },
    characters.samurai,
  );
  match.phase = "fight";
  const [dio, enemy] = match.fighters;
  dio.x = 350;
  enemy.x = 1100;
  dio.stand!.s.x = dio.x - 30;
  const presentation = new FighterPresentation(animation);
  const step = (input: InputFrame = neutral()) => {
    match.step([input, neutral()]);
    presentation.tick(dio);
  };
  return { match, dio, enemy, presentation, step };
}
const input = (
  direction: -1 | 0 | 1 = 0,
  down = false,
  pressed: InputFrame["pressed"] = [],
): InputFrame => ({ direction, down, pressed });

describe("Dio revised locomotion in the actual combat simulation", () => {
  for (const direction of [1, -1] as const)
    it(`plants boots throughout a complete real ${direction === 1 ? "forward" : "backward"} walk`, () => {
      const { dio, step, presentation } = fixture(),
        key = direction === 1 ? "walkForward" : "walkBack";
      const frames: { x: number; frame: number }[] = [];
      for (let i = 0; i < 41; i++) {
        step(input(direction));
        frames.push({ x: dio.x, frame: presentation.animator.frame() });
      }
      expect(new Set(frames.map((f) => f.frame)).size).toBeGreaterThanOrEqual(18);
      const expectedSpeed =
        direction === 1 ? characters.dio.speed : -characters.dio.locomotion!.backSpeed;
      expect(dio.x - 350).toBeCloseTo(expectedSpeed * 41);
      let checks = 0;
      // A support ankle remains fixed in world space, not just at authored keys.
      // Both feet have a 20-tick support phase and a distinct lifted swing phase.
      for (let i = 1; i < frames.length; i++)
        for (const side of [0, 2]) {
          const a = frames[i - 1],
            b = frames[i];
          const p = gait[key].feet[a.frame],
            q = gait[key].feet[b.frame];
          if (
            p[side + 1] === (side === 0 ? 211 : 214) &&
            q[side + 1] === p[side + 1]
          ) {
            expect(Math.abs(a.x + p[side] - (b.x + q[side]))).toBeLessThan(
              1.05,
            );
            checks++;
          }
        }
      expect(checks).toBeGreaterThanOrEqual(25);
    });
  for (const direction of [0, 1, -1] as const)
    it(`selects jump poses from physics, with direction ${direction}`, () => {
      const { dio, step, presentation } = fixture(),
        seen = new Set<string>();
      step(input(direction, false, ["jump"]));
      for (let i = 0; i < characters.dio.locomotion!.jumpStartup; i++) {
        expect(dio.y).toBe(FLOOR);
        expect(presentation.animator.clipName).toBe("jumpStart");
        step();
      }
      for (let i = 0; i < 70; i++) {
        const clip = presentation.animator.clipName;
        seen.add(clip);
        if (clip === "landing") expect(dio.y).toBe(FLOOR);
        if (clip.startsWith("jumpFall")) expect(dio.y).toBeLessThan(FLOOR);
        if (clip.startsWith("jumpApex"))
          expect(Math.abs(dio.vy)).toBeLessThanOrEqual(3);
        if (dio.airborne) {
          expect(dio.stand!.transform.y).toBeLessThan(dio.y - 7);
          expect(dio.stand!.s.clip).toBe("jumpFollow");
        }
        step();
      }
      const suffix =
        direction === 0 ? "" : direction === 1 ? "Forward" : "Backward";
      for (const clip of ["jumpRise", "jumpApex", "jumpFall"])
        expect(seen.has(clip + suffix), clip).toBe(true);
      expect(seen.has("landing")).toBe(true);
      expect(dio.state).toBe("idle");
      expect(dio.y).toBe(FLOOR);
    });
  it("reverses a partial crouch without jumping directly to the standing pose", () => {
    for (const held of [1, 3, 5, 8, 12]) {
      const { step, presentation } = fixture();
      for (let i = 0; i < held; i++) step(input(0, true));
      step();
      expect(presentation.animator.clipName).toBe("crouchEnd");
      const first = presentation.animator.frame();
      expect(first).toBe(held < 3 ? 2 : held < 5 ? 1 : 0);
      for (let i = 0; i < 10; i++) step();
      expect(presentation.animator.clipName).toBe("idle");
    }
  });
  it("has anticipation, acceleration, travel and deceleration in both dashes", () => {
    for (const direction of [1, -1] as const) {
      const { dio, step, presentation } = fixture(),
        start = dio.x;
      const profile =
        direction === 1 ? characters.dio.locomotion!.dashForward : characters.dio.locomotion!.backdash;
      step(input(direction, false, ["dash"]));
      expect(dio.x).toBe(start);
      for (let i = 1; i < profile.length; i++) {
        step();
        expect(dio.vx).toBe(direction * profile[i]);
      }
      expect(dio.x - start).toBeCloseTo(
        direction * profile.reduce((s, v) => s + v, 0),
      );
      step();
      expect(dio.state).toBe("idle");
      expect(presentation.animator.clipName).toBe("idle");
    }
  });
  it("keeps the neutral Stand behind Dio with 3px bob and bounded turning steps", () => {
    const { dio, enemy, step } = fixture();
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < 140; i++) {
      step();
      const t = dio.stand!.transform;
      min = Math.min(min, t.y - dio.y);
      max = Math.max(max, t.y - dio.y);
      expect(t.depth).toBe(0);
      expect(dio.x - t.x).toBe(30);
    }
    expect(max - min).toBeGreaterThanOrEqual(5);
    expect(max - min).toBeLessThanOrEqual(6);
    enemy.x = 100;
    let x = dio.stand!.transform.x;
    for (let i = 0; i < 20; i++) {
      step();
      const t = dio.stand!.transform;
      expect(Math.abs(t.x - x)).toBeLessThanOrEqual(12);
      expect(t.depth).toBe(0);
      x = t.x;
    }
    expect(x).toBe(dio.x + 30);
  });
  it("still allows attacks to interrupt crouch, walk, dash, jump startup and landing", () => {
    for (const state of [
      "walk",
      "crouch",
      "dash",
      "jumpStart",
      "landing",
    ] as const) {
      const { dio, step, presentation } = fixture();
      dio.setState(state);
      step(input(0, false, ["light"]));
      expect(dio.state).toBe("attack");
      expect(presentation.animator.clipName).toBe("stand_light");
    }
  });
  it('keeps the crouched command pose when a low attack ends while S is held',()=>{
    const {dio,step,presentation}=fixture();step(input(0,true,['light']));
    for(let i=0;i<70;i++){
      step(input(0,true));
      if(dio.state==='crouch')expect(presentation.animator.clipName).toBe('crouchIdle');
    }
    expect(dio.state).toBe('crouch');
  });
  it('uses four combat-only lift drawings for a launcher jump without replacing locomotion art',()=>{
    const {dio,enemy,step,presentation,match}=fixture();enemy.x=dio.x+75;
    step(input(0,true,['heavy']));
    for(let i=0;i<100&&(!dio.canCancel('jump')||match.hitstop);i++)step();
    expect(dio.canCancel('jump')).toBe(true);step(input(0,false,['jump']));
    for(let i=0;i<4;i++){
      expect(presentation.animator.clipName).toBe('commandJumpLink');expect(presentation.animator.frame()).toBe(i);
      expect(dio.attackShapes()).toEqual([]);step();
    }
    expect(presentation.animator.clipName.startsWith('jump')).toBe(true);
  });
});
