import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { luffyGrabLimb, luffyThrow } from "../src/engine/luffy-secondary";
import { luffyAttackLimbs } from "../src/engine/luffy-specials";
import { snapshot, restore, hashState } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { luffyAnimations } from "../src/render/luffy-animations";

const hands = ["light", "medium", "heavy"] as const;
function matchAt(facing: 1 | -1 = 1, distance = 64) {
  const match = new Match(characters.luffy, {}, characters.samurai);
  match.phase = "fight";
  const [luffy, enemy] = match.fighters;
  luffy.x = luffy.homeX = 600;
  enemy.x = enemy.homeX = 600 + facing * distance;
  luffy.facing = facing;
  enemy.facing = -facing;
  const presentation = new FighterPresentation(luffyAnimations);
  const hits: typeof match.hits = [];
  const seen = new Set<string>();
  const step = (a: Partial<InputFrame> = {}, b: Partial<InputFrame> = {}) => {
    match.step([
      { ...neutral(), ...a },
      { ...neutral(), ...b },
    ]);
    hits.push(...match.hits);
    presentation.tick(luffy);
    seen.add(presentation.animator.clipName);
  };
  const until = (check: () => boolean, maximum: number, run = () => step()) => {
    for (let i = 0; i < maximum && !check(); i++) run();
    expect(check()).toBe(true);
  };
  return { match, luffy, enemy, step, until, seen, hits, presentation };
}

describe("Luffy's defensive and secondary poses", () => {
  it.each([true, false])(
    "blocks the appropriate height (low=%s) with custom poses",
    (low) => {
      const { luffy, enemy, step, until, presentation, seen } = matchAt();
      const back = { direction: -1 as const, down: low };
      step(back);
      expect(presentation.animator.clipName).toBe(
        low ? "guardCrouch" : "guardStand",
      );
      expect(presentation.animator.sprite().sheet).toBe("luffy/secondary.png");
      if (!low) enemy.y = FLOOR - 22;
      step(back, { down: low, pressed: ["light"] });
      until(
        () => luffy.state === "blockstun",
        14,
        () => step(back),
      );
      expect(luffy.health).toBe(1000);
      expect(presentation.animator.clipName).toBe(
        low ? "guardImpactCrouch" : "guardImpactStand",
      );
      until(() => luffy.state === "idle", 34);
      expect(seen.has("guardRecovery")).toBe(true);
    },
  );

  it.each([
    ["light", false, "damageLight"],
    ["medium", false, "damageMedium"],
    ["heavy", false, "damageHeavy"],
    ["light", true, "damageCrouch"],
  ] as const)("routes a real %s hit (low=%s) to %s", (button, down, clip) => {
    const { luffy, step, until, presentation } = matchAt();
    step({}, { down, pressed: [button] });
    until(() => luffy.state === "hitstun", 18);
    expect(presentation.animator.clipName).toBe(clip);
    expect(luffy.hurtboxes().length).toBeGreaterThanOrEqual(3);
    expect(luffy.attackShapes()).toEqual([]);
  });

  it("goes through launch, fall, knockdown and getup on the real floor", () => {
    const { luffy, step, until, seen } = matchAt();
    step({}, { down: true, pressed: ["heavy"] });
    until(() => luffy.state === "hitstun", 18);
    until(() => luffy.state === "getup", 120);
    expect(luffy.y).toBe(FLOOR);
    expect(luffy.invulnerable).toBe(true);
    for (const clip of ["launched", "falling", "downed", "getup"])
      expect(seen.has(clip)).toBe(true);
    until(() => luffy.state === "idle", 24);
    expect(luffy.invulnerable).toBe(false);
  });

  it.each([
    ["light", "damageAir"],
    ["heavy", "airKnockback"],
  ] as const)("selects %s's airborne impact as %s", (button, clip) => {
    const { luffy, enemy, step, until, presentation } = matchAt(1, 68);
    luffy.y = enemy.y = FLOOR - 150;
    step({}, { pressed: [button] });
    until(() => luffy.state === "hitstun", 18);
    expect(presentation.animator.clipName).toBe(clip);
  });

  it("uses the round's own entrance, taunt, win, KO and defeat transitions", () => {
    const entry = matchAt();
    entry.match.phase = "intro";
    entry.match.phaseFrames = 100;
    entry.until(() => entry.match.phase === "fight", 101);
    expect(entry.seen).toContain("walkForward");
    expect(entry.seen).toContain("entrance");
    entry.step({ pressed: ["taunt"] });
    expect(entry.presentation.animator.clipName).toBe("taunt");
    entry.until(() => entry.luffy.state === "idle", 40);
    entry.enemy.health = 1;
    entry.step({ pressed: ["light"] });
    entry.until(() => entry.match.phase === "roundEnd", 12);
    expect(entry.presentation.animator.clipName).toBe("victory");
    const loss = matchAt();
    loss.luffy.health = 1;
    loss.step({}, { pressed: ["light"] });
    loss.until(() => loss.match.phase === "roundEnd", 12);
    expect(loss.presentation.animator.clipName).toBe("ko");
    loss.until(() => loss.luffy.state === "defeat", 56);
    expect(loss.presentation.animator.clipName).toBe("defeat");
    expect(luffyAttackLimbs(loss.luffy)).toHaveLength(0);
  });
});

describe("Luffy's elastic universal throw", () => {
  it.each([1, -1] as const)(
    "grips, releases and recovers facing %s",
    (facing) => {
      const { match, luffy, enemy, step, until, seen, hits } = matchAt(
        facing,
        83,
      );
      const back = { direction: facing, down: true };
      const startX = enemy.x;
      step({ pressed: ["throw"] }, back);
      expect(luffy.attackShapes()).toEqual([]);
      until(
        () => !!match.capture,
        13,
        () => step({}, back),
      );
      expect(enemy.x).toBe(startX);
      expect(luffy.attackShapes()).toEqual([]);
      expect(luffyGrabLimb(luffy)?.hitboxes).toEqual([]);
      expect(seen).toContain("throw");
      expect(seen).toContain("grabHold");
      const replay = restore(snapshot(match));
      until(
        () => !match.capture,
        44,
        () => {
          step();
          replay.step([neutral(), neutral()]);
          expect(hashState(snapshot(match))).toBe(hashState(snapshot(replay)));
          if (match.capture && luffy.stateFrame < 11) {
            const grip = luffyGrabLimb(luffy)!;
            expect(
              Math.abs(luffy.x + grip.tip.x * facing - enemy.x),
            ).toBeLessThan(10);
          }
        },
      );
      expect(enemy.health).toBe(1000 - luffyThrow.damage);
      expect(hits.filter((hit) => hit.move === "throw")).toHaveLength(1);
      expect(enemy.knockedDown).toBe(true);
      expect(luffyGrabLimb(luffy)).toBeUndefined();
      expect(seen).toContain("throwRecover");
      until(() => luffy.state === "idle", 17);
    },
  );

  it.each(["range", "air", "strike"] as const)(
    "cannot capture through %s",
    (reason) => {
      const { match, luffy, enemy, step } = matchAt(
        1,
        reason === "range" ? 145 : 63,
      );
      if (reason === "air") enemy.y = FLOOR - 65;
      step(
        { pressed: ["throw"] },
        reason === "strike" ? { pressed: ["light"] } : {},
      );
      for (let i = 0; i < 52; i++) {
        step();
        expect(match.capture).toBeUndefined();
      }
      expect(enemy.health).toBe(1000);
      expect(luffyGrabLimb(luffy)).toBeUndefined();
      expect(luffy.attackShapes()).toEqual([]);
    },
  );
});

describe("Luffy's confirmed combo routes", () => {
  for (const facing of [1, -1] as const)
    it.each(["ground", "low", "pistol", "gatling", "air", "bazooka"] as const)(
      "executes %s without an idle gap facing " + facing,
      (route) => {
        const { luffy, enemy, step, until, hits, seen } = matchAt(facing);
        const normal = (
          button: (typeof hands)[number],
          posture: "stand" | "crouch" | "air",
        ) => {
          const down = posture === "crouch";
          step({ down, pressed: [button] });
          until(
            () => luffy.moveId === posture + "_" + button && luffy.hitConfirmed,
            36,
            () => step({ down }),
          );
        };
        if (route === "air") {
          normal("heavy", "crouch");
          step({ pressed: ["jump"] });
          until(() => luffy.airborne, 16);
          expect(luffyAttackLimbs(luffy)).toEqual([]);
          for (const button of hands) normal(button, "air");
          expect(enemy.knockedDown).toBe(true);
          expect(enemy.combo).toBe(4);
        } else {
          const posture = route === "low" ? "crouch" : "stand";
          normal("light", posture);
          normal("medium", posture);
          if (["ground", "low", "gatling"].includes(route))
            normal("heavy", posture);
          if (
            route === "pistol" ||
            route === "gatling" ||
            route === "bazooka"
          ) {
            const dir = (route === "gatling" ? -facing : facing) as 1 | -1;
            step({ down: true });
            if (route === "bazooka") {
              step();
              step({ down: true, pressed: ["light"] });
            } else {
              step({ direction: dir, down: true });
              step({ direction: dir, pressed: ["light"] });
            }
            until(
              () => luffy.moveId === route + "_light" && luffy.hitConfirmed,
              36,
            );
          }
          expect(enemy.combo).toBeGreaterThanOrEqual(3);
        }
        expect(seen).not.toContain("idle");
        expect(hits.length).toBeGreaterThanOrEqual(3);
        const first = characters.luffy.moves[hits[0].move];
        const second = characters.luffy.moves[hits[1].move];
        expect(hits[0].damage).toBe(first.damage);
        expect(hits[1].damage).toBe(Math.round(second.damage * 0.925));
        until(() => luffy.state === "idle", 135);
        expect(luffyAttackLimbs(luffy)).toEqual([]);
        expect(luffy.attackShapes()).toEqual([]);
      },
    );

  it("removes the previous limb on special cancel and on a real interruption", () => {
    const { luffy, step, until, hits } = matchAt();
    step({ pressed: ["light"] });
    until(() => luffy.hitConfirmed, 10);
    step({ down: true });
    step({ direction: 1, down: true });
    step({ direction: 1, pressed: ["heavy"] });
    until(() => luffy.moveId === "pistol_heavy", 16);
    expect(luffyAttackLimbs(luffy)).toHaveLength(1);
    expect(luffy.attackShapes()).toEqual([]);
    const interrupted = matchAt(1, 58);
    interrupted.step({ down: true });
    interrupted.step({ direction: -1, down: true });
    interrupted.step(
      { direction: -1, pressed: ["heavy"] },
      { pressed: ["light"] },
    );
    expect(interrupted.luffy.moveId).toBe("gatling_heavy");
    interrupted.until(() => interrupted.luffy.state === "hitstun", 12);
    expect(luffyAttackLimbs(interrupted.luffy)).toEqual([]);
    expect(interrupted.luffy.attackShapes()).toEqual([]);
    expect(hits).toHaveLength(1);
  });
});
