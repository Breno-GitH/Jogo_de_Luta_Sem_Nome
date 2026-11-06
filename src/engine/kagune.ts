import type { Point } from "./types";

export const kaguneIds = [
  "upperRear",
  "upperFront",
  "lowerRear",
  "lowerFront",
] as const;
export type KaguneId = (typeof kaguneIds)[number];
export type KaguneLayer = "behind" | "front";
export type KagunePhase =
  "folded" | "idle" | "extending" | "extended" | "retracting";
type Curve = readonly [Point, Point, Point];

interface Profile {
  root: Point;
  folded: Curve;
  ready: Curve;
  extended: Curve;
  width: number;
  tempo: number;
  offset: number;
  hook: number;
}
const p = (x: number, y: number): Point => ({ x, y });
const profiles: Record<KaguneId, Profile> = {
  upperRear: {
    root: p(-3, -4),
    folded: [p(-14, -3), p(-26, -21), p(-16, -30)],
    ready: [p(-49, 11), p(-111, -14), p(-88, -69)],
    extended: [p(-59, -50), p(48, -107), p(174, -60)],
    width: 15,
    tempo: 124,
    offset: 9,
    hook: -7,
  },
  upperFront: {
    root: p(0, -4),
    folded: [p(-9, -14), p(-1, -33), p(10, -26)],
    ready: [p(-36, -39), p(1, -87), p(81, -62)],
    extended: [p(-19, -59), p(78, -91), p(204, -59)],
    width: 13,
    tempo: 109,
    offset: 34,
    hook: 6,
  },
  lowerRear: {
    root: p(-4, 3),
    folded: [p(-14, 10), p(-27, 5), p(-30, -7)],
    ready: [p(-52, 30), p(-112, 55), p(-145, 33)],
    extended: [p(-63, 49), p(53, 58), p(185, 15)],
    width: 17,
    tempo: 143,
    offset: 58,
    hook: 7,
  },
  lowerFront: {
    root: p(0, 4),
    folded: [p(-11, 17), p(9, 26), p(20, 16)],
    ready: [p(-14, 45), p(55, 53), p(102, 16)],
    extended: [p(-8, 48), p(82, 39), p(223, 7)],
    width: 14,
    tempo: 131,
    offset: 89,
    hook: -6,
  },
};

export interface KagunePose {
  id: KaguneId;
  phase: KagunePhase;
  layer: KaguneLayer;
  origin: Point;
  tip: Point;
  spine: readonly Point[];
  radius: readonly number[];
  hook: number;
  length: number;
}
interface Tendril {
  extension: number;
  from: number;
  goal: number;
  duration: number;
  age: number;
  layer: KaguneLayer;
  phase: KagunePhase;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Point, b: Point, t: number) =>
  p(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
const settled = (value: number): KagunePhase =>
  value === 0 ? "folded" : value <= 1 ? "idle" : "extended";

function samplePath(nodes: readonly Point[]) {
  const spine: Point[] = [nodes[0]];
  // Three cubic spans with tangent continuity through the authored bends.
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i - 1] ?? nodes[i],
      b = nodes[i];
    const c = nodes[i + 1],
      d = nodes[i + 2] ?? c;
    for (let j = 1; j <= 8; j++) {
      const t = j / 8,
        t2 = t * t,
        t3 = t2 * t;
      const coordinate = (axis: "x" | "y") =>
        b[axis] +
        (c[axis] - a[axis]) * 0.5 * t +
        (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * 0.5 * t2 +
        (3 * b[axis] - a[axis] - 3 * c[axis] + d[axis]) * 0.5 * t3;
      spine.push(p(coordinate("x"), coordinate("y")));
    }
  }
  return spine;
}

const newTendril = (): Tendril => ({
  extension: 1,
  from: 1,
  goal: 1,
  duration: 0,
  age: 0,
  layer: "behind",
  phase: "idle",
});

/** Presentation-only limb controller. Combat can later consume the same
 * world-space spine, radii and tip after opting in to collision. */
export class Rinkaku {
  private limbs: Record<KaguneId, Tendril> = {
    upperRear: newTendril(),
    upperFront: newTendril(),
    lowerRear: newTendril(),
    lowerFront: newTendril(),
  };
  tick = 0;

  setLayer(id: KaguneId, layer: KaguneLayer) {
    this.limbs[id].layer = layer;
  }

  /** Zero folds the limb, one is its guard pose and two fully extends it. */
  move(id: KaguneId, extension: number, ticks: number) {
    const limb = this.limbs[id];
    const goal = clamp(extension, 0, 2);
    limb.from = limb.extension;
    limb.goal = goal;
    limb.age = 0;
    limb.duration = Math.max(0, Math.floor(ticks));
    if (!limb.duration || goal === limb.from) {
      limb.extension = goal;
      limb.phase = settled(goal);
    } else limb.phase = goal > limb.from ? "extending" : "retracting";
  }

  interrupt(ticks = 14) {
    for (const id of kaguneIds) {
      this.setLayer(id, "behind");
      this.move(id, 0, ticks);
    }
  }

  step() {
    this.tick++;
    for (const id of kaguneIds) {
      const limb = this.limbs[id];
      if (limb.extension === limb.goal) continue;
      const t = clamp(++limb.age / limb.duration, 0, 1);
      limb.extension = lerp(limb.from, limb.goal, t * t * (3 - 2 * t));
      if (t === 1) {
        limb.extension = limb.goal;
        limb.phase = settled(limb.goal);
      }
    }
  }

  poses(lumbar: Point, facing: 1 | -1): KagunePose[] {
    return kaguneIds.map((id) => {
      const profile = profiles[id],
        limb = this.limbs[id];
      const e = limb.extension;
      const from = e <= 1 ? profile.folded : profile.ready;
      const to = e <= 1 ? profile.ready : profile.extended;
      const time = ((this.tick + profile.offset) * Math.PI * 2) / profile.tempo;
      const wave = Math.min(1, e) * (1 - 0.65 * Math.max(0, e - 1));
      const origin = p(
        lumbar.x + profile.root.x * facing,
        lumbar.y + profile.root.y,
      );
      const nodes = from.map((point, i) => {
        const pt = mix(point, to[i], e <= 1 ? e : e - 1);
        return p(
          pt.x + Math.sin(time - i * 0.85) * wave * (i + 1),
          pt.y + Math.cos(time - i * 0.85) * wave * (i + 2),
        );
      });
      const spine = samplePath([p(0, 0), ...nodes]).map((pt) =>
        p(origin.x + pt.x * facing, origin.y + pt.y),
      );
      const radius = spine.map((_, i) => {
        const t = i / (spine.length - 1);
        const taper = Math.pow(1 - t, 0.73);
        const ridge = 0.66 + 0.34 * Math.sin(Math.PI * Math.min(1, t + 0.19));
        return Math.max(
          0.45,
          profile.width * taper * ridge * (0.59 + 0.41 * Math.min(1, e)),
        );
      });
      let length = 0;
      for (let i = 1; i < spine.length; i++)
        length += Math.hypot(
          spine[i].x - spine[i - 1].x,
          spine[i].y - spine[i - 1].y,
        );
      return {
        id,
        phase: limb.phase,
        layer: limb.layer,
        origin,
        tip: spine[spine.length - 1],
        spine,
        radius,
        hook: profile.hook * facing,
        length,
      };
    });
  }
}
