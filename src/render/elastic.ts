import config from "../data/luffy-elastic.json";
import type { ElasticGeometry } from "../engine/elastic";
import type { Point } from "../engine/types";

/** Scan-convert closed contours at native resolution, with no AA or stretching. */
function fill(c: CanvasRenderingContext2D, contour: Point[], color: string) {
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

export function paintElastic(
  c: CanvasRenderingContext2D,
  limb: ElasticGeometry,
  terminal?: { foot: boolean; axis: Point; palm?: boolean },
) {
  const last = limb.centers.length - 1;
  const sections = limb.centers.map((center, i) => {
    const before = limb.centers[Math.max(0, i - 1)];
    const after = limb.centers[Math.min(last, i + 1)];
    const dx = after.x - before.x,
      dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    return { center, nx: -dy / length, ny: dx / length, radius: limb.radii[i] };
  });

  function band(
    color: string,
    top: number,
    bottom: number,
    inset: number,
    from = 0,
    to = last,
  ) {
    const edge = (side: number) =>
      sections.slice(from, to + 1).map(({ center, nx, ny, radius }) => {
        const offset = Math.max(0, radius - inset) * side;
        return {
          x: Math.round(center.x + nx * offset),
          y: Math.round(center.y + ny * offset),
        };
      });
    fill(c, [...edge(top), ...edge(bottom).reverse()], color);
  }

  band(config.colors.outline, -1, 1, 0);
  band(config.colors.shadow, -1, 1, 1);
  band(config.colors.base, -1, 0.54, 1);
  band(config.colors.light, -0.86, -0.05, 1);
  if (last > 5) {
    band(config.colors.highlight, -0.65, -0.42, 1, 1, Math.floor(last * 0.45));
    band(
      config.colors.highlight,
      -0.65,
      -0.42,
      1,
      Math.ceil(last * 0.58),
      last - 1,
    );
  }

  if (!terminal) return;
  const { foot, axis } = terminal;
  const stamp = (pixels: number[][], color: string) =>
    fill(
      c,
      pixels.map(([x, y]) => ({
        x: Math.round(limb.tip.x + axis.x * x - axis.y * y),
        y: Math.round(limb.tip.y + axis.y * x + axis.x * y),
      })),
      color,
    );
  const colors = config.colors;
  if (foot) {
    stamp(
      [
        [-6, -7],
        [1, -7],
        [5, -5],
        [12, -4],
        [14, -1],
        [14, 3],
        [11, 6],
        [-4, 6],
        [-7, 3],
      ],
      colors.outline,
    );
    stamp(
      [
        [-5, -5],
        [0, -6],
        [5, -4],
        [11, -3],
        [13, -1],
        [12, 2],
        [7, 3],
        [-5, 2],
      ],
      colors.base,
    );
    stamp(
      [
        [-4, -5],
        [0, -5],
        [4, -3],
        [10, -3],
        [11, -1],
        [5, 0],
        [-4, -1],
      ],
      colors.light,
    );
    stamp(
      [
        [-5, 3],
        [13, 3],
        [11, 5],
        [-4, 5],
      ],
      "#b88446",
    );
    stamp(
      [
        [-2, 3],
        [12, 3],
        [11, 4],
        [-2, 4],
      ],
      "#e7bb69",
    );
    stamp(
      [
        [0, -6],
        [2, -5],
        [7, 3],
        [4, 3],
      ],
      colors.outline,
    );
    stamp(
      [
        [5, -4],
        [6, -4],
        [10, -1],
        [9, 0],
      ],
      colors.shadow,
    );
    stamp(
      [
        [11, -3],
        [12, -2],
        [12, 0],
        [11, 0],
      ],
      colors.shadow,
    );
  } else if (terminal.palm) {
    stamp(
      [
        [-7, -5],
        [0, -6],
        [5, -8],
        [9, -7],
        [13, -4],
        [13, 5],
        [8, 8],
        [1, 6],
        [-7, 5],
      ],
      colors.outline,
    );
    stamp(
      [
        [-6, -4],
        [1, -5],
        [6, -7],
        [10, -5],
        [12, -3],
        [12, 4],
        [7, 6],
        [0, 5],
        [-6, 4],
      ],
      colors.base,
    );
    stamp(
      [
        [-3, -4],
        [4, -5],
        [7, -6],
        [10, -4],
        [7, -1],
        [0, 0],
      ],
      colors.light,
    );
    stamp(
      [
        [3, 2],
        [11, 1],
        [11, 4],
        [6, 6],
        [2, 4],
      ],
      colors.shadow,
    );
    stamp(
      [
        [8, -4],
        [12, -3],
        [12, -2],
        [8, -3],
      ],
      colors.outline,
    );
    stamp(
      [
        [9, 0],
        [12, -1],
        [12, 0],
        [9, 1],
      ],
      colors.outline,
    );
    stamp(
      [
        [8, 3],
        [12, 2],
        [12, 3],
        [8, 4],
      ],
      colors.outline,
    );
  } else {
    stamp(
      [
        [-7, -5],
        [-2, -6],
        [2, -8],
        [6, -7],
        [9, -5],
        [12, -2],
        [12, 4],
        [9, 7],
        [3, 8],
        [-2, 5],
        [-7, 5],
      ],
      colors.outline,
    );
    stamp(
      [
        [-6, -4],
        [-2, -4],
        [3, -7],
        [6, -6],
        [10, -3],
        [11, 3],
        [8, 6],
        [3, 7],
        [-2, 4],
        [-6, 4],
      ],
      colors.base,
    );
    stamp(
      [
        [-4, -3],
        [0, -4],
        [3, -6],
        [6, -5],
        [9, -3],
        [9, -1],
        [3, 0],
        [-3, 1],
      ],
      colors.light,
    );
    stamp(
      [
        [3, 0],
        [9, 1],
        [10, 4],
        [7, 6],
        [3, 6],
        [1, 4],
      ],
      colors.shadow,
    );
    stamp(
      [
        [3, -3],
        [10, -2],
        [10, -1],
        [4, -1],
      ],
      colors.shadow,
    );
    stamp(
      [
        [6, 2],
        [11, 2],
        [11, 3],
        [7, 3],
      ],
      colors.outline,
    );
    stamp(
      [
        [6, 4],
        [10, 4],
        [10, 5],
        [6, 5],
      ],
      colors.outline,
    );
    stamp(
      [
        [0, 0],
        [3, 0],
        [5, 2],
        [4, 4],
        [1, 3],
        [-1, 2],
      ],
      colors.light,
    );
  }
}
