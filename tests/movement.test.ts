import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { FighterPresentation } from "../src/render/presentation";
import { Animator, metadata } from "../src/render/animator";
import { neutral, type InputFrame } from "../src/engine/types";

function fixture() {
  const match = new Match();
  match.phase = "fight";
  match.fighters[0].x = 300;
  match.fighters[1].x = 1100;
  const presentation = new FighterPresentation();
  const step = (input: InputFrame = neutral()) => {
    match.step([input, neutral()]);
    presentation.tick(match.fighters[0]);
  };
  return { match, presentation, step, fighter: match.fighters[0] };
}

describe("movement phases and interruption", () => {
  it("restarts a consecutive dash even when no idle frame is rendered between them", () => {
    const { step, presentation } = fixture();
    step({ ...neutral(), direction: 1, pressed: ["dash"] });
    for (let i = 0; i < 12; i++) step({ ...neutral(), direction: 1 });
    expect(presentation.animator.frame()).toBe(4);
    step({ ...neutral(), direction: 1, pressed: ["dash"] });
    expect(presentation.animator.clipName).toBe("dashForward");
    expect(presentation.animator.frame()).toBe(0);
  });
  it("holds each crouch transition frame for exactly its declared duration", () => {
    const { step, presentation } = fixture();
    const frames: number[] = [];
    for (let i = 0; i < 6; i++) {
      step({ ...neutral(), down: true });
      frames.push(presentation.animator.frame());
    }
    expect(frames).toEqual([0, 0, 0, 1, 1, 1]);
    step({ ...neutral(), down: true });
    expect(presentation.animator.clipName).toBe("crouchIdle");
    for (let i = 0; i < 6; i++) step();
    expect(presentation.animator.clipName).toBe("crouchEnd");
    step();
    expect(presentation.animator.clipName).toBe("idle");
  });
  it("plays startup, rise, apex, fall and landing against the real physics", () => {
    const { fighter, step, presentation } = fixture();
    step({ ...neutral(), pressed: ["jump"] });
    expect(fighter.y).toBe(FLOOR);
    expect(fighter.state).toBe("jumpStart");
    const seen = new Set([presentation.animator.clipName]);
    for (let i = 0; i < 80; i++) {
      step();
      seen.add(presentation.animator.clipName);
    }
    for (const name of [
      "jumpStart",
      "jumpRise",
      "jumpApex",
      "jumpFall",
      "landing",
      "idle",
    ])
      expect(seen.has(name)).toBe(true);
    expect(fighter.y).toBe(FLOOR);
  });
  it("distinguishes walking and dashing relative to facing", () => {
    const { fighter, step, presentation } = fixture();
    step({ ...neutral(), direction: 1 });
    expect(presentation.animator.clipName).toBe("walkForward");
    step({ ...neutral(), direction: -1 });
    expect(presentation.animator.clipName).toBe("walkBack");
    step({ ...neutral(), direction: 1, pressed: ["dash"] });
    expect(presentation.animator.clipName).toBe("dashForward");
    for (let i = 0; i < 14; i++) step();
    step({ ...neutral(), direction: -1, pressed: ["dash"] });
    expect(presentation.animator.clipName).toBe("backdash");
    expect(fighter.facing).toBe(1);
  });
  it("enters, holds and leaves crouch without altering combat based on visual frames", () => {
    const { fighter, step, presentation } = fixture();
    step({ ...neutral(), down: true });
    expect(presentation.animator.clipName).toBe("crouchStart");
    expect(fighter.crouching).toBe(true);
    for (let i = 0; i < 9; i++) step({ ...neutral(), down: true });
    expect(presentation.animator.clipName).toBe("crouchIdle");
    step();
    expect(presentation.animator.clipName).toBe("crouchEnd");
    for (let i = 0; i < 9; i++) step();
    expect(presentation.animator.clipName).toBe("idle");
  });
  it("lets normal attacks interrupt dash, crouch startup, jump startup and landing", () => {
    for (const state of ["dash", "crouch", "jumpStart", "landing"] as const) {
      const { fighter, step, presentation } = fixture();
      fighter.setState(state);
      step({ ...neutral(), pressed: ["light"] });
      expect(fighter.state).toBe("attack");
      expect(presentation.animator.clipName).toBe("stand_light");
    }
  });
  it("damage cancels movement immediately through the collision system", () => {
    const { match, fighter, step, presentation } = fixture();
    match.fighters[1].x = 395;
    match.fighters[1].facing = -1;
    match.fighters[1].attack("stand_light");
    match.fighters[1].stateFrame = 4;
    fighter.setState("dash");
    fighter.dashDirection = 1;
    step();
    expect(fighter.state).toBe("hitstun");
    expect(presentation.animator.clipName).toBe("damageLight");
  });
  it("all locomotion sprites use the same origin and never use the temporary atlas", () => {
    for (const name of [
      "idle",
      "walkForward",
      "walkBack",
      "dashForward",
      "backdash",
      "crouchStart",
      "crouchIdle",
      "crouchEnd",
      "jumpStart",
      "jumpRise",
      "jumpApex",
      "jumpFall",
      "landing",
    ]) {
      const animator = new Animator();
      animator.update(name);
      const geometry = animator.sprite();
      expect(geometry.pivot).toEqual({ x: 128, y: 224 });
      expect(geometry.scale).toBe(1);
      expect(geometry.sheet).toMatch(/^samurai\/.+\.png$/);
    }
  });
  it("one-shot clips hold the final frame; loops wrap; frame stepping is exact", () => {
    for (const [name, clip] of Object.entries(metadata.clips)) {
      if (!("loop" in clip)) continue;
      const animator = new Animator();
      animator.update(name);
      const duration = clip.durations.reduce((a, b) => a + b, 0);
      for (let tick = 0; tick < duration + 20; tick++) animator.update(name);
      if (!clip.loop) expect(animator.frame()).toBe(clip.frames.at(-1));
      for (let i = 0; i < clip.frames.length; i++) {
        animator.seekFrame(i);
        expect(animator.frame()).toBe(clip.frames[i]);
      }
    }
  });
});
