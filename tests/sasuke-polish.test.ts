import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { Match, type CombatHit } from "../src/engine/combat";
import {
  fireDragonPoint,
  fireDragonVolumes,
  sasukePolish,
} from "../src/engine/sasuke-polish";
import { neutral, type InputFrame } from "../src/engine/types";
import { hashState, restore, snapshot } from "../src/engine/state";
import { chidoriCamera } from "../src/render/sasuke-special-fx";
import { sasukeAnimations } from "../src/render/sasuke-animations";

function fixture(side: 1 | -1, gap: number, curse = false, corner = false) {
  const m = new Match(characters.sasuke, {}, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  b.x = corner ? (side > 0 ? 1240 : 40) : 640 + side * gap;
  a.x = b.x - side * gap;
  a.facing = side;
  b.facing = -side;
  if (curse)
    a.sasukeCurse = {
      phase: "active",
      remaining: 780,
      airBurstUsed: false,
      airBurstTick: 0,
    };
  const log: CombatHit[] = [];
  const tick = (x?: Partial<InputFrame>, y?: Partial<InputFrame>) => {
    m.step([
      { ...neutral(), ...x },
      { ...neutral(), ...y },
    ]);
    log.push(...m.hits);
  };
  const activate = (
    move: "goryuka" | "chidori" | "nagashi",
    guard?: Partial<InputFrame>,
  ) => {
    tick({ down: true }, guard);
    if (move === "nagashi") tick(undefined, guard);
    tick(
      {
        down: move === "nagashi",
        direction:
          move === "nagashi"
            ? 0
            : move === "goryuka"
              ? (-side as -1 | 1)
              : side,
        pressed: [move === "nagashi" ? "medium" : "heavy"],
      },
      guard,
    );
    expect(a.moveId).toBe(move);
  };
  return { m, a, b, tick, activate, log };
}

describe("Polished Sasuke specials", () => {
  it.each([1, -1] as const)(
    "Goryuka serpent follows five waves and exits fully, direction %d",
    (side) => {
      const { m, a, b, tick, activate, log } = fixture(side, 1010, false, true);
      activate("goryuka");
      let replica: Match | undefined;
      const vertical: number[] = [];
      let last = 0,
        lastTail = 0,
        sawImpactInFlight = false;
      for (let i = 0; i < 155; i++) {
        tick();
        if (replica) {
          replica.step([neutral(), neutral()]);
          expect(hashState(snapshot(replica))).toBe(hashState(snapshot(m)));
        }
        const dragon = m.kiProjectiles[0];
        if (!dragon?.wave) continue;
        const w = dragon.wave;
        if (!replica) replica = restore(snapshot(m));
        expect(dragon.x).toBeCloseTo(w.origin.x + w.distance * side);
        expect(dragon.y).toBeCloseTo(fireDragonPoint(w, w.distance).y);
        if (w.distance > last && dragon.x >= 0 && dragon.x <= 1280)
          vertical.push(dragon.y);
        last = w.distance;
        lastTail = fireDragonPoint(
          w,
          w.distance - sasukePolish.goryuka.bodyLength,
        ).x;
        const volumes = fireDragonVolumes(
          w,
          { x: dragon.previousX, y: dragon.previousY },
          dragon.radius,
        );
        expect(volumes[0].b).toEqual({ x: dragon.x, y: dragon.y });
        expect(
          volumes.every(
            (s) =>
              Math.abs(s.a.x - dragon.x) <=
              sasukePolish.goryuka.offensiveLength,
          ),
        ).toBe(true);
        sawImpactInFlight ||= w.struck && dragon.state === "flight";
      }
      const turns = vertical
        .slice(1, -1)
        .filter((v, i) => (v - vertical[i]) * (vertical[i + 2] - v) < 0);
      expect(turns.length).toBeGreaterThanOrEqual(8);
      expect(turns.length).toBeLessThanOrEqual(12);
      expect(side > 0 ? lastTail : 1280 - lastTail).toBeGreaterThan(1280);
      expect(m.kiProjectiles).toHaveLength(0);
      expect(log.filter((h) => h.move === "goryuka")).toHaveLength(1);
      expect(sawImpactInFlight).toBe(true);
      expect(b.health).toBe(
        b.data.health - a.data.specialMoves!.goryuka.damage,
      );
    },
  );

  it.each([false, true])(
    "Chidori advances continuously, hits farther away and briefly frames contact, curse=%s",
    (curse) => {
      const { m, a, b, tick, activate, log } = fixture(1, 263, curse);
      const initial = a.x;
      activate("chidori");
      expect(a.move!.poses).toHaveLength(6);
      expect(
        sasukeAnimations.clips[curse ? "curse_chidori" : "chidori"].frames,
      ).toHaveLength(6);
      let zoom = 1;
      for (let i = 0; i < 90; i++) {
        const x = a.x;
        tick();
        expect(Math.abs(a.x - x)).toBeLessThanOrEqual(26);
        zoom = Math.max(zoom, chidoriCamera(m)?.scale ?? 1);
      }
      expect(a.x - initial).toBeGreaterThan(115);
      expect(zoom).toBeGreaterThan(1.1);
      expect(log.filter((h) => h.move === "chidori")).toHaveLength(1);
      expect(b.health).toBe(
        b.data.health - Math.round(105 * (curse ? 1.15 : 1)),
      );
      expect(chidoriCamera(m)).toBeUndefined();
      expect(a.state).toBe("idle");
    },
  );

  it.each(["block", "whiff"] as const)(
    "Chidori remains a normal special on %s",
    (result) => {
      const { m, a, b, tick, activate, log } = fixture(
        -1,
        result === "block" ? 240 : 530,
        false,
        true,
      );
      const guard = result === "block" ? { direction: -1 as const } : undefined;
      activate("chidori", guard);
      for (let i = 0; i < 82; i++) {
        tick(undefined, guard);
        expect(chidoriCamera(m)).toBeUndefined();
      }
      expect(
        log.filter((h) => h.move === "chidori").map((h) => h.blocked),
      ).toEqual(result === "block" ? [true] : []);
      expect(b.health).toBe(b.data.health);
      expect(a.state).toBe("idle");
    },
  );

  it.each([false, true])(
    "Nagashi can hit and be blocked from range, curse=%s",
    (curse) => {
      for (const blocked of [false, true]) {
        const { a, b, tick, activate, log } = fixture(
          1,
          curse ? 157 : 138,
          curse,
          true,
        );
        const guard = blocked
          ? { direction: 1 as const, down: true }
          : undefined;
        activate("nagashi", guard);
        let reach = 0;
        for (let i = 0; i < 84; i++) {
          tick(undefined, guard);
          const box = a.hitbox();
          if (box) reach = Math.max(reach, box.w);
        }
        expect(reach).toBeGreaterThan(curse ? 280 : 245);
        expect(
          log.filter((h) => h.move === "nagashi").map((h) => h.blocked),
        ).toEqual([blocked]);
        expect(b.health).toBe(b.data.health - (blocked ? 0 : curse ? 69 : 60));
        expect(a.attackShapes()).toHaveLength(0);
        expect(a.state).toBe("idle");
      }
    },
  );
});
