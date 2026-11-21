import { describe, it, expect, vi } from "vitest";
import { equinoxCut } from "../src/render/asta-equinox-geometry";
import {
  astaUnionBlade,
  astaUnionScene,
  type AstaUnionState,
} from "../src/engine/asta-super";
import { unionBeats, unionPose } from "../src/engine/asta-super-acts";
function state(tick: number, facing = 1): AstaUnionState {
  return {
    attacker: 0,
    victim: 1,
    tick,
    hold: 0,
    openingTick: 14,
    scale: 1,
    facing,
    originX: 420,
    targetX: 700,
    targetY: 580,
  };
}
describe("Equinox is a cutting wave emitted by Demon-Slasher", () => {
  it.each([1, -1])(
    "starts at the actual weapon tip and crosses the gap, side %s",
    (facing) => {
      const s = state(unionBeats.release, facing),
        scene = astaUnionScene(s),
        pose = unionPose(s.tick, s.openingTick);
      const tip = astaUnionBlade(pose.sheet, pose.frame, "slasher").b,
        cut = equinoxCut(s);
      expect(cut.origin).toEqual([
        scene.attacker.x + tip.x * scene.attacker.facing,
        scene.attacker.y + tip.y,
      ]);
      expect(cut.noseX).toBe(cut.origin[0]);
      expect(cut.top).toBe(cut.origin[1]);
      expect(cut.bottom).toBe(cut.origin[1]);
      let previous = cut.origin[0];
      for (let t = unionBeats.release + 1; t <= unionBeats.impact; t++) {
        const next = equinoxCut(state(t, facing));
        expect((next.noseX - previous) * facing).toBeGreaterThan(0);
        previous = next.noseX;
        if (t < unionBeats.impact)
          expect((next.target - next.noseX) * facing).toBeGreaterThan(0);
      }
      expect(previous).toBe(cut.target);
    },
  );
  it.each([1, -1])(
    "has a smooth bowed edge, tapered tips and a moving ground/sky cut, side %s",
    (facing) => {
      const cut = equinoxCut(state(unionBeats.impact, facing));
      expect(cut.top).toBeLessThan(120);
      expect(cut.bottom).toBe(580);
      expect(Math.abs(cut.front[0][0] - cut.noseX)).toBeCloseTo(36);
      expect(cut.front[0]).toEqual(cut.back[0]);
      expect(Math.abs(cut.front.at(-1)![0] - cut.back.at(-1)![0])).toBeLessThan(
        0.01,
      );
      const widths = cut.front.map(([x], i) => Math.abs(x - cut.back[i][0]));
      expect(Math.max(...widths)).toBeGreaterThan(75);
      const x = cut.front.map(([x]) => x * facing);
      let reversals = 0,
        last = 0;
      for (let i = 1; i < x.length; i++) {
        const sign = Math.sign(x[i] - x[i - 1]);
        if (last && sign !== last) reversals++;
        last = sign;
      }
      expect(reversals).toBe(1); // one curved blade, no alternating lightning notches
      const before = equinoxCut(state(unionBeats.release + 4, facing));
      expect((cut.floorX - before.floorX) * facing).toBeGreaterThan(100);
      expect((cut.ceilingX - before.ceilingX) * facing).toBeGreaterThan(100);
    },
  );
  it("continues past the opponent and dissipates without retaining a pillar", () => {
    const cut = equinoxCut(state(unionBeats.impact + 18));
    expect(cut.noseX).toBeGreaterThan(cut.target + 100);
    expect(cut.fade).toBeLessThan(1);
    expect(equinoxCut(state(unionBeats.outro + 29)).active).toBe(false);
  });
  it("never uses a random source for propagation or returns different geometry for a replay", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw Error("unexpected randomness");
    });
    try {
      expect(equinoxCut(state(950))).toEqual(equinoxCut(state(950)));
    } finally {
      random.mockRestore();
    }
  });
});
