import {
  astaUnionBlade,
  astaUnionScene,
  type AstaUnionState,
} from "../engine/asta-super";
import { unionBeats, unionPose } from "../engine/asta-super-acts";
export type CutPoint = readonly [number, number];
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
/** Cosmetic cutting wave: emission is locked to the actual katana tip at release.
 * A straight cleaving front crosses the gap instead of appearing on the victim.
 * All arrivals derive from the same cinematic clock; this module never applies damage. */
export function equinoxCut(s: AstaUnionState) {
  const release = unionBeats.release,
    impact = unionBeats.impact;
  const launch = astaUnionScene({ ...s, tick: release }),
    pose = unionPose(release, s.openingTick);
  const blade = astaUnionBlade(pose.sheet, pose.frame, "slasher").b;
  const origin: CutPoint = [
    launch.attacker.x + blade.x * launch.attacker.facing,
    launch.attacker.y + blade.y,
  ];
  const contact = astaUnionScene({ ...s, tick: impact }),
    target = contact.plane.x,
    f = s.facing;
  const age = s.tick - release,
    progress = clamp(age / (impact - release));
  const growth = 1 - Math.pow(1 - clamp(age / 8), 2);
  const continuation = clamp((s.tick - impact) / 28);
  const noseX = mix(origin[0], target, progress) + f * continuation * 200;
  const top = mix(origin[1], contact.plane.top - 300, growth);
  const bottom = mix(origin[1], contact.plane.bottom, clamp(age / 3));
  const front: CutPoint[] = [],
    back: CutPoint[] = [];
  for (let i = 0; i <= 32; i++) {
    const p = i / 32;
    const x = noseX,
      y = mix(top, bottom, p);
    // An elongated cutting PLANE, with short tapered ends, not an oval projectile.
    // The continuous front stays straight; only the trailing anti-magic is torn.
    const taper = Math.min(1, p / 0.08, (1 - p) / 0.05);
    const width =
      (10 + 82 * growth) * taper * (0.88 + Math.sin(Math.PI * p) * 0.12);
    front.push([x, y]);
    back.push([x - f * width, y]);
  }
  const fade = 1 - clamp((s.tick - impact - 10) / 30);
  const residue = 1 - clamp((s.tick - unionBeats.outro) / 28);
  return {
    origin,
    target,
    progress,
    growth,
    noseX,
    top,
    bottom,
    front,
    back,
    fade,
    residue,
    floorX: front.at(-1)![0],
    ceilingX: front[0][0],
    facing: f,
    active: age >= 0 && s.tick < unionBeats.outro + 28,
  };
}
