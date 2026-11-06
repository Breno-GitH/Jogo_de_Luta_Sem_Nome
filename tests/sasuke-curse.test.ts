import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import {
  curseAwaken, curseRevert, curseSpecials, sasukeCurseArt,
  sasukeCurseBalance as balance, sasukeCurseMoves, winged,
} from "../src/engine/sasuke-curse";
import { sasukeMoves } from "../src/engine/sasuke-data";
import { sasukeSpecialIds, sasukeSpecialMoves, type SasukeSpecialId } from "../src/engine/sasuke-specials";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { sasukeAnimations } from "../src/render/sasuke-animations";

const specials = {
  senbon: [6, "light", 170], eiso: [6, "medium", 208], chidori: [6, "heavy", 141],
  gokakyu: [4, "light", 166], hosenka: [4, "medium", 143], goryuka: [4, "heavy", 128],
  serpents: [2, "light", 108], nagashi: [2, "medium", 76],
} as const;
function fight(side: 1 | -1 = 1, distance = 480) {
  const m = new Match(characters.sasuke, {}, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 630;
  b.x = a.x + side * distance;
  a.facing = side;
  b.facing = -side;
  const tick = (input?: Partial<InputFrame>, target?: Partial<InputFrame>) =>
    m.step([{ ...neutral(), ...input }, { ...neutral(), ...target }]);
  const wait = (predicate: () => boolean, limit = 100) => {
    for (let t = 0; t < limit && !predicate(); t++) tick();
    expect(predicate()).toBe(true);
  };
  const motion = (end: 2 | 4 | 6, button: "light" | "medium" | "heavy") => {
    const direction = (end === 4 ? -side : side) as 1 | -1;
    tick({ down: true });
    tick(end === 2 ? undefined : { direction, down: true });
    tick({ down: end === 2, direction: end === 2 ? 0 : direction, pressed: [button] });
  };
  const activate = () => {
    motion(2, "heavy");
    expect(a.moveId).toBe(curseAwaken);
    wait(() => a.sasukeCurse?.phase === "active");
  };
  return { m, a, b, tick, wait, motion, activate };
}

describe("Sasuke Curse Mark II", () => {
  it("only awakens on two distinct down presses, without spending meter or producing a strike", () => {
    const { a, motion, tick, activate } = fight();
    a.meter = 47;
    tick({ down: true });
    tick({ down: true, pressed: ["heavy"] });
    expect(a.moveId).toBe("crouch_heavy");
    for (let t = 0; t < 43; t++) tick();
    activate();
    expect(a.sasukeCurse?.remaining).toBe(balance.durationTicks);
    expect(a.meter).toBe(47);
    motion(2, "heavy");
    expect(a.moveId).toBe("");
    expect(a.sasukeCurse?.phase).toBe("active");
  });

  it("uses effective ticks, preserves an executing move on expiry and recovers independently", () => {
    const { a, m, tick, wait, activate, motion } = fight();
    activate();
    const s = a.sasukeCurse!;
    m.hitstop = 7;
    for (let t = 0; t < 7; t++) tick();
    expect(s.remaining).toBe(balance.durationTicks);
    for (let t = 0; t < balance.durationTicks - 2; t++) tick();
    expect(s.remaining).toBe(2);
    tick({ pressed: ["heavy"] });
    expect(a.move).toBe(sasukeCurseMoves.stand_heavy);
    tick();
    expect(s.phase).toBe("ending");
    expect(a.move).toBe(sasukeCurseMoves.stand_heavy);
    expect(a.attack("stand_medium")).toBe(false);
    wait(() => a.moveId === curseRevert);
    wait(() => a.sasukeCurse?.phase === "cooldown");
    expect(s.remaining).toBe(balance.cooldownTicks);
    motion(2, "heavy");
    expect(a.moveId).toBe("");
    wait(() => !a.sasukeCurse, balance.cooldownTicks);
    tick({ pressed: ["light"] });
    expect(a.move).toBe(sasukeMoves.stand_light);
  });

  it("is vulnerable during awakening and clears on KO and on the next round", () => {
    const { m, a, motion, activate, tick, wait } = fight();
    motion(2, "heavy");
    a.setState("hitstun");
    a.stun = 15;
    tick();
    expect(a.sasukeCurse?.phase).toBe("cooldown");
    wait(() => !a.sasukeCurse, balance.cooldownTicks + 2);
    activate();
    a.health = 0;
    tick();
    expect(a.sasukeCurse).toBeUndefined();
    expect(m.phase).not.toBe("fight");
    wait(() => m.round === 2, 400);
    expect(m.fighters[0].sasukeCurse).toBeUndefined();
  });

  it.each([1, -1] as const)("moves 10 percent faster and bursts once per jump facing %d", (side) => {
    const { a, b, tick, wait, activate } = fight(side);
    activate();
    tick({ direction: side });
    expect(a.vx).toBeCloseTo(side * a.data.speed * balance.movementMultiplier);
    tick({ direction: side, pressed: ["jump"] });
    wait(() => a.state === "air");
    const before = a.x;
    tick({ direction: side, pressed: ["dash"] });
    expect(a.sasukeCurse?.airBurstUsed).toBe(true);
    expect(a.sasukeCurse?.airBurstTick).toBeGreaterThan(0);
    for (let t = 1; t < balance.airBurst.speeds.length; t++) tick({ direction: side });
    expect((a.x - before) * side).toBeCloseTo(balance.airBurst.speeds.reduce((x, y) => x + y, 0));
    tick({ direction: side, pressed: ["dash"] });
    expect(a.sasukeCurse?.airBurstTick).toBe(0);
    wait(() => !a.airborne);
    tick();
    expect(a.sasukeCurse?.airBurstUsed).toBe(false);
    expect(a.y).toBe(FLOOR);
    expect(Math.abs(b.x - a.x)).toBeGreaterThanOrEqual(52);
  });

  it.each(Object.keys(sasukeMoves))("%s uses its own drawing, contact and damage on both sides", id => {
    for (const side of [1, -1] as const) {
      const { a, b, tick, activate, wait } = fight(side, 55);
      activate();
      const [stance, weight] = id.split("_");
      if (stance === "air") {
        a.y = FLOOR - 151;
        b.y = FLOOR - (weight === "heavy" ? 122 : 151);
        a.setState("air");
        b.setState("air");
      }
      const p = new FighterPresentation(sasukeAnimations);
      tick({ down: stance === "crouch", pressed: [weight as "light" | "medium" | "heavy"] });
      const move = sasukeCurseMoves[id];
      expect(a.move).toBe(move);
      expect(move.damage).toBe(Math.round(sasukeMoves[id].damage * 1.15));
      p.tick(a);
      expect(p.animator.clipName).toBe("curse_" + id);
      expect(p.animator.sprite().sheet).toBe("sasuke/curse.png");
      wait(() => a.hitConfirmed, 30);
      expect(a.attackShapes().length).toBeGreaterThan(0);
      expect(b.health).toBe(b.data.health - move.damage);
      expect(sasukeCurseArt.clips[id].frames).toHaveLength(3);
    }
  });

  it.each(sasukeSpecialIds)("%s has unique transformed timing, art and impact", (id: SasukeSpecialId) => {
    const [end, button, distance] = specials[id];
    for (const side of [1, -1] as const) {
      const { m, a, b, tick, activate, motion } = fight(side, distance);
      activate();
      motion(end, button);
      expect(a.move).toBe(sasukeCurseMoves[id]);
      expect(a.move?.recovery).not.toBe(sasukeSpecialMoves[id].recovery === 21 && id === "serpents" ? -1 : sasukeSpecialMoves[id].recovery);
      const emit = new Set<number>();
      for (let t = 0; t < 110; t++) {
        tick();
        for (const p of m.kiProjectiles) {
          expect(p.curse).toBe(true);
          emit.add(p.id);
        }
      }
      expect(emit.size).toBe(curseSpecials[id].shots?.length ?? 0);
      expect(b.health).toBeLessThan(b.data.health);
      expect(a.moveId).toBe("");
    }
  });

  it("replays activation, burst, projectiles and timed reversion from a snapshot", () => {
    const { m, a, tick, activate, motion } = fight(1, 325);
    activate();
    expect(winged(a)).toBe(true);
    motion(6, "light");
    const replica = restore(snapshot(m));
    for (let i = 0; i < 815; i++) {
      const input = i === 62 ? { ...neutral(), pressed: ["jump" as const] }
        : i === 73 ? { ...neutral(), pressed: ["dash" as const] } : neutral();
      replica.step([input, neutral()]);
      tick(input);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(m)));
    }
    expect(a.sasukeCurse?.phase).toBe("cooldown");
  });
});
