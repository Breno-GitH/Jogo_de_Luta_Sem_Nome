import type { Capsule, Point } from "./types";

export interface ElasticPose {
  root: Point;
  tip: Point;
  radius: number;
  bend: number;
  maximumLength: number;
  active: boolean;
  profile?: "arm" | "leg";
}
export interface ElasticGeometry {
  centers: Point[];
  radii: number[];
  tip: Point;
  limbHurtboxes: Capsule[];
  hitboxes: Capsule[];
}
const pixel = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Pure native-pixel geometry shared by future moves and the visual inspector.
 * Endpoint/phase comes from fixed-tick move data, never from rendered pixels.
 * A tip hitbox and optional limb hurtboxes are distinct; neutral defaults off.
 */
export function elasticGeometry(pose: ElasticPose): ElasticGeometry {
  const finite = [
    pose.root.x,
    pose.root.y,
    pose.tip.x,
    pose.tip.y,
    pose.radius,
    pose.bend,
    pose.maximumLength,
  ].every(Number.isFinite);
  if (
    !finite ||
    pose.radius < 2 ||
    pose.radius > 12 ||
    pose.maximumLength < 0 ||
    pose.maximumLength > 1024
  )
    throw new RangeError("Invalid elastic limb geometry");
  const dx = pose.tip.x - pose.root.x,
    dy = pose.tip.y - pose.root.y;
  const length = Math.hypot(dx, dy),
    factor = Math.min(1, pose.maximumLength / (length || 1));
  const tip = pixel({
    x: pose.root.x + dx * factor,
    y: pose.root.y + dy * factor,
  });
  const distance = Math.hypot(tip.x - pose.root.x, tip.y - pose.root.y);
  const nx = -(tip.y - pose.root.y) / (distance || 1),
    ny = (tip.x - pose.root.x) / (distance || 1);
  const bend = Math.max(-distance / 4, Math.min(distance / 4, pose.bend));
  const count = Math.max(1, Math.ceil(distance / 8));
  const centers = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      bow = 4 * t * (1 - t) * bend;
    return pixel({
      x: pose.root.x + (tip.x - pose.root.x) * t + nx * bow,
      y: pose.root.y + (tip.y - pose.root.y) * t + ny * bow,
    });
  });
  const radii = centers.map((_, i) => {
    const t = i / count;
    if (!pose.profile)
      return Math.max(2, Math.round(pose.radius * (1 - 0.18 * t)));
    const muscle = Math.sin(Math.PI * t) * (pose.profile === "leg" ? 2.1 : 1.6);
    const joint = 1.25 * Math.max(0, 1 - 7 * Math.abs(t - 0.53));
    return Math.round(pose.radius * (1 - 0.33 * t) + muscle - joint);
  });
  return {
    centers,
    radii,
    tip,
    limbHurtboxes: centers
      .slice(1)
      .map((b, i) => ({ a: centers[i], b, r: Math.max(radii[i], radii[i + 1]) })),
    hitboxes: pose.active
      ? [{ a: tip, b: { x: tip.x + 11, y: tip.y }, r: 6 }]
      : [],
  };
}

/** Apply the same facing/origin convention as all existing combat capsules. */
export function placeElastic(
  geometry: ElasticGeometry,
  origin: Point,
  facing: 1 | -1,
) {
  const p = (v: Point) => ({ x: origin.x + facing * v.x, y: origin.y + v.y });
  const capsule = (v: Capsule): Capsule => ({ a: p(v.a), b: p(v.b), r: v.r });
  return {
    ...geometry,
    centers: geometry.centers.map(p),
    tip: p(geometry.tip),
    limbHurtboxes: geometry.limbHurtboxes.map(capsule),
    hitboxes: geometry.hitboxes.map(capsule),
  };
}
