import { describe, expect, it } from "vitest";
import animations from "../src/data/xebec-animations.json";
import { GameSession } from "../src/game/session";
import { neutral, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { selectionScreen } from "../src/ui/screens";
import { ONLINE_CHARACTERS } from "../src/net/protocol";

function setup() {
  const session = new GameSession("training", "normal", "xebec", "samurai");
  const fighter = session.match.fighters[0];
  const view = new FighterPresentation(animations);
  function advance(count: number, input: Partial<InputFrame> = {}) {
    const clips = new Set<string>();
    const frames = new Set<number>();
    for (let tick = 0; tick < count; tick++) {
      session.step({ ...neutral(), ...input, pressed: tick === 0 ? input.pressed ?? [] : [] });
      view.tick(fighter);
      clips.add(view.animator.clipName);
      frames.add(view.animator.frame());
    }
    return { clips: [...clips], frames: [...frames] };
  }
  return { fighter, advance };
}

describe("Xebec movement preview", () => {
  it("appears as a selectable fighter in training only", () => {
    expect(selectionScreen("training")).toContain('value="xebec"');
    expect(selectionScreen("training", "xebec", "dio", "opponent")).not.toContain('value="xebec"');
    expect(selectionScreen("versus")).not.toContain('value="xebec"');
    expect(selectionScreen("arcade")).not.toContain('value="xebec"');
    expect(ONLINE_CHARACTERS).not.toContain("xebec");
  });

  it("plays six walk poses in each direction and enters, holds and releases crouch", () => {
    const { advance, fighter } = setup();
    const origin = fighter.x;
    expect(advance(1).clips).toEqual(["idle"]);
    expect(advance(30, { direction: 1 }).frames).toEqual([1, 2, 3, 4, 5, 6]);
    const forward = fighter.x;
    expect(forward).toBeGreaterThan(origin);
    expect(advance(36, { direction: -1 }).frames).toEqual([4, 3, 2, 1, 6, 5]);
    expect(fighter.x).toBeLessThan(forward);
    expect(advance(20, { down: true }).clips).toEqual(["crouchStart", "crouchIdle"]);
    expect(advance(12).clips).toEqual(["crouchEnd", "idle"]);
  });

  it("draws anticipation, all airborne phases and landing in order", () => {
    const { advance } = setup();
    const jump = advance(65, { direction: 1, pressed: ["jump"] });
    expect(jump.clips).toEqual(["jumpStart", "jumpRise", "jumpApex", "jumpFall", "landing", "walkForward"]);
    expect(jump.frames).toEqual(expect.arrayContaining([7, 8, 9, 10, 11, 12, 0]));
  });

  it("uses distinct dash and backdash poses with signed displacement", () => {
    const { advance, fighter } = setup();
    const origin = fighter.x;
    expect(advance(13, { direction: 1, pressed: ["dash"] }).frames).toEqual([13, 14, 15]);
    const forward = fighter.x;
    expect(forward - origin).toBeGreaterThan(100);
    advance(2);
    expect(advance(13, { direction: -1, pressed: ["dash"] }).frames).toEqual([16, 17, 18, 0]);
    expect(fighter.x).toBeLessThan(forward);
  });
});
