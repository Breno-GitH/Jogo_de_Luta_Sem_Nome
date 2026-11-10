import { describe, expect, it } from "vitest";
import { characters, type CharacterId } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import {
  captureWindup,
  kanekiNormalIds,
  kanekiOffensiveKagunes,
} from "../src/engine/kaneki-combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type Button, type InputFrame } from "../src/engine/types";

function duel(id: CharacterId = "samurai", gap = 57, side: 1 | -1 = 1) {
  const match = new Match(characters.kaneki, {}, characters[id]);
  match.phase = "fight";
  const [a, b] = match.fighters;
  a.x = 620;
  b.x = 620 + gap * side;
  a.facing = side;
  b.facing = -side;
  function step(pressed: Button[] = [], down = false, rival = neutral()) {
    match.step([{ ...neutral(), pressed, down }, rival]);
  }
  function wait(
    predicate: () => unknown,
    limit = 140,
    rival?: InputFrame,
    down = false,
  ) {
    for (let i = 0; i < limit && !predicate(); i++) step([], down, rival);
    expect(predicate()).toBeTruthy();
  }
  function choose(button?: Button) {
    wait(() => !match.hitstop && match.capture!.tick === captureWindup);
    if (button) step([button]);
    wait(() => !match.capture);
  }
  return { match, a, b, step, wait, choose };
}
const foes: CharacterId[] = ["samurai", "dio", "goku", "luffy", "sasuke"];

describe("Kaneki normal combat", () => {
  for (const id of foes) {
    it.each(kanekiNormalIds)(
      "%s lands via the normal command against " + id,
      (move) => {
        const { a, b, step, wait } = duel(id, 58, -1);
        const [stance, strength] = move.split("_");
        if (stance === "air") {
          a.y = FLOOR - (move === "air_medium" ? 170 : 115);
          b.y = FLOOR - (move === "air_medium" ? 85 : 115);
          a.setState("air");
          b.setState("air");
        }
        step([strength as Button], stance === "crouch");
        expect(a.moveId).toBe(move);
        wait(() => b.health < b.data.health, 22);
      },
    );
  }

  it.each([false, true])(
    "chains light, medium and heavy on the ground (low %s)",
    (down) => {
      const { a, b, step, wait } = duel();
      for (const strength of ["light", "medium", "heavy"] as const) {
        step([strength], down);
        wait(
          () =>
            a.moveId === (down ? "crouch_" : "stand_") + strength &&
            a.hitConfirmed,
          28,
          undefined,
          down,
        );
      }
      expect(b.combo).toBe(3);
    },
  );

  it("links into an air combo from the crouching launcher", () => {
      const { a, b, match, step, wait } = duel();
      step(["heavy"], true);
      wait(() => a.hitConfirmed);
      step(["jump"]);
      wait(() => a.airborne);
      for (const strength of ["light", "medium", "heavy"] as const) {
        step([strength]);
        if (strength === "heavy")
          wait(
            () =>
              match.capture?.kaneki ||
              (a.moveId === "air_heavy" && a.hitConfirmed),
            25,
          );
        else wait(() => a.moveId === "air_" + strength && a.hitConfirmed, 25);
      }
      expect(b.combo).toBeGreaterThanOrEqual(3);
    },
  );

  it("uses the confirmed medium to capture during grounded hitstun", () => {
    const { a, b, match, step, wait } = duel();
    step(["light"]);
    wait(() => a.hitConfirmed);
    step(["medium"]);
    wait(() => a.moveId === "stand_medium" && a.hitConfirmed);
    step(["throw"]);
    wait(() => match.capture?.kaneki, 28);
    expect(b.combo).toBe(2);
  });

  it("keeps the offensive tips and exposed shaft inside authoritative volumes", () => {
    const { a, step, wait } = duel("samurai", 300, -1);
    step(["heavy"]);
    wait(() => a.attackPhase === "active");
    const limbs = kanekiOffensiveKagunes(a, FLOOR);
    expect(limbs).toHaveLength(1);
    expect(a.attackShapes()[0]).toMatchObject({ b: limbs[0].tip });
    expect(a.hurtboxes().length).toBeGreaterThan(3);
    a.setState("hitstun");
    expect(a.attackShapes()).toHaveLength(0);
    expect(kanekiOffensiveKagunes(a, FLOOR)).toHaveLength(0);
  });
});

describe("Kaneki authoritative capture", () => {
  it.each([
    ["light", "pull", 74],
    ["medium", "throw", 92],
    ["heavy", "launch", 101],
    [undefined, "throw", 78],
  ] as const)(
    "resolves %s and restores identically (%s)",
    (button, route, damage) => {
      const { match, b, step, wait } = duel("sasuke", 133);
      step(["throw"]);
      wait(() => match.capture?.kaneki);
      const oldTimer = match.timer;
      wait(() => !match.hitstop && match.capture!.tick === captureWindup);
      const replica = restore(snapshot(match));
      for (let tick = 0; tick < 120 && match.capture; tick++) {
        const pressed = tick === 0 && button ? [button] : [];
        step(pressed);
        replica.step([{ ...neutral(), pressed }, neutral()]);
        expect(hashState(snapshot(replica))).toBe(hashState(snapshot(match)));
        if (match.capture?.kaneki?.route)
          expect(match.capture.kaneki.route).toBe(route);
      }
      expect(match.capture).toBeUndefined();
      expect(match.timer).toBe(oldTimer);
      expect(b.health).toBe(1000 - damage);
      expect(b.kanekiCaptured).toBe(true);
      expect(b.knockedDown).toBe(true);
    },
  );

  it("grabs against guard near the reach limit, including the reverse orientation", () => {
    for (const side of [1, -1] as const) {
      const { a, b, match, step, wait, choose } = duel("samurai", 149, side);
      b.x = side === 1 ? 1240 : 40;
      a.x = b.x - side * 149;
      const guard = { ...neutral(), direction: side, down: true };
      step(["throw"], false, guard);
      wait(() => match.capture?.kaneki, 19, guard);
      choose("medium");
      expect(b.health).toBe(908);
      expect(b.x).toBe(side === 1 ? 1240 : 40);
    }
  });

  it.each(["far", "jump", "interrupt"] as const)(
    "does not latch during a %s",
    (scenario) => {
      const { match, a, b, step, wait } = duel(
        "goku",
        scenario === "far" ? 205 : 60,
      );
      step(
        ["throw"],
        false,
        scenario === "jump" ? { ...neutral(), pressed: ["jump"] } : neutral(),
      );
      if (scenario === "interrupt") {
        a.setState("hitstun");
        a.stun = 16;
      }
      for (let tick = 0; tick < 52; tick++) {
        step();
        expect(match.capture).toBeUndefined();
      }
      expect(b.health).toBe(1000);
      wait(() => a.state === "idle");
    },
  );

  it("forbids a new capture while the finishing throw has the opponent down", () => {
    const { match, b, step, wait, choose } = duel();
    step(["throw"]);
    wait(() => match.capture?.kaneki);
    choose("light");
    expect(b.knockedDown).toBe(true);
    step(["throw"]);
    for (let i = 0; i < 17; i++) {
      step();
      expect(match.capture).toBeUndefined();
    }
    expect(b.kanekiCaptured).toBe(true);
    wait(() => b.combo === 0);
    expect(b.kanekiCaptured).toBeUndefined();
  });

  it.each([false, true])(
    "requires prior airborne hits to convert air heavy into capture (%s)",
    (chain) => {
      const { match, a, b, step, wait, choose } = duel("luffy", 79);
      a.y = b.y = FLOOR - 140;
      a.setState("air");
      b.setState(chain ? "hitstun" : "air");
      b.stun = 42;
      b.combo = chain ? 2 : 0;
      step(["heavy"]);
      wait(() => match.capture || b.health < 1000, 20);
      expect(!!match.capture?.kaneki).toBe(chain);
      if (chain) {
        expect(match.capture!.kaneki!.source).toBe("air");
        const y = a.y;
        choose("medium");
        expect(a.y).toBe(y);
      }
    },
  );

  it.each(["lowerRear", "lowerFront", "upperRear", "upperFront"] as const)(
    "can latch with %s",
    (limb) => {
      const { match, a, b, step, wait } = duel("luffy", 84);
      const air = limb.startsWith("upper");
      if (air) {
        a.y = b.y = FLOOR - 140;
        a.vy = b.vy = limb === "upperFront" ? 2 : -1;
        a.setState("air");
        b.setState("hitstun");
        b.stun = 36;
        b.combo = 2;
      }
      step([air ? "heavy" : "throw"], limb === "lowerRear");
      wait(() => match.capture?.kaneki, 22);
      expect(match.capture?.kaneki?.limb).toBe(limb);
      match.step([neutral(), { ...neutral(), pressed: ["heavy"] }]);
      expect(match.capture?.kaneki?.pending).toBeUndefined();
      step(["light"]);
      wait(() => match.capture?.kaneki?.route === "pull", 16);
    },
  );

  it("resolves a lethal throw through the existing round-end transition", () => {
    const { match, b, step, wait, choose } = duel();
    b.health = 40;
    step(["throw"]);
    wait(() => match.capture?.kaneki);
    choose("medium");
    expect(b.health).toBe(0);
    expect(match.wins).toEqual([1, 0]);
    expect(match.phase).toBe("roundEnd");
  });
});
