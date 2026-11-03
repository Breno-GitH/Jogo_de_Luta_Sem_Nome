import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import {
  luffyLimb,
  luffyMoves,
  luffyNormals,
} from "../src/engine/luffy-normals";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  shapeBounds,
  shapeHitsRect,
  worldCapsule,
} from "../src/engine/geometry";
import previousReach from "../src/data/luffy-previous-reach.json";
import { hashState, restore, snapshot } from "../src/engine/state";

function bout(id: "samurai" | "dio" | "goku", facing = 1, gap = 56) {
  const match = new Match(characters.luffy, { training: true }, characters[id]);
  const [luffy, rival] = match.fighters;
  match.phase = "fight";
  luffy.x = 500;
  rival.x = luffy.x + gap * facing;
  luffy.facing = facing;
  rival.facing = -facing;
  const tick = (
    input: Partial<InputFrame> = {},
    other: Partial<InputFrame> = {},
  ) =>
    match.step([
      { ...neutral(), ...input },
      { ...neutral(), ...other },
    ]);
  const run = (frames: number) => {
    for (let i = 0; i < frames; i++) tick();
  };
  return { match, luffy, rival, tick, run };
}

describe("Luffy normals", () => {
  it("does not hit beyond the extended fist", () => {
    const { rival, tick, run } = bout("samurai", -1, 430);
    tick({ pressed: ["heavy"] });
    run(60);
    expect(rival.health).toBe(1000);
  });

  it.each(Object.keys(previousReach))("%s connects at long range", (id) => {
    const { luffy, rival, tick } = bout("samurai");
    const spec = luffyNormals[id];
    const [reach, height] = spec.track[spec.active[1] - 1];
    luffy.y = id.startsWith("air") ? FLOOR - 230 : FLOOR;
    luffy.attack(id);
    luffy.stateFrame =
      luffy.move!.startup +
      luffy.move!.active -
      spec.holds[spec.active[1] - 1] -
      1;
    rival.x = luffy.x + reach + 3;
    rival.y = Math.min(FLOOR, luffy.y + height + 82);
    if (rival.y < FLOOR) rival.setState("air");
    tick();
    expect(rival.health).toBe(1000 - spec.damage);
  });

  it.each(Object.entries(previousReach))(
    "%s extends beyond its old reach and retracts",
    (id, previous) => {
      const { luffy } = bout("samurai");
      luffy.y = id.startsWith("air") ? FLOOR - 220 : FLOOR;
      luffy.attack(id);
      const { startup, active, recovery } = luffy.move!;
      const spec = luffyNormals[id];
      const maximum = Math.max(...spec.track.map(([x]) => x));
      for (const facing of [-1, 1]) {
        luffy.facing = facing;
        luffy.stateFrame = startup;
        const first = luffyLimb(luffy)!;
        expect(first.tip.x).toBeLessThan(previous);
        luffy.stateFrame = startup + active - spec.holds[spec.active[1] - 1];
        const peak = luffyLimb(luffy)!;
        expect(peak.tip.x).toBe(maximum);
        expect(maximum).toBeGreaterThan(previous * 1.45);
        const [contact] = luffy.attackShapes();
        expect(contact).toEqual(
          worldCapsule(peak.terminal, luffy.x, luffy.y, facing),
        );
        luffy.stateFrame = startup + active + recovery - 1;
        expect(luffyLimb(luffy)!.tip.x).toBeLessThan(55);
        expect(luffy.attackShapes()).toEqual([]);
      }
    },
  );

  it("registers a target passed between two active endpoint samples once", () => {
    const { luffy, rival, tick, run } = bout("samurai", 1, 216);
    luffy.attack("stand_heavy");
    const first = luffy.move!.startup;
    luffy.stateFrame = first + 1;
    const previous = luffyLimb(luffy)!.terminal;
    luffy.stateFrame++;
    const now = luffyLimb(luffy)!.terminal;
    const hurts = rival.hurtboxes();
    expect(
      hurts.some((r) =>
        shapeHitsRect(worldCapsule(previous, luffy.x, luffy.y, 1), r),
      ),
    ).toBe(false);
    expect(
      hurts.some((r) =>
        shapeHitsRect(worldCapsule(now, luffy.x, luffy.y, 1), r),
      ),
    ).toBe(false);
    expect(
      luffy
        .attackShapes()
        .some((shape) => hurts.some((r) => shapeHitsRect(shape, r))),
    ).toBe(true);
    luffy.stateFrame--;
    tick();
    expect(rival.health).toBe(916);
    run(35);
    expect(rival.health).toBe(916);
  });

  for (const id of ["samurai", "dio", "goku"] as const) {
    it.each(Object.keys(luffyMoves))(
      "hits " + id + " with %s on both sides",
      (moveId) => {
        for (const facing of [1, -1]) {
          const { luffy, rival, tick, run } = bout(id, facing);
          const [posture, button] = moveId.split("_");
          if (posture === "air") {
            luffy.y = rival.y = FLOOR - 95;
            luffy.setState("air");
            rival.setState("air");
          }
          tick({ down: posture === "crouch", pressed: [button as "light"] });
          expect(luffy.moveId).toBe(moveId);
          expect(luffy.attackShapes()).toEqual([]);
          run(22);
          expect(rival.health).toBeLessThan(rival.data.health);
          run(75);
          expect(luffyLimb(luffy)).toBeUndefined();
          expect(luffy.attackShapes()).toEqual([]);
        }
      },
    );
  }

  it("puts the active fist at range and makes the returning arm punishable", () => {
    const { luffy, rival, tick, run } = bout("samurai", 1, 200);
    tick({ pressed: ["heavy"] });
    run(23);
    expect(rival.health).toBeLessThan(1000);
    const punish = bout("samurai", 1, 138);
    punish.luffy.attack("stand_heavy");
    punish.luffy.stateFrame =
      punish.luffy.move!.startup + punish.luffy.move!.active;
    punish.rival.attack("stand_light");
    punish.rival.stateFrame = punish.rival.move!.startup;
    expect(punish.luffy.attackShapes()).toEqual([]);
    expect(
      punish.luffy.hurtboxes().some((r) => r.x + r.w > punish.luffy.x + 120),
    ).toBe(true);
    punish.tick();
    expect(punish.luffy.health).toBeLessThan(1000);
    expect(luffyLimb(punish.luffy)).toBeUndefined();
  });

  it("clamps tip and strike in both corners and reconstructs mid-swing", () => {
    for (const facing of [-1, 1]) {
      const { match, luffy } = bout("samurai", facing);
      luffy.x = facing === 1 ? 1225 : 55;
      luffy.attack("stand_heavy");
      luffy.stateFrame = 15;
      const shape = shapeBounds(luffy.attackShapes()[0]);
      expect(shape.x).toBeGreaterThanOrEqual(0);
      expect(shape.x + shape.w).toBeLessThanOrEqual(1280);
      const replay = restore(snapshot(match));
      expect(hashState(snapshot(replay))).toBe(hashState(snapshot(match)));
      expect(replay.fighters[0].attackShapes()).toEqual(luffy.attackShapes());
    }
  });

  it("blocks highs standing and lows crouching", () => {
    for (const [move, down] of [
      ["stand_medium", false],
      ["crouch_medium", true],
    ] as const) {
      const { luffy, rival, tick } = bout("goku", 1, 67);
      luffy.attack(move);
      for (let i = 0; i < 17; i++) tick({}, { direction: 1, down });
      expect(rival.health).toBe(1000);
      expect(luffy.connected).toBe(true);
      expect(luffy.hitConfirmed).toBe(false);
      expect(luffy.canCancel("jump")).toBe(false);
    }
  });

  it.each(["stand", "crouch", "air"])("links J K L in %s", (posture) => {
    const { luffy, rival, tick } = bout("samurai");
    if (posture === "air") {
      luffy.y = rival.y = FLOOR - 155;
      luffy.setState("air");
      rival.setState("air");
    }
    for (const button of ["light", "medium", "heavy"] as const) {
      tick({ down: posture === "crouch", pressed: [button] });
      for (
        let i = 0;
        i < 26 &&
        (luffy.moveId !== posture + "_" + button || !luffy.hitConfirmed);
        i++
      )
        tick({ down: posture === "crouch" });
      expect(luffy.moveId).toBe(posture + "_" + button);
      expect(luffy.hitConfirmed).toBe(true);
    }
    expect(rival.combo).toBe(3);
    if (posture === "air") expect(rival.knockedDown).toBe(true);
    if (posture === "crouch") {
      expect(rival.vy).toBeLessThan(-10);
      tick({ pressed: ["jump"] });
      for (let i = 0; i < 12 && !luffy.airborne; i++) tick();
      expect(luffy.airborne).toBe(true);
      expect(luffyLimb(luffy)).toBeUndefined();
    }
  });

  it("chases a grounded launcher with the complete aerial chain", () => {
    const { luffy, rival, tick } = bout("samurai");
    const connect = (
      id: string,
      button: "light" | "medium" | "heavy",
      down = false,
    ) => {
      tick({ pressed: [button], down });
      for (
        let i = 0;
        i < 27 && (luffy.moveId !== id || !luffy.hitConfirmed);
        i++
      )
        tick({ down });
      expect(luffy.moveId).toBe(id);
      expect(luffy.hitConfirmed).toBe(true);
    };
    connect("crouch_heavy", "heavy", true);
    tick({ pressed: ["jump"] });
    for (let i = 0; i < 13 && !luffy.airborne; i++) tick();
    expect(luffy.airborne).toBe(true);
    connect("air_light", "light");
    connect("air_medium", "medium");
    connect("air_heavy", "heavy");
    expect(rival.combo).toBe(4);
    expect(rival.knockedDown).toBe(true);
  });
});
