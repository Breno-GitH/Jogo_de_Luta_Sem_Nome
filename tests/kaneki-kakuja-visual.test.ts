import { expect, it } from "vitest";
import art from "../src/data/kaneki-centipede-art.json";
import { centipedeConfig, centipedeScene, type CentipedeState } from "../src/engine/kaneki-centipede";
import { Rinkaku } from "../src/engine/kagune";
import { centipedeRig, type KakujaBack } from "../src/render/kaneki-centipede-rig";

const floor = 580;
function sample(tick: number, side: 1 | -1) {
  const state: CentipedeState = {
    attacker: 0, victim: 1, tick, hold: 0, scale: 1, facing: side,
    originX: 640, originY: floor, targetX: 640 + 120 * side, targetY: floor,
    source: "strike", grip: "lowerFront",
  };
  const {attacker} = centipedeScene(state);
  const cel = art.back["kaneki/centipede-transformation.png"][4];
  const anchor = (index: number) => ({
    x: attacker.x + cel[index][0] * attacker.facing,
    y: attacker.y + cel[index][1],
  });
  const back: KakujaBack = [anchor(0), anchor(1), anchor(2)];
  const passive = new Rinkaku().poses(back[2], side, floor);
  return { limbs:centipedeRig(state,back,passive,floor), back, scene:centipedeScene(state) };
}

it.each([1, -1] as const)("keeps four organic and two segmented limbs through the whole Kakuja (%s)", side => {
  for (const tick of [60, 82, 113, 143, 169, 196, 226, 246, 275, 291, 312, 352, 367, 388, 405]) {
    const {limbs,back} = sample(tick,side);
    expect(limbs).toHaveLength(6);
    const tiers = (["upper", "middle", "lower"] as const);
    for (const [i,tier] of tiers.entries()) {
      const pair = limbs.filter(l => l.tier === tier);
      expect(pair).toHaveLength(2);
      expect(Math.hypot(pair[0].tip.x-pair[1].tip.x,pair[0].tip.y-pair[1].tip.y)).toBeGreaterThan(18);
      for (const limb of pair) {
        expect(limb.spine[0]).toEqual(limb.origin);
        expect(Math.hypot(limb.origin.x-back[i].x,limb.origin.y-back[i].y)).toBeLessThan(8);
        expect(Boolean(limb.kakuja)).toBe(tier === "middle");
        expect(limb.length).toBeGreaterThan(70);
        expect(limb.spine.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
        if (tier === "middle") expect(Math.max(...limb.radius)).toBeGreaterThan(22);
        else expect(Math.max(...limb.radius)).toBeLessThan(13);
      }
    }
  }
});

it("puts the first shell on the wall and wraps the captive above and below", () => {
  const plant = sample(centipedeConfig.phases.plant,1);
  expect(plant.limbs[0].tip.x).toBeCloseTo(plant.scene.wall,2);
  for(const tick of [275,352]) {
    const {limbs,scene} = sample(tick,1);
    const [upper,lower] = limbs.filter(limb=>limb.tier==="middle");
    const center = scene.victim.y-70;
    expect(upper.tip.y).toBeLessThan(center);
    expect(lower.tip.y).toBeGreaterThan(center);
    for(const limb of [upper,lower]) expect(Math.abs(limb.tip.x-scene.victim.x)).toBeLessThan(25);
  }
});

it("grows and retracts only the extra middle pair", () => {
  const before = sample(0,1).limbs, forming = sample(24,1).limbs;
  const complete = sample(60,1).limbs, end = sample(centipedeConfig.duration,1).limbs;
  const middle = (limbs: typeof before) => limbs.find(l => l.tier === "middle");
  expect(before).toHaveLength(4);
  expect(end).toHaveLength(4);
  expect(middle(complete)!.length).toBeGreaterThan(middle(forming)!.length * 2);
  expect(before.every(l => !l.kakuja) && end.every(l => !l.kakuja)).toBe(true);
});

