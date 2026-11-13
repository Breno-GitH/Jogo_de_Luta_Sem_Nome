import { describe, expect, it } from "vitest";
import { xebecAnimations as animations } from "../src/render/xebec-animations";
import { GameSession } from "../src/game/session";
import { FLOOR } from "../src/engine/combat";
import { neutral, type Button, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { selectionScreen } from "../src/ui/screens";
import { ONLINE_CHARACTERS } from "../src/net/protocol";
import { xebecNormals } from "../src/engine/xebec";

function setup() {
  const session = new GameSession("training", "normal", "xebec", "samurai");
  const fighter = session.match.fighters[0];
  const view = new FighterPresentation(animations);
  function advance(count: number, input: Partial<InputFrame> = {}) {
    const clips = new Set<string>();
    const frames = new Set<number>();
    for (let tick = 0; tick < count; tick++) {
      session.step({
        ...neutral(),
        ...input,
        pressed: tick === 0 ? (input.pressed ?? []) : [],
      });
      view.tick(fighter);
      clips.add(view.animator.clipName);
      frames.add(view.animator.frame());
    }
    return { clips: [...clips], frames: [...frames] };
  }
  return { fighter, advance, view, session };
}

describe("Xebec movement preview", () => {
  it("appears as a selectable fighter in all supported modes", () => {
    expect(selectionScreen("training")).toContain('value="xebec"');
    expect(
      selectionScreen("training", "xebec", "dio", "opponent"),
    ).toContain('value="xebec"');
    expect(selectionScreen("versus")).toContain('value="xebec"');
    expect(selectionScreen("arcade")).toContain('value="xebec"');
    expect(ONLINE_CHARACTERS).toContain("xebec");
  });

  it("uses the same enlarged scale and floor pivot across movement clips", () => {
    const { advance, fighter, view } = setup();
    for (const clip of Object.keys(animations.clips)) {
      view.animator.update(clip);
      expect(view.animator.sprite()).toMatchObject({
        scale: 1.2,
        pivot: { x: 128, y: 224 },
      });
    }
    expect(fighter.y).toBe(FLOOR);
    expect(fighter.hurtbox()).toMatchObject({ y: FLOOR - 154, h: 154 });
    advance(12, { down: true });
    expect(fighter.hurtbox()).toMatchObject({ y: FLOOR - 106, h: 106 });
    advance(12, { pressed: ["jump"] });
    expect(fighter.airborne).toBe(true);
    expect(fighter.hurtbox().y).toBeCloseTo(fighter.y - 138);
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
    expect(advance(20, { down: true }).clips).toEqual([
      "crouchStart",
      "crouchIdle",
    ]);
    expect(advance(12).clips).toEqual(["crouchEnd", "idle"]);
  });

  it("draws anticipation, all airborne phases and landing in order", () => {
    const { advance } = setup();
    const jump = advance(65, { direction: 1, pressed: ["jump"] });
    expect(jump.clips).toEqual([
      "jumpStart",
      "jumpRise",
      "jumpApex",
      "jumpFall",
      "landing",
      "walkForward",
    ]);
    expect(jump.frames).toEqual(
      expect.arrayContaining([7, 8, 9, 10, 11, 12, 0]),
    );
  });

  it("uses distinct dash and backdash poses with signed displacement", () => {
    const { advance, fighter } = setup();
    const origin = fighter.x;
    expect(advance(13, { direction: 1, pressed: ["dash"] }).frames).toEqual([
      13, 14, 15,
    ]);
    const forward = fighter.x;
    expect(forward - origin).toBeGreaterThan(100);
    advance(2);
    expect(advance(13, { direction: -1, pressed: ["dash"] }).frames).toEqual([
      16, 17, 18, 0,
    ]);
    expect(fighter.x).toBeLessThan(forward);
  });

  it.each(Object.keys(xebecNormals) as (keyof typeof xebecNormals)[])(
    "%s displays every phase and hits only on its contact drawing",
    (id) => {
      const { advance, fighter, view, session } = setup();
      const [stance, strength] = id.split("_");
      session.training.infiniteHealth = false;
      const target = session.match.fighters[1];
      fighter.x = 600;
      target.x = 659;
      if (stance === "air") {
        fighter.y = FLOOR - 110;
        target.y = FLOOR - (id === "air_heavy" ? 50 : 103);
        fighter.vy = target.vy = -2;
        fighter.setState("air");
        target.setState("air");
      }
      const normal = xebecNormals[id];
      const pressed = [strength as Button];
      const down = stance === "crouch";
      advance(1, { pressed, down });
      expect(fighter.moveId).toBe(id);
      expect(view.animator.frame()).toBe(normal.frames[0]);
      expect(fighter.attackShapes()).toHaveLength(0);
      for (
        let tick = 0;
        tick < normal.holds[0] + 2 && !fighter.hitConfirmed;
        tick++
      )
        advance(1, { down });
      expect(view.animator.frame()).toBe(normal.frames[1]);
      expect(fighter.hitConfirmed).toBe(true);
      expect(target.health).toBeLessThan(target.data.health);
      expect(fighter.attackShapes()).toHaveLength(1);
      advance(40, { down });
      expect(fighter.attackShapes()).toHaveLength(0);
    },
  );

  it.each([false, true])(
    "finishes the light, medium and heavy route (air: %s)",
    (air) => {
      const { advance, fighter, session } = setup();
      session.training.infiniteHealth = false;
      fighter.x = 600;
      session.match.fighters[1].x = 655;
      const buttons: Button[] = air
        ? ["heavy", "jump", "light", "medium", "heavy"]
        : ["light", "medium", "heavy"];
      const hits: string[] = [];
      let command = 0;
      for (let tick = 0; tick < 100; tick++) {
        const before = session.match.hitSerial;
        const next = buttons[command];
        const firstAirAttack = air && command === 2;
        const ready =
          command === 0 ||
          (firstAirAttack
            ? fighter.airborne
            : !session.match.hitstop && fighter.canCancel(next));
        const pressed = next && ready ? [buttons[command++]] : [];
        advance(1, { pressed, down: air && command < 3 });
        if (session.match.hitSerial > before) hits.push(fighter.moveId);
      }
      expect(hits).toEqual(
        air
          ? ["crouch_heavy", "air_light", "air_medium", "air_heavy"]
          : ["stand_light", "stand_medium", "stand_heavy"],
      );
    },
  );
});
