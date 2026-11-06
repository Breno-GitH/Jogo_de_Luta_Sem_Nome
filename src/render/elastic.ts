import config from "../data/luffy-elastic.json";
import { luffyFootPoint, type FootPose } from "../engine/luffy-foot";
import type { ElasticGeometry } from "../engine/elastic";
import type { Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

type ColorSet = typeof config.colors;
type Terminal = {
  foot: boolean;
  axis: Point;
  palm?: boolean;
  footPose?: FootPose;
};
export type ElasticFinish = {
  recoil?: number;
  rootShift?: number;
};

const denim = {
  deep: "#182335",
  base: "#304571",
  light: "#506393",
  cuff: "#c7b9a7",
  white: "#f4e4c8",
};

type Ink = keyof ColorSet | "sole" | "leather" | "soleLight";
type Patch = [Ink, number[][]];
const sandal: Patch[] = [
  [
    "outline",
    [
      [-10, -4],
      [-6, -7],
      [-1, -7],
      [3, -4],
      [8, -3],
      [12, -3],
      [15, -1],
      [16, 2],
      [16, 5],
      [13, 8],
      [-7, 8],
      [-10, 6],
    ],
  ],
  [
    "shadow",
    [
      [-8, -3],
      [-5, -6],
      [-2, -6],
      [3, -3],
      [9, -2],
      [13, -2],
      [15, 0],
      [15, 4],
      [12, 6],
      [-7, 6],
      [-9, 4],
    ],
  ],
  [
    "base",
    [
      [-7, -4],
      [-3, -6],
      [2, -3],
      [6, -2],
      [13, -1],
      [15, 1],
      [13, 4],
      [-7, 4],
      [-8, 2],
    ],
  ],
  [
    "light",
    [
      [-6, -4],
      [-4, -5],
      [-2, -5],
      [2, -2],
      [8, -1],
      [13, 0],
      [13, 1],
      [10, 2],
      [1, 1],
      [-5, 2],
    ],
  ],
  [
    "sole",
    [
      [-9, 4],
      [-5, 5],
      [12, 4],
      [15, 3],
      [15, 5],
      [12, 7],
      [-7, 7],
      [-9, 6],
    ],
  ],
  [
    "soleLight",
    [
      [-7, 5],
      [3, 5],
      [12, 4],
      [14, 4],
      [12, 5],
      [5, 6],
      [-7, 6],
    ],
  ],
  [
    "leather",
    [
      [-2, -6],
      [0, -6],
      [4, -3],
      [7, 3],
      [6, 5],
      [4, 5],
      [3, 2],
      [0, -2],
    ],
  ],
  [
    "leather",
    [
      [5, -2],
      [7, -3],
      [10, -1],
      [11, 4],
      [9, 5],
      [8, 1],
    ],
  ],
  [
    "shadow",
    [
      [12, -1],
      [13, 0],
      [13, 2],
      [12, 2],
    ],
  ],
  [
    "highlight",
    [
      [14, 0],
      [15, 1],
      [14, 3],
      [13, 2],
    ],
  ],
];
const fist: Patch[] = [
  [
    "outline",
    [
      [-9, -5],
      [-3, -6],
      [0, -7],
      [2, -9],
      [7, -9],
      [10, -7],
      [13, -4],
      [13, 4],
      [10, 7],
      [6, 8],
      [0, 7],
      [-4, 5],
      [-9, 4],
    ],
  ],
  [
    "shadow",
    [
      [-8, -4],
      [-3, -5],
      [0, -6],
      [3, -8],
      [7, -8],
      [10, -6],
      [12, -3],
      [12, 4],
      [9, 6],
      [5, 7],
      [0, 6],
      [-4, 4],
      [-8, 3],
    ],
  ],
  [
    "base",
    [
      [-7, -4],
      [-1, -5],
      [3, -8],
      [6, -8],
      [8, -7],
      [10, -5],
      [11, -3],
      [11, 2],
      [8, 3],
      [4, 2],
      [2, 4],
      [-4, 4],
      [-8, 3],
    ],
  ],
  [
    "light",
    [
      [-5, -4],
      [0, -5],
      [3, -7],
      [6, -7],
      [9, -5],
      [9, -3],
      [5, -2],
      [2, -3],
      [-3, 0],
      [-6, 0],
    ],
  ],
  [
    "shadow",
    [
      [5, -5],
      [10, -4],
      [11, -3],
      [9, -3],
      [5, -4],
    ],
  ],
  [
    "outline",
    [
      [7, -2],
      [12, -1],
      [12, 0],
      [9, 0],
      [6, -1],
    ],
  ],
  [
    "outline",
    [
      [7, 1],
      [12, 2],
      [11, 3],
      [8, 3],
      [7, 2],
    ],
  ],
  [
    "outline",
    [
      [6, 4],
      [11, 4],
      [10, 5],
      [6, 5],
    ],
  ],
  [
    "base",
    [
      [-1, 3],
      [1, 0],
      [3, -1],
      [6, 0],
      [7, 2],
      [5, 4],
      [3, 5],
      [0, 5],
    ],
  ],
  [
    "light",
    [
      [0, 2],
      [2, 0],
      [4, 0],
      [5, 1],
      [3, 2],
      [2, 3],
      [0, 3],
    ],
  ],
];
const palm: Patch[] = [
  [
    "outline",
    [
      [-8, -4],
      [-3, -5],
      [0, -6],
      [3, -11],
      [6, -11],
      [8, -10],
      [8, -6],
      [11, -8],
      [14, -7],
      [14, 7],
      [11, 10],
      [6, 9],
      [3, 6],
      [-4, 5],
      [-8, 4],
    ],
  ],
  [
    "shadow",
    [
      [-7, -3],
      [-1, -4],
      [2, -6],
      [4, -10],
      [6, -10],
      [7, -8],
      [7, -4],
      [11, -7],
      [13, -6],
      [13, 7],
      [11, 9],
      [6, 8],
      [3, 5],
      [-4, 4],
      [-7, 3],
    ],
  ],
  [
    "base",
    [
      [-7, -3],
      [-1, -4],
      [3, -8],
      [5, -9],
      [6, -8],
      [5, -3],
      [7, -3],
      [10, -6],
      [12, -6],
      [13, -4],
      [13, 4],
      [10, 6],
      [6, 6],
      [3, 3],
      [-7, 3],
    ],
  ],
  [
    "light",
    [
      [-5, -3],
      [0, -4],
      [4, -6],
      [4, -3],
      [3, -1],
      [6, 0],
      [10, -4],
      [12, -4],
      [12, -2],
      [8, 1],
      [7, 3],
      [5, 3],
      [3, 1],
      [-4, 1],
    ],
  ],
  [
    "outline",
    [
      [9, -3],
      [13, -2],
      [13, -1],
      [9, -2],
    ],
  ],
  [
    "outline",
    [
      [9, 0],
      [13, 1],
      [13, 2],
      [9, 1],
    ],
  ],
  [
    "outline",
    [
      [9, 4],
      [13, 4],
      [13, 5],
      [9, 5],
    ],
  ],
  [
    "shadow",
    [
      [3, 0],
      [5, 1],
      [6, 3],
      [5, 4],
      [5, 2],
    ],
  ],
];

const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const bound = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = bound(x);
  return t * t * (3 - 2 * t);
};
type Profile = [u: number, upper: number, lower: number, shift: number][];
const legProfile: Profile = [
  [0, 1.08, 1.16, 0],
  [0.17, 1.17, 1.21, -0.6],
  [0.31, 1.02, 0.94, -1.6],
  [0.44, 0.84, 0.78, -3.1],
  [0.52, 0.91, 0.73, -3.6],
  [0.61, 0.87, 1.15, -1.8],
  [0.71, 0.77, 1.19, 0.25],
  [0.84, 0.64, 0.8, 0.65],
  [0.95, 0.55, 0.58, 0.2],
  [1, 0.68, 0.7, 0],
];
const armProfile: Profile = [
  [0, 0.93, 1.04, 0],
  [0.12, 1.17, 1.11, -0.25],
  [0.26, 1.05, 1.11, -0.4],
  [0.41, 0.89, 0.86, -0.8],
  [0.52, 0.78, 0.78, -1.35],
  [0.62, 0.94, 1.12, -0.35],
  [0.72, 0.86, 1.04, 0.45],
  [0.85, 0.7, 0.81, 0.3],
  [1, 0.73, 0.76, 0],
];

function profileAt(profile: Profile, t: number) {
  const i = profile.findIndex(([u]) => t <= u);
  const [end, up, down, shift] = profile[Math.max(0, i)];
  if (i <= 0) return { up, down, shift };
  const [start, a, b, c] = profile[i - 1];
  const p = smooth((t - start) / (end - start));
  return {
    up: lerp(a, up, p),
    down: lerp(b, down, p),
    shift: lerp(c, shift, p),
  };
}

export function paintElastic(
  c: CanvasRenderingContext2D,
  limb: ElasticGeometry,
  terminal?: Terminal,
  colors = config.colors,
  finish: ElasticFinish = {},
) {
  const last = limb.centers.length - 1;
  const root = limb.centers[0];
  const length = Math.hypot(limb.tip.x - root.x, limb.tip.y - root.y);
  const anatomical = smooth((length - 19) / 49);
  const profile = terminal?.foot ? legProfile : armProfile;
  // Sample extra stations around the joints without moving the simulated tip.
  const n = Math.min(60, Math.max(12, last * 2));
  const cuffEnd = Math.min(0.37, 19 / Math.max(1, length));
  const cuffStart = Math.max(0, cuffEnd - 5 / Math.max(1, length));
  const stations = Array.from({ length: n + 1 }, (_, i) => i / n);
  if (terminal?.foot && length > 25) stations.push(cuffStart, cuffEnd);
  stations.sort((a, b) => a - b);
  const sections = stations.map((t) => {
    const sample = t * last;
    const index = Math.min(last - 1, Math.floor(sample));
    const mix = sample - index;
    const first = limb.centers[index],
      second = limb.centers[index + 1];
    const before = limb.centers[Math.max(0, index - 1)];
    const after = limb.centers[Math.min(last, index + 2)];
    const dx = after.x - before.x,
      dy = after.y - before.y;
    const norm = Math.hypot(dx, dy) || 1,
      nx = -dy / norm,
      ny = dx / norm;
    const shape = profileAt(profile, t);
    const shift = terminal ? shape.shift * anatomical : 0;
    const radius = lerp(limb.radii[index], limb.radii[index + 1], mix);
    const seat = (finish.rootShift ?? 0) * (1 - t) ** 3;
    const overlap = terminal
      ? Math.max(0, 1 - t * 10) * (terminal.foot ? 3 : 4)
      : 0;
    return {
      t,
      nx,
      ny,
      x:
        lerp(first.x, second.x, mix) +
        nx * shift -
        (overlap * dx) / norm +
        seat,
      y: lerp(first.y, second.y, mix) + ny * shift - (overlap * dy) / norm,
      up: radius * (terminal ? lerp(1, shape.up, anatomical) : 1),
      down: radius * (terminal ? lerp(1, shape.down, anatomical) : 1),
    };
  });

  function band(
    color: string,
    top: number,
    bottom: number,
    inset: number,
    from = 0,
    to = 1,
  ) {
    const selected = sections.filter(({ t }) => t >= from && t <= to);
    if (selected.length < 2) return;
    const edge = (side: number) =>
      selected.map(({ x, y, nx, ny, up, down }) => {
        const offset = Math.max(0, (side < 0 ? up : down) - inset) * side;
        return {
          x: Math.round(x + nx * offset),
          y: Math.round(y + ny * offset),
        };
      });
    fillPixels(c, [...edge(top), ...edge(bottom).reverse()], color);
  }

  band(colors.outline, -1, 1, 0);
  band(colors.shadow, -1, 1, 1);
  band(colors.base, -1, 0.59, 1);
  if (length < 30) band(colors.light, -0.85, -0.14, 1);
  else {
    // Separate the lit planes at the knee/elbow instead of running one
    // uninterrupted specular stripe from the garment to the hand or foot.
    band(colors.light, -0.82, -0.02, 1, 0, 0.44);
    band(colors.light, -0.91, -0.22, 1, 0.51, 0.85);
    band(colors.highlight, -0.69, -0.42, 1, 0.12, 0.31);
    band(colors.highlight, -0.74, -0.53, 1, 0.57, 0.68);
    band(colors.shadow, 0.22, 0.72, 1, 0.43, 0.54);
    band(colors.base, -0.71, 0.24, 1, 0.84, 1);
  }
  if (!terminal) return;

  if (terminal.foot && length > 25) {
    band(denim.deep, -1, 1, 0, 0, cuffEnd);
    band(denim.base, -0.92, 0.63, 1, 0, cuffStart);
    band(denim.light, -0.78, -0.16, 1, 0, cuffStart);
    band(denim.cuff, -1, 1, 1, cuffStart, cuffEnd);
    band(denim.white, -1, 0.39, 2, cuffStart, cuffEnd);
  }

  const ink = {
    ...colors,
    sole: "#956141",
    soleLight: "#d6ab6c",
    leather: "#39282b",
  };
  const compression = 1 - (finish.recoil ?? 0) * 0.16;
  for (const [color, points] of terminal.foot
    ? sandal
    : terminal.palm
      ? palm
      : fist) {
    fillPixels(
      c,
      points.map(([x, y]) => {
        if (terminal.footPose)
          return luffyFootPoint(
            limb.tip,
            terminal.axis,
            terminal.footPose,
            x,
            y,
          );
        const forward = (x - 1) * compression + 1;
        const across = y * (2 - compression);
        return {
          x: Math.round(
            limb.tip.x + terminal.axis.x * forward - terminal.axis.y * across,
          ),
          y: Math.round(
            limb.tip.y + terminal.axis.y * forward + terminal.axis.x * across,
          ),
        };
      }),
      ink[color],
    );
  }
}
