import type { KaguneId, KagunePose } from "../engine/kagune";
import type { Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

const palettes: Record<KaguneId, readonly string[]> = {
  upperRear: ["#180b16", "#401326", "#681a2e", "#a92a43", "#d74452", "#ff796c"],
  upperFront: [
    "#1d0b16",
    "#59152c",
    "#8c2138",
    "#c13349",
    "#e55056",
    "#ff9b80",
  ],
  lowerRear: ["#160a14", "#431426", "#711a30", "#9c243a", "#c53849", "#f56b61"],
  lowerFront: [
    "#1c0a14",
    "#501327",
    "#861c32",
    "#bb2a41",
    "#e44951",
    "#ff8772",
  ],
};

export function drawKagune(
  c: CanvasRenderingContext2D,
  pose: KagunePose,
  facing: 1 | -1,
) {
  const { spine, radius, id } = pose;
  const last = spine.length - 1;
  const [ink, shadow, blood, mid, light, hot] = palettes[id];
  const normals = spine.map((_, i) => {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(last, i + 1)];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (-dy * facing) / len, y: (dx * facing) / len };
  });
  const edge = (i: number, offset: number, inset = 0): Point => {
    const w = offset * Math.max(0.4, radius[i] - inset);
    return {
      x: Math.round(spine[i].x + normals[i].x * w),
      y: Math.round(spine[i].y + normals[i].y * w),
    };
  };
  function band(color: string, lo: number, hi: number, inset = 0) {
    const border = spine.map((_, i) => edge(i, lo, inset));
    for (let i = last; i >= 0; i--) border.push(edge(i, hi, inset));
    fillPixels(c, border, color);
  }

  // Dark solid silhouette, broad underside and two bands of top-side light.
  band(ink, -1, 1);
  band(shadow, -1, 1, 1.4);
  band(blood, -0.94, 0.54, 2.1);
  band(mid, -0.87, 0.02, 2.3);
  band(light, -0.76, -0.37, 2.6);

  // Uneven overlapping plates, more tightly spaced toward the end.
  for (let i = 2; i < last - 4; i += 3) {
    if (radius[i] < 3.5) break;
    const ridge = i % 2 ? -0.65 : -0.76;
    fillPixels(
      c,
      [
        edge(i - 1, ridge, 1),
        edge(i + 1, -0.52, 1),
        edge(i + 2, 0.34, 1),
        edge(i + 1, 0.23, 1),
        edge(i, -0.21, 1),
      ],
      shadow,
    );
    fillPixels(
      c,
      [
        edge(i, -0.79, 2),
        edge(i + 1, -0.72, 2),
        edge(i + 2, -0.2, 2),
        edge(i + 1, -0.36, 2),
      ],
      light,
    );
    if (i % 2 === 0)
      fillPixels(
        c,
        [edge(i, -0.72, 2), edge(i + 1, -0.58, 2), edge(i + 1, -0.29, 2)],
        hot,
      );
  }

  // A separate asymmetric hooked point. Its distal pixel is the same tip
  // that the controller exposes for targeting or future hit detection.
  const base = spine[last - 5];
  const throat = spine[last - 2];
  const n = normals[last - 2];
  const tip = edge(last, 0);
  const size = Math.min(1, pose.length / 100);
  const bend = pose.hook * size;
  const turn = (value: number) => ({
    x: Math.round(throat.x + n.x * value),
    y: Math.round(throat.y + n.y * value),
  });
  const root = { x: Math.round(base.x), y: Math.round(base.y) };
  fillPixels(
    c,
    [
      edge(last - 5, -0.86),
      turn(bend - 3 * size),
      tip,
      turn(bend + 3 * size),
      edge(last - 5, 0.86),
    ],
    ink,
  );
  fillPixels(
    c,
    [
      edge(last - 5, -0.61, 1.3),
      turn(bend - 0.8 * size),
      tip,
      turn(bend + 1.5 * size),
      root,
    ],
    mid,
  );
  fillPixels(
    c,
    [edge(last - 4, -0.49, 1.6), turn(bend - 0.9 * size), tip],
    light,
  );
}
