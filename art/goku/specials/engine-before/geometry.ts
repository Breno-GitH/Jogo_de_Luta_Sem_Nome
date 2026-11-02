import {
  overlaps,
  type AttackShape,
  type Capsule,
  type Point,
  type Rect,
} from "./types";

export function shapeBounds(shape: AttackShape): Rect {
  if (!("a" in shape)) return shape;
  const x = Math.min(shape.a.x, shape.b.x) - shape.r;
  const y = Math.min(shape.a.y, shape.b.y) - shape.r;
  return {
    x,
    y,
    w: Math.abs(shape.b.x - shape.a.x) + 2 * shape.r,
    h: Math.abs(shape.b.y - shape.a.y) + 2 * shape.r,
  };
}
export function unionBounds(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rects.map((r) => r.x + r.w)) - x,
    h: Math.max(...rects.map((r) => r.y + r.h)) - y,
  };
}
export function worldRect(
  rect: Rect,
  x: number,
  y: number,
  facing: number,
): Rect {
  return {
    x: x + (facing === 1 ? rect.x : -rect.x - rect.w),
    y: y + rect.y,
    w: rect.w,
    h: rect.h,
  };
}
export function worldCapsule(
  capsule: Capsule,
  x: number,
  y: number,
  facing: number,
): Capsule {
  return {
    a: { x: x + capsule.a.x * facing, y: y + capsule.a.y },
    b: { x: x + capsule.b.x * facing, y: y + capsule.b.y },
    r: capsule.r,
  };
}
function pointRectDistance(p: Point, r: Rect) {
  return Math.hypot(
    Math.max(r.x - p.x, 0, p.x - r.x - r.w),
    Math.max(r.y - p.y, 0, p.y - r.y - r.h),
  );
}
function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function segmentCrossesRect(a: Point, b: Point, r: Rect) {
  let low = 0,
    high = 1;
  for (const [origin, delta, min, max] of [
    [a.x, b.x - a.x, r.x, r.x + r.w],
    [a.y, b.y - a.y, r.y, r.y + r.h],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
    } else {
      let first = (min - origin) / delta,
        last = (max - origin) / delta;
      if (first > last) [first, last] = [last, first];
      low = Math.max(low, first);
      high = Math.min(high, last);
      if (low > high) return false;
    }
  }
  return true;
}
/** Exact segment/rectangle distance: diagonal blades do not hit empty AABB corners. */
export function shapeHitsRect(shape: AttackShape, r: Rect): boolean {
  if (!("a" in shape)) return overlaps(shape, r);
  if (segmentCrossesRect(shape.a, shape.b, r)) return true;
  let distance = Math.min(
    pointRectDistance(shape.a, r),
    pointRectDistance(shape.b, r),
  );
  for (const p of [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
  ])
    distance = Math.min(distance, pointSegmentDistance(p, shape.a, shape.b));
  return distance <= shape.r;
}
