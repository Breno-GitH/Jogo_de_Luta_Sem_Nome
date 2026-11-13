import { describe, expect, it } from "vitest";
import { FLOOR } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { GameSession } from "../src/game/session";
import { FighterPresentation } from "../src/render/presentation";
import { xebecAnimations } from "../src/render/xebec-animations";

const motions = [
  ["xebecRush", "forward"],
  ["xebecRising", "back"],
  ["xebecWave", "doubleDown"],
] as const;
const strengths = ["light", "medium", "heavy"] as const;

function training(gap: number, side: 1 | -1 = 1) {
  const session = new GameSession("training", "normal", "xebec", "samurai");
  session.training.infiniteHealth = session.training.unlimitedMeter = false;
  const [a, b] = session.match.fighters;
  a.meter = 0;
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  const view = new FighterPresentation(xebecAnimations);
  const step = (input: Partial<InputFrame> = {}) => {
    session.step({ ...neutral(), ...input });
    view.tick(a);
  };
  step();
  const command = (
    motion: (typeof motions)[number][1],
    strength: (typeof strengths)[number],
  ) => {
    step({ down: true });
    if (motion === "doubleDown") {
      step();
      step({ down: true, pressed: [strength] });
    } else {
      const direction = (motion === "forward" ? side : -side) as 1 | -1;
      step({ direction, down: true });
      step({ direction, pressed: [strength] });
    }
  };
  return { session, a, b, step, command, view };
}

describe("Xebec specials in Training", () => {
  it.each(
    motions.flatMap(([move, motion]) =>
      strengths.map((strength) => ({ move, motion, strength })),
    ),
  )(
    "recognizes $move $strength on both sides",
    ({ move, motion, strength }) => {
      for (const side of [1, -1] as const) {
        const { a, command, view } = training(150, side);
        command(motion, strength);
        const id = move + "_" + strength;
        expect(a.moveId).toBe(id);
        expect(a.meter).toBe(0);
        expect(view.animator.clipName).toBe(id);
        expect(view.animator.sprite()).toMatchObject({
          scale: 1.2,
          pivot: { x: 128, y: 224 },
        });
      }
    },
  );

  it("advances and hits once with the rush", () => {
    const { session, a, b, step, command } = training(175);
    const origin = a.x;
    command("forward", "heavy");
    for (let i = 0; i < 45 && !session.match.hitSerial; i++) step();
    expect(a.x - origin).toBeGreaterThan(45);
    expect(b.health).toBeLessThan(b.data.health);
    expect(session.match.hits.map((hit) => hit.move)).toEqual([
      "xebecRush_heavy",
    ]);
    for (let i = 0; i < 45; i++) step();
    expect(session.match.hitSerial).toBe(1);
  });

  it("catches an airborne opponent with the rising slash", () => {
    const { session, b, step, command } = training(66);
    b.y = FLOOR - 50;
    b.vy = -1;
    b.setState("air");
    command("back", "medium");
    for (let i = 0; i < 14 && !session.match.hitSerial; i++) step();
    expect(b.hitLaunch).toBe(true);
    expect(b.vy).toBeLessThan(-8);
    expect(session.match.events.some((event) => event.xebec?.rank === 2)).toBe(
      true,
    );
  });

  it("spawns one deterministic wave, then hits after recovery", () => {
    const { session, a, b, step, command } = training(915);
    command("doubleDown", "heavy");
    const m = session.match;
    const startup = a.move!.startup;
    for (let i = 0; i < startup - 1; i++) step();
    expect(m.kiProjectiles).toHaveLength(0);
    step();
    expect(m.kiProjectiles).toHaveLength(1);
    expect(m.kiProjectiles[0].radius).toBe(26);
    expect(a.canStartSpecial("xebecWave_light")).toBe(false);
    const restored = restore(snapshot(m));
    let firstHit: string | undefined;
    for (let i = 0; i < 70; i++) {
      step();
      restored.step([neutral(), neutral()]);
      expect(hashState(snapshot(restored))).toBe(hashState(snapshot(m)));
      if (!firstHit && m.hits.length) {
        expect(a.state).toBe("idle");
        firstHit = m.hits[0].move;
      }
    }
    expect(firstHit).toBe("xebecWave_heavy");
    expect(m.hitSerial).toBe(1);
    expect(b.health).toBeLessThan(b.data.health);
    expect(m.kiProjectiles).toHaveLength(0);
  });

  it("does not turn a held down input into a wave", () => {
    const { a, step } = training(80);
    step({ down: true });
    step({ down: true });
    step({ down: true, pressed: ["light"] });
    expect(a.moveId).toBe("crouch_light");
  });

  it("cancels a confirmed medium, but lets a whiff finish normally", () => {
    for (const gap of [55, 240]) {
      const { a, session, step, command } = training(gap);
      step({ pressed: ["medium"] });
      for (
        let i = 0;
        i < 15 && (a.stateFrame < 8 || session.match.hitstop);
        i++
      )
        step();
      expect(a.hitConfirmed).toBe(gap === 55);
      command("forward", "light");
      expect(a.moveId).toBe(gap === 55 ? "xebecRush_light" : "stand_medium");
    }
  });
});
