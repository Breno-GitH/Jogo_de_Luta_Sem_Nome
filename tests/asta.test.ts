import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  astaSwords,
  practiceSword,
  beginAstaAttack,
  commitAstaSword,
} from "../src/engine/asta-stances";
import {
  astaNormals,
  astaNormalIds,
  astaBlade,
  astaGrips,
  normalHolds,
} from "../src/engine/asta-normals";
import { snapshot, restore, hashState } from "../src/engine/state";
import { ONLINE_CHARACTERS } from "../src/net/protocol";
import { roster } from "../src/ui/catalog";
import { astaAnimation } from "../src/render/asta-animations";
import { Animator } from "../src/render/animator";
function arena(side: 1 | -1 = 1, gap = 75) {
  const m = new Match(characters.asta, { training: true }, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  a.facing = side;
  b.facing = -side;
  const hits: typeof m.hits = [];
  const step = (i: Partial<InputFrame> = {}, j: Partial<InputFrame> = {}) => {
    m.step([
      { ...neutral(), ...i },
      { ...neutral(), ...j },
    ]);
    hits.push(...m.hits);
  };
  return { m, a, b, step, hits };
}
describe("Asta four-sword base", () => {
  it("is available in the shared roster and starts each round with Slayer", () => {
    expect(ONLINE_CHARACTERS).toContain("asta");
    expect(roster.find((x) => x.id === "asta")?.prototype).toBeFalsy();
    const p = arena();
    expect(p.a.asta?.equipped).toBe("slayer");
    expect(practiceSword(p.a, "destroyer")).toBe(true);
    const next = new Match(characters.asta, {}, characters.asta);
    expect(next.fighters.map((f) => f.asta?.equipped)).toEqual([
      "slayer",
      "slayer",
    ]);
    expect(Object.keys(characters.asta.specialMoves!)).toHaveLength(9);
    expect(Object.keys(characters.asta.superMoves!)).toEqual(["astaBlackMeteorite"]);
  });
  it.each(astaSwords)(
    "%s has nine finite, articulated and mirrored normals",
    (sword) => {
      for (const id of astaNormalIds) {
        const move = astaNormals[sword][id],
          clip = astaAnimation(sword).clips[id];
        expect(move.poses).toHaveLength(6);
        expect(new Set(clip.frames).size).toBe(6);
        expect(clip.durations).toEqual(normalHolds(sword, id));
        expect(clip.durations!.reduce((a, b) => a + b, 0)).toBe(
          move.startup + move.active + move.recovery,
        );
        expect(move.poses!.filter((p) => p.hitboxes?.length)).toHaveLength(2);
        for (const facing of [1, -1] as const) {
          const p = arena(facing);
          practiceSword(p.a, sword);
          if (id.startsWith("air")) {
            p.a.y = p.b.y = FLOOR - 80;
            p.a.setState("air");
            p.b.setState("air");
          }
          p.a.attack(id);
          expect(p.a.move).toBe(move);
          expect(p.a.asta?.attackSword).toBe(sword);
          for (let tick = 0; tick < 80; tick++) p.step();
          expect(p.hits.length, `${sword}/${id}/${facing}`).toBe(1);
          expect(p.b.health).toBeLessThan(1000);
          expect(p.a.attackShapes()).toHaveLength(0);
          expect(p.a.asta?.equipped).toBe(sword);
          expect(p.a.asta?.pending).toBeUndefined();
        }
        const grip = astaGrips[id][2];
        expect(move.poses![2].hitboxes).toEqual([astaBlade(sword, grip)]);
      }
    },
  );
  it.each(astaSwords)(
    "%s confirms J to K to L without a reverse loop",
    (sword) => {
      const p = arena();
      practiceSword(p.a, sword);
      p.step({ pressed: ["light"] });
      let next = 0,
        maxCombo = 0;
      for (let t = 0; t < 140; t++) {
        const input: Partial<InputFrame> = {};
        if (
          next === 0 &&
          p.a.moveId === "stand_light" &&
          p.a.canCancel("medium")
        ) {
          input.pressed = ["medium"];
          next++;
        } else if (
          next === 1 &&
          p.a.moveId === "stand_medium" &&
          p.a.canCancel("heavy")
        ) {
          input.pressed = ["heavy"];
          next++;
        }
        p.step(input);
        maxCombo = Math.max(maxCombo, p.b.combo);
      }
      expect(p.hits.map((h) => h.move)).toEqual([
        "stand_light",
        "stand_medium",
        "stand_heavy",
      ]);
      expect(maxCombo).toBe(3);
    },
  );
  it("cannot cancel whiffs, guard contacts, reverse beats or a heavy finisher into lights", () => {
    const p = arena(1, 500);
    p.a.attack("stand_light");
    p.a.stateFrame = 7;
    expect(p.a.canCancel("medium")).toBe(false);
    p.a.connected = true;
    expect(p.a.canCancel("medium")).toBe(false);
    p.a.hitConfirmed = true;
    expect(p.a.canCancel("medium")).toBe(true);
    expect(p.a.canCancel("light")).toBe(false);
    p.a.setState("idle");
    p.a.attack("stand_heavy");
    p.a.connected = p.a.hitConfirmed = true;
    p.a.stateFrame = 15;
    expect(p.a.canCancel("light")).toBe(false);
    expect(p.a.canCancel("medium")).toBe(false);
  });
  it.each(astaSwords)(
    "%s pursues a launcher into a bounded air chain",
    (sword) => {
      const p = arena();
      practiceSword(p.a, sword);
      p.a.attack("crouch_heavy");
      let stage = 0,
        maxCombo = 0;
      for (let t = 0; t < 190; t++) {
        const input: Partial<InputFrame> = {};
        if (stage === 0 && p.a.canCancel("jump")) {
          input.direction = 1;
          input.pressed = ["jump"];
          stage++;
        } else if (stage === 1 && p.a.airborne && p.a.state === "air") {
          input.pressed = ["light"];
          stage++;
        } else if (
          stage === 2 &&
          p.a.moveId === "air_light" &&
          p.a.canCancel("medium")
        ) {
          input.pressed = ["medium"];
          stage++;
        } else if (
          stage === 3 &&
          p.a.moveId === "air_medium" &&
          p.a.canCancel("heavy")
        ) {
          input.pressed = ["heavy"];
          stage++;
        }
        p.step(input);
        maxCombo = Math.max(maxCombo, p.b.combo);
      }
      expect(p.hits.map((h) => h.move)).toEqual([
        "crouch_heavy",
        "air_light",
        "air_medium",
        "air_heavy",
      ]);
      expect(maxCombo).toBe(4);
      expect(p.a.attackShapes()).toHaveLength(0);
    },
  );
  it("equips only in the training lab and never changes sword during an action", () => {
    const p = arena();
    p.m.rules.training = false;
    expect(practiceSword(p.a, "slasher")).toBe(false);
    p.m.rules.training = true;
    p.a.attack("stand_light");
    expect(practiceSword(p.a, "slasher")).toBe(false);
    expect(p.a.asta?.equipped).toBe("slayer");
  });
  it("commits future attack-integrated draws once, retains whiffs and handles interruptions", () => {
    for (const interrupted of [2, 7]) {
      const p = arena();
      p.a.attack("stand_light");
      p.a.stateFrame = 0;
      beginAstaAttack(p.a, { sword: "slasher", commitTick: 5 });
      expect(p.a.asta?.attackSword).toBe("slayer");
      expect(p.a.asta?.equipped).toBe("slayer");
      p.a.stateFrame = interrupted;
      commitAstaSword(p.a);
      commitAstaSword(p.a);
      p.a.setState("hitstun");
      expect(p.a.asta?.equipped).toBe(interrupted < 5 ? "slayer" : "slasher");
      expect(p.a.asta?.pending).toBeUndefined();
      expect(p.a.asta?.attackSword).toBeUndefined();
    }
  });
  it("offers one vulnerable air dash per jump and resets on ground contact", () => {
    const p = arena(1, 500);
    p.a.y = FLOOR - 120;
    p.a.setState("air");
    p.step({ direction: 1, pressed: ["dash"] });
    expect(p.a.asta?.airDashUsed).toBe(true);
    expect(p.a.asta?.airDashTicks).toBe(7);
    expect(p.a.invulnerable).toBe(false);
    for (let t = 0; t < 10; t++) p.step();
    p.step({ direction: -1, pressed: ["dash"] });
    expect(p.a.asta?.airDashTicks).toBe(0);
    for (let t = 0; t < 90; t++) p.step();
    expect(p.a.asta?.airDashUsed).toBe(false);
    p.a.y = FLOOR - 90;
    p.a.setState("air");
    p.step({ direction: -1, pressed: ["dash"] });
    expect(p.a.asta?.airDashTicks).toBe(7);
  });
  it.each(astaSwords)(
    "snapshots and replays %s including airborne movement",
    (sword) => {
      const p = arena();
      practiceSword(p.a, sword);
      p.a.attack("crouch_heavy");
      p.step();
      const q = restore(snapshot(p.m));
      for (let t = 0; t < 180; t++) {
        const input = {
          ...neutral(),
          direction: t % 25 < 10 ? 1 : 0,
          pressed:
            t === 40
              ? ["jump"]
              : t === 46
                ? ["dash"]
                : t === 63
                  ? ["heavy"]
                  : [],
        } as InputFrame;
        p.m.step([input, neutral()]);
        q.step([input, neutral()]);
        expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
      }
    },
  );
  it("animates neutral, guard, damage, throw and recovery with the same scale", () => {
    for (const sword of astaSwords) {
      const data = astaAnimation(sword);
      expect(data.scale).toBe(1);
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
        "guard",
        "guardLow",
        "hitHigh",
        "hitLow",
        "hitAir",
        "getup",
        "ko",
        "entrance",
        "victory",
        "defeat",
        "throw",
        "grabHold",
      ]) {
        const a = new Animator(data);
        a.update(name);
        expect(a.sprite().pivot).toEqual({ x: 128, y: 224 });
        expect(a.sprite().scale).toBe(1);
      }
    }
  });
});
