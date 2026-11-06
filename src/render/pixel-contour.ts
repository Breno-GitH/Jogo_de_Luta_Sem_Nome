import type { Point } from "../engine/types";

/** Scan-convert a contour at native pixel resolution, even with a rotated cel. */
export function fillPixels(
  c: CanvasRenderingContext2D,
  contour: Point[],
  color: string,
) {
  const min = Math.min(...contour.map((p) => p.y));
  const max = Math.max(...contour.map((p) => p.y));
  c.fillStyle = color;
  for (let y = min; y < max; y++) {
    const crossings: number[] = [];
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const a = contour[j],
        b = contour[i];
      if (a.y > y + 0.5 === b.y > y + 0.5) continue;
      crossings.push(a.x + ((y + 0.5 - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.ceil(crossings[i] - 0.5);
      const right = Math.ceil(crossings[i + 1] - 0.5);
      if (right > left) c.fillRect(left, y, right - left, 1);
    }
  }
}
