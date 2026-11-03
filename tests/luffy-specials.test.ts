import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { Match, FLOOR } from "../src/engine/combat";
import {
  luffyAttackLimbs,
  luffySpecialMoves,
} from "../src/engine/luffy-specials";
import { neutral, type InputFrame, type Button } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import { shapeBounds } from "../src/engine/geometry";

const opponents = ["samurai", "dio", "goku"] as const;
type Opponent = (typeof opponents)[number];
function fixture(opponent: Opponent, facing: 1 | -1 = 1, distance = 110) {
  const match = new Match(
    characters.luffy,
    { training: true },
    characters[opponent],
  );
  const [luffy, target] = match.fighters;
  match.phase = "fight";
  luffy.x = 600;
  target.x = luffy.x + facing * distance;
  luffy.facing = facing;
  target.facing = -facing;
  const tick = (
    input: Partial<InputFrame> = {},
    other: Partial<InputFrame> = {},
  ) =>
    match.step([
      { ...neutral(), ...input },
      { ...neutral(), ...other },
    ]);
  const run = (ticks: number, other: Partial<InputFrame> = {}) => {
    for (let i = 0; i < ticks; i++) tick({}, other);
  };
  const command = (
    name: string,
    button: Button,
    other: Partial<InputFrame> = {},
  ) => {
    tick({ down: true }, other);
    if (name === "bazooka") {
      tick({}, other);
      tick({ down: true, pressed: [button] }, other);
    } else {
      const direction = (name === "pistol" ? facing : -facing) as 1 | -1;
      tick({ down: true, direction }, other);
      tick({ direction, pressed: [button] }, other);
    }
  };
  return { match, luffy, target, tick, run, command };
}

describe("Luffy ground specials", () => {
  it("connects Pistol at 450 pixels, beyond the strong normal", () => {
    const { command, run, target } = fixture("dio", 1, 450);
    command("pistol", "heavy");
    run(90);
    expect(target.health).toBe(909);
  });

  it("does not grant a special cancel from a blocked normal", () => {
    const { luffy, tick, command, run } = fixture("samurai", 1, 57);
    tick({ pressed: ["light"] }, { direction: 1 });
    run(5, { direction: 1 });
    expect(luffy.connected).toBe(true);
    expect(luffy.canSpecialCancel()).toBe(false);
    command("gatling", "heavy", { direction: 1 });
    run(8, { direction: 1 });
    expect(luffy.moveId).not.toBe("gatling_heavy");
  });

  for (const opponent of opponents) {
    it.each(Object.keys(luffySpecialMoves))(
      "executes %s against " + opponent + " from both sides",
      (id) => {
        const [name, button] = id.split("_");
        for (const facing of [-1, 1] as const) {
          const { luffy, target, command, run } = fixture(opponent, facing);
          luffy.meter = 37;
          command(name, button as Button);
          expect(luffy.moveId).toBe(id);
          expect(luffy.attackShapes()).toEqual([]);
          expect(luffy.meter).toBe(37);
          run(130);
          expect(target.health).toBeLessThan(1000);
          expect(luffyAttackLimbs(luffy)).toEqual([]);
          expect(luffy.state).toBe("idle");
        }
      },
    );
  }

  it.each(["light", "medium", "heavy"] as const)(
    "Gatling %s registers each punch once",
    (button) => {
      const { luffy, target, command, run } = fixture("samurai");
      command("gatling", button);
      run(130);
      expect(luffy.moveId).toBe("");
      const n = { light: 3, medium: 5, heavy: 7 }[button];
      const damage = luffySpecialMoves["gatling_" + button].damage;
      expect(target.health).toBe(
        1000 -
          Array.from({ length: n }, (_, i) =>
            Math.round(damage * (1 - 0.075 * i)),
          ).reduce((a, b) => a + b, 0),
      );
    },
  );

  it("Bazooka uses two hitboxes and applies only one hit", () => {
    const { luffy, target, command, tick, run } = fixture("goku");
    command("bazooka", "heavy");
    while (luffy.stateFrame < luffy.move!.startup) tick();
    expect(
      luffyAttackLimbs(luffy).filter((x) => x.hitboxes.length),
    ).toHaveLength(2);
    run(85);
    expect(target.health).toBe(887);
  });

  it("requires releasing down and keeps aerial specials unavailable", () => {
    const { luffy, tick, run } = fixture("samurai");
    for (let i = 0; i < 9; i++) tick({ down: true });
    tick({ down: true, pressed: ["heavy"] });
    expect(luffy.moveId).toBe("crouch_heavy");
    run(100);
    luffy.y = FLOOR - 150;
    luffy.setState("air");
    tick({ down: true });
    tick({});
    tick({ down: true, pressed: ["medium"] });
    expect(luffy.moveId).toBe("air_medium");
  });

  it("blocks, whiffs beyond reach, and can be interrupted in startup", () => {
    const guard = fixture("samurai", 1, 150);
    guard.command("pistol", "heavy", { direction: 1 });
    guard.run(27, { direction: 1 });
    expect(guard.target.health).toBe(1000);
    expect(guard.luffy.connected).toBe(true);
    expect(guard.luffy.hitConfirmed).toBe(false);
    const far = fixture("goku", 1, 560);
    far.command("pistol", "heavy");
    far.run(80);
    expect(far.target.health).toBe(1000);
    const close = fixture("samurai", 1, 57);
    close.command("pistol", "heavy");
    close.tick({}, { pressed: ["light"] });
    close.run(8);
    expect(close.luffy.state).toBe("hitstun");
    expect(luffyAttackLimbs(close.luffy)).toHaveLength(0);
    expect(close.luffy.attackShapes()).toHaveLength(0);
  });

  it.each(["pistol", "gatling", "bazooka"])(
    "cancels a confirmed normal into %s",
    (name) => {
      const { luffy, tick, command } = fixture("samurai", 1, 56);
      tick({ pressed: ["light"] });
      for (let i = 0; i < 8 && !luffy.hitConfirmed; i++) tick();
      expect(luffy.hitConfirmed).toBe(true);
      command(name, "medium");
      for (let i = 0; i < 8 && luffy.moveId !== name + "_medium"; i++) tick();
      expect(luffy.moveId).toBe(name + "_medium");
    },
  );

  it("clamps both arms at the walls and restores an in-flight checkpoint", () => {
    for (const facing of [-1, 1] as const) {
      const { match, luffy, command } = fixture("dio", facing);
      command("bazooka", "heavy");
      luffy.x = facing === 1 ? 1235 : 45;
      luffy.stateFrame = luffy.move!.startup + 4;
      for (const shape of luffy.attackShapes()) {
        const { x, w } = shapeBounds(shape);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(1280);
      }
      const replay = restore(snapshot(match));
      expect(hashState(snapshot(replay))).toBe(hashState(snapshot(match)));
      expect(replay.fighters[0].attackShapes()).toEqual(luffy.attackShapes());
    }
  });
});
