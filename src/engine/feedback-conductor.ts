import antennae from "../data/feedback-antennae.json";
import type { Move, Point } from "./types";

const unit = (n: number) => Math.max(0, Math.min(n, 1));
const ease = (n: number) => unit(n) ** 2 * (3 - 2 * unit(n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Point, b: Point, t: number): Point => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t),
});

export function feedbackCableSpline(nodes: readonly Point[]) {
  const sample = (i: number) => nodes[Math.max(0, Math.min(i, nodes.length - 1))];
  return nodes.slice(0, -1).flatMap((b, i) => {
    const a = sample(i - 1), c = sample(i + 1), d = sample(i + 2);
    return Array.from({ length: 5 }, (_, j) => {
      const t = j / 5;
      const at = (k: keyof Point) => .5 * (2*b[k] + (c[k]-a[k])*t +
        (2*a[k]-5*b[k]+4*c[k]-d[k])*t*t + (3*b[k]-a[k]-3*c[k]+d[k])*t*t*t);
      return { x: at("x"), y: at("y") };
    });
  }).concat(nodes.at(-1)!);
}

const defaultHead = { x: 12, y: -120 };
const resting = (head: Point, side: number) =>
  antennae.rest[side].map(([x, y]) => ({ x: head.x + x, y: head.y + y }));

function releasedPath(head: Point, side: number, end: Point, amount: number, heavy: boolean) {
  const rest = resting(head, side);
  const arc = heavy && side === 0 ? -62 : heavy ? -21 : -36;
  const nodes = [
    rest[0], { x: head.x + (side ? 10 : -7), y: head.y - (side ? 14 : 22) },
    { x: head.x + 22, y: head.y - (side ? 22 : 40) },
    { x: lerp(head.x, end.x, .44), y: end.y + arc },
    { x: lerp(head.x, end.x, .63), y: end.y + arc * .80 },
    { x: lerp(head.x, end.x, .78), y: end.y + arc * .42 },
    { x: lerp(head.x, end.x, .90), y: end.y + arc * .12 },
    end,
  ];
  return feedbackCableSpline(rest.map((p, i) => mix(p, nodes[i], amount)));
}

export function feedbackConductorPaths(move: Move, tick: number, head = defaultHead) {
  const phase = tick - move.startup;
  const heavy = move.ben?.cable === "wide";
  const windup = heavy ? 6 : 3;
  const amount = phase < 0
    ? .69 * ease((tick - windup) / (move.startup - windup))
    : phase < move.active
      ? .69 + .31 * ease(phase / (heavy ? 6 : 4))
      : 1 - ease((phase - move.active) / (heavy ? 14 : 9));
  const swing = ease((phase + 2) / Math.max(move.active - 1, 1));
  return [0, 1].map(side => {
    if (!heavy && side === 0)
      return feedbackCableSpline(resting(head, side).map((p, i) => ({
        x: p.x - i * 1.4 * amount, y: p.y - i * amount,
      })));
    const far = heavy && side === 0;
    const end = {
      x: (heavy ? far ? 174 : 157 : 115) + (far ? 5 : 8) * swing,
      y: far ? -108 + 12 * swing : heavy ? -72 - 9 * swing : -91 + 4 * swing,
    };
    // The last two nodes determine the visible connector and the hit capsule.
    // Its launch is world-relative once active, even when a pose moves the head.
    const reach = ease(amount / .69);
    return releasedPath(defaultHead, side, end, amount, heavy).map((p, i) => {
      const weight = 1 - reach * unit(i / 25);
      return { x: p.x + (head.x - defaultHead.x) * weight,
        y: p.y + (head.y - defaultHead.y) * weight };
    });
  });
}

export function feedbackConductorContact(move: Move, tick: number) {
  const paths = feedbackConductorPaths(move, tick);
  return (move.ben?.cable === "wide" ? paths : paths.slice(1)).map(points => {
    const tip = points.at(-1)!, back = points.at(-4)!;
    const n = Math.hypot(tip.x - back.x, tip.y - back.y) || 1;
    // Test the connector and prongs. The trailing cable has no capture volume.
    return { a: tip, b: {
      x: tip.x + 8 * (tip.x - back.x) / n,
      y: tip.y + 8 * (tip.y - back.y) / n,
    }, r: 6 };
  });
}

export function feedbackGripPaths(head: Point, target: Point, tick: number, duration: number, heavy: boolean) {
  const withdrawal = 1 - ease((tick - (duration - (heavy ? 7 : 5))) / (heavy ? 7 : 5));
  const latch = ease((tick + 1) / (heavy ? 7 : 4));
  return [0, 1].map(side => {
    if (!heavy && side === 0) return feedbackCableSpline(resting(head, side));
    const upper = heavy && side === 0;
    const end = { x: target.x + (upper ? -1 : -12), y: target.y + (upper ? -111 : heavy ? -72 : -90) };
    const wrap = (upper ? 20 : heavy ? 15 : 4) * latch;
    const rest = resting(head, side);
    const path = [
      rest[0], { x: head.x + (upper ? -11 : 9), y: head.y - (upper ? 28 : 13) },
      { x: head.x + 19, y: head.y - (upper ? 48 : 18) },
      { x: lerp(head.x, end.x, .68), y: end.y - (upper ? 45 : 25) },
      { x: end.x + wrap * .25, y: end.y - (upper ? 28 : 14) },
      { x: end.x + wrap, y: end.y - (upper ? 14 : -10) },
      { x: end.x + wrap * .65, y: end.y + (upper ? 4 : 5) }, end,
    ];
    return feedbackCableSpline(rest.map((p, i) => mix(p, path[i], withdrawal)));
  });
}
