import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral } from "../src/engine/types";
import { reactionFor, reactionBoxes } from "../src/engine/lifecycle";
import { FighterPresentation } from "../src/render/presentation";
import animation from "../src/data/dio-animations.json";
import { snapshot, restore, hashState } from "../src/engine/state";
const tick = (m: Match, n = 1) => {
  for (let i = 0; i < n; i++) m.step([neutral(), neutral()]);
};
function fixture(mirror = false) {
  const m = new Match(characters.dio, {}, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = mirror ? 700 : 500;
  b.x = a.x + (mirror ? -80 : 80);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  if (a.stand) {
    a.stand.s.x = a.x - a.facing * 30;
    a.stand.s.y = a.y - 18;
    a.stand.s.facing = a.facing;
  }
  return m;
}
describe("Dio secondary states and independent Stand reactions", () => {
  it.each([
    ["guardStand", "idle", 0, false, false, 0, false],
    ["guardCrouch", "crouch", 0, true, false, 0, false],
    ["guardImpactStand", "blockstun", 0, false, false, 0, false],
    ["guardImpactCrouch", "blockstun", 0, true, false, 0, false],
    ["damageLight", "hitstun", 1, false, false, 0, false],
    ["damageMedium", "hitstun", 2, false, false, 0, false],
    ["damageHeavy", "hitstun", 3, false, false, 0, false],
    ["damageCrouch", "hitstun", 2, true, false, 0, false],
    ["damageAir", "hitstun", 2, false, true, 0, false],
    ["launched", "hitstun", 3, false, true, -10, true],
    ["falling", "hitstun", 3, false, true, 5, true],
    ["downed", "hitstun", 3, false, false, 0, true],
    ["getup", "getup", 0, false, false, 0, false],
    ["grabbed", "grabbed", 0, false, false, 0, false],
    ["ko", "ko", 0, false, false, 0, false],
    ["defeat", "defeat", 0, false, false, 0, false],
    ["entrance", "entrance", 0, false, false, 0, false],
    ["taunt", "taunt", 0, false, false, 0, false],
    ["victory", "victory", 0, false, false, 0, false],
  ] as const)(
    "selects and renders %s with matching pose hurtboxes",
    (logical, state, strength, crouch, air, vy, launch) => {
      const a = fixture().fighters[0];
      a.setState(state);
      a.guardIntent = true;
      a.hitCrouched = a.blockCrouched = crouch;
      a.reactionStrength = strength;
      a.y = air ? 400 : FLOOR;
      a.vy = vy;
      a.hitLaunch = launch;
      a.knockedDown = logical === "downed";
      a.syncReactionClock(false);
      const expected = a.data.reactionClips![logical];
      expect(reactionFor(a)?.clip).toBe(expected);
      const p = new FighterPresentation(animation);
      p.tick(a);
      expect(p.animator.clipName).toBe(expected);
      expect(reactionBoxes(a)?.length).toBeGreaterThan(5);
      expect(a.hurtboxes()[0].x).toBe(a.x + reactionBoxes(a)![0].x);
    },
  );
  it("advances each damage phase instead of resetting its clock every tick", () => {
    const m = fixture(),
      a = m.fighters[0];
    a.setState("hitstun");
    a.stun = 30;
    a.reactionStrength = 2;
    tick(m, 5);
    expect(a.reactionFrame).toBeGreaterThanOrEqual(4);
    expect(reactionFor(a)?.tick).toBe(a.reactionFrame);
    a.hitLaunch = true;
    a.y = 400;
    a.vy = -8;
    a.syncReactionClock(false);
    expect(reactionFor(a)).toEqual({ clip: "secondaryLaunched", tick: 0 });
  });
  it.each([false, true])(
    "walks into the arena, stops and manifests the Stand on side %s",
    (mirror) => {
      const m = new Match(characters.dio, {}, characters.dio);
      if (mirror) {
        m.fighters[0].facing = -1;
      }
      const a = m.fighters[0];
      tick(m);
      const first = a.x;
      expect(a.stand!.s.clip).toBe("secondaryHidden");
      tick(m, 19);
      expect(Math.abs(a.x - first)).toBeCloseTo(19 * 1.6);
      tick(m, 20);
      expect(a.x).toBe(a.homeX);
      tick(m, 24);
      expect(a.stand!.s.clip).toBe("secondaryAppear");
      tick(m, 36);
      expect(m.phase).toBe("fight");
      expect(a.state).toBe("idle");
      expect(a.stand!.ready).toBe(true);
    },
  );
  it("T plays the complete authored taunt and then releases control", () => {
    const m = fixture();
    m.step([{ ...neutral(), pressed: ["taunt"] }, neutral()]);
    const a = m.fighters[0];
    expect(a.state).toBe("taunt");
    expect(a.stand!.s.clip).toBe("secondaryThreat");
    tick(m, a.data.lifecycle!.tauntTicks - 1);
    expect(a.state).toBe("taunt");
    tick(m);
    expect(a.state).toBe("idle");
  });
  it.each([false, true])(
    "real incoming damage removes pending fists immediately and returns the Stand across a side change %s",
    (mirror) => {
      const m = fixture(mirror),
        [a, b] = m.fighters;
      a.attack("stand_heavy");
      b.attack("stand_light");
      for (let i = 0; i < 20 && a.state !== "hitstun"; i++) tick(m);
      expect(a.state).toBe("hitstun");
      expect(a.stand!.s.clip).toBe("secondaryInterrupt");
      expect(a.attackShapes()).toEqual([]);
      expect(a.stand!.hitboxes(a)).toEqual([]);
      expect(a.stand!.s.timeline).toBeUndefined();
      b.x = a.x - a.facing * 100;
      for (let i = 0; i < 100; i++) {
        tick(m);
        expect(a.stand!.hitboxes(a)).toEqual([]);
      }
      expect(a.stand!.ready).toBe(true);
      expect(Math.abs(a.stand!.s.x - a.x + 30 * a.facing)).toBeLessThan(1);
    },
  );
  it("severe knockdown hides the Stand until getup and then reappears", () => {
    const m = fixture(),
      a = m.fighters[0];
    a.setState("hitstun");
    a.stun = 50;
    a.knockedDown = true;
    const clips = new Set<string>();
    for (let i = 0; i < 130; i++) {
      tick(m);
      clips.add(a.stand!.s.clip);
    }
    for (const c of [
      "secondaryInterrupt",
      "secondaryRecoil",
      "secondaryVanish",
      "secondaryHidden",
      "secondaryAppear",
    ])
      expect(clips.has(c), c).toBe(true);
    expect(a.state).toBe("idle");
    expect(a.stand!.ready).toBe(true);
  });
  it("a real Samurai launcher runs launched, falling, downed and getup with no orphaned Stand attack", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    b.attack("crouch_heavy");
    const seen = new Set<string>();
    for (let i = 0; i < 180; i++) {
      tick(m);
      seen.add(reactionFor(a)?.clip ?? "idle");
      expect(a.stand!.hitboxes(a)).toEqual([]);
    }
    for (const key of [
      "secondaryLaunched",
      "secondaryFalling",
      "secondaryDowned",
      "secondaryGetup",
    ])
      expect(seen.has(key), key).toBe(true);
    expect(a.y).toBe(FLOOR);
    expect(a.state).toBe("idle");
  });
  it("KO dissipates once, stays absent during defeat and returns only with a new round", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    a.health = 1;
    b.attack("stand_light");
    for (let i = 0; i < 30 && m.phase === "fight"; i++) tick(m);
    expect(m.phase).toBe("roundEnd");
    expect(a.stand!.s.clip).toBe("secondaryDissipate");
    tick(m, 70);
    expect(a.state).toBe("defeat");
    expect(a.stand!.s.clip).toBe("secondaryHidden");
    tick(m, 30);
    expect(a.stand!.s.clip).toBe("secondaryHidden");
    tick(m, 55);
    expect(m.phase).toBe("intro");
    expect(m.fighters[0]).not.toBe(a);
    tick(m, 70);
    expect(m.fighters[0].stand!.s.clip).toBe("secondaryAppear");
  });
  it("victory poses run on both entities without an independent health bar", () => {
    const m = fixture(),
      a = m.fighters[0];
    a.setState("victory");
    a.stand!.tick(a);
    expect(a.stand!.s.clip).toBe("secondaryVictory");
    expect("health" in a.stand!).toBe(false);
    expect("health" in a.stand!.s).toBe(false);
    expect(a.attackShapes()).toEqual([]);
  });
  it("restores damage and temporary disappearance deterministically", () => {
    const m = fixture();
    m.fighters[0].setState("hitstun");
    m.fighters[0].knockedDown = true;
    m.fighters[0].stun = 55;
    tick(m, 24);
    const copy = restore(JSON.parse(JSON.stringify(snapshot(m))));
    for (let i = 0; i < 120; i++) {
      tick(m);
      tick(copy);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    }
  });
});
