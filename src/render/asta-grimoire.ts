import type { Fighter } from "../engine/combat";
import type { Grip } from "../engine/asta-normals";

export const grimoireOrigin = { x: -46, y: -78 } as const;
export function astaDrawPhase(f: Fighter) {
  const d = f.asta?.draw;
  if (!d) return "";
  return d.tick < d.commitAt
    ? "return"
    : d.tick < d.handAt
      ? "emerge"
      : "close";
}
export function grimoireWeaponPose(f: Fighter, grip: Grip) {
  const d = f.asta?.draw;
  if (!d) return { ...grip, scale: 1 };
  const portal = grimoireOrigin;
  if (d.tick < d.commitAt) {
    const p = Math.min(1, d.tick / Math.max(1, d.commitAt));
    return {
      x: grip.x + (portal.x - grip.x) * p,
      y: grip.y + (portal.y - grip.y) * p,
      angle: grip.angle + (-90 - grip.angle) * p,
      scale: Math.max(0.12, 1 - p * 0.85),
    };
  }
  const p = Math.max(
    0,
    Math.min(1, (d.tick - d.commitAt) / Math.max(1, d.handAt - d.commitAt)),
  );
  return {
    x: portal.x + (grip.x - portal.x) * p,
    y: portal.y + (grip.y - portal.y) * p,
    angle: -90 + (grip.angle + 90) * p,
    scale: 0.18 + p * 0.82,
  };
}

let surface: HTMLCanvasElement | undefined;
/** Code-drawn at native pixel resolution. No external book/portal textures.
 * The cover follows the weathered near-black five-leaf design shown by the
 * anime's official book-cover merchandise and Studio Pierrot's grimoire prop.
 * Essential sword exchange remains visible with optional cosmetic FX disabled. */
export function drawAstaGrimoire(c: CanvasRenderingContext2D, f: Fighter) {
  const d = f.asta?.draw;
  if (!d) return;
  if (!surface) {
    surface = document.createElement("canvas");
    surface.width = surface.height = 64;
  }
  const b = surface.getContext("2d")!;
  b.clearRect(0, 0, 64, 64);
  b.save();
  b.translate(32, 32);
  const open = Math.max(
    0,
    Math.min(1, (d.tick + 0.4) / 3, (d.total - d.tick + 0.5) / 4),
  );
  const spread = Math.round(5 + open * 13);
  // Tilted, substantial binding, asymmetric page blocks and chipped corners.
  polygon(
    b,
    [
      [-spread - 3, -15],
      [-3, -20],
      [spread + 3, -15],
      [spread + 2, 20],
      [-3, 23],
      [-spread - 4, 18],
    ],
    "#100f13",
  );
  polygon(
    b,
    [
      [-spread - 2, -14],
      [-3, -18],
      [spread + 1, -14],
      [spread, 18],
      [-3, 21],
      [-spread - 3, 17],
    ],
    "#302c29",
  );
  polygon(
    b,
    [
      [-spread, -13],
      [-3, -17],
      [spread - 1, -13],
      [spread - 1, 16],
      [-3, 19],
      [-spread - 1, 15],
    ],
    "#665b46",
  );
  if (open < 0.55) {
    // The front board turns toward the viewer before and after the exchange.
    polygon(
      b,
      [
        [-11, -18],
        [10, -15],
        [9, 19],
        [-12, 16],
      ],
      "#181a18",
    );
    polygon(
      b,
      [
        [-9, -16],
        [8, -13],
        [7, 17],
        [-10, 14],
      ],
      "#292823",
    );
    for (let y = -15; y < 17; y += 2)
      for (let x = -9; x < 8; x += 2) {
        const wear = (x * x * 3 + y * y * 7 + x * y * 11 + 317) % 29;
        if (wear < 8) {
          b.fillStyle = wear < 3 ? "#4b4032" : "#383329";
          b.fillRect(x, y, 2, 2);
        }
      }
    clover(b, -1, 0);
    b.fillStyle = "#857b5d";
    b.fillRect(10, -12, 2, 29);
    b.fillStyle = "#27211c";
    b.fillRect(-13, -16, 2, 31);
  } else {
    const left = -spread + 1,
      right = spread - 1;
    polygon(
      b,
      [
        [left, -12],
        [-3, -16],
        [-3, 17],
        [left - 1, 14],
      ],
      "#a79b78",
    );
    polygon(
      b,
      [
        [1, -16],
        [right, -12],
        [right, 14],
        [1, 17],
      ],
      "#c1b38c",
    );
    polygon(
      b,
      [
        [left + 1, -11],
        [-5, -14],
        [-5, 15],
        [left, 13],
      ],
      "#bdb08a",
    );
    b.fillStyle = "#6a5c48";
    b.fillRect(-3, -17, 3, 36);
    b.fillStyle = "#24201d";
    b.fillRect(-1, -16, 2, 34);
    // Broken, individually spaced glyph strokes, not ordinary straight text lines.
    for (let page = 0; page < 2; page++)
      for (let row = 0; row < 6; row++)
        for (let k = 0; k < 4; k++) {
          const x = (page ? 3 : left + 2) + k * 3,
            y = -10 + row * 4 + (page ? 1 : 0);
          if (x > right - 2 || (!page && x > -6)) continue;
          b.fillStyle = (row + k) % 3 ? "#71664f" : "#827458";
          b.fillRect(x, y, 1 + ((row + k) % 2), 1);
          if ((row + k) % 2) b.fillRect(x + 1, y + 1, 1, 1);
        }
    // A turning sheet has its own width, slope and timing.
    const turn = (d.tick % 6) / 5,
      edge = Math.round((1 - turn * 2) * (spread - 3));
    polygon(
      b,
      [
        [0, -16],
        [edge, -12 - Math.round(Math.sin(turn * Math.PI) * 3)],
        [edge, 14],
        [0, 17],
      ],
      turn < 0.5 ? "#d2c49c" : "#a09372",
    );
    b.fillStyle = "#76694e";
    b.fillRect(edge, -10, 1, 22);
    // Small dark seam receives one weapon; no giant circular magic portal.
    b.fillStyle = "#13121b";
    b.fillRect(-2, -7, 4, 17);
    for (let i = 0; i < 4; i++) {
      b.fillStyle = i % 2 ? "#3e2837" : "#17141e";
      b.fillRect(-4 + ((i * 3 + d.tick) % 8), -6 + i * 4, 2, 2);
    }
  }
  b.fillStyle = "#514331";
  b.fillRect(-spread - 3, 14, 3, 3);
  b.fillRect(spread - 1, -15, 3, 2);
  b.restore();
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(
    surface,
    Math.round(grimoireOrigin.x - 32),
    Math.round(grimoireOrigin.y - 32),
  );
  c.restore();
}

/** Five individually shaped lobes and short stem, kept dark on the worn cover. */
function clover(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = "#0e1110";
  for (const [dx, dy] of [
    [-3, -3],
    [2, -3],
    [-4, 1],
    [3, 1],
    [0, 4],
  ]) {
    c.fillRect(x + dx - 1, y + dy - 1, 3, 3);
    c.fillRect(x + dx, y + dy - 2, 1, 1);
  }
  c.fillRect(x - 1, y - 1, 3, 6);
  c.fillRect(x, y + 6, 1, 3);
}
/** Scanline polygon fill avoids antialiased subpixel edges on the book. */
function polygon(
  c: CanvasRenderingContext2D,
  points: number[][],
  color: string,
) {
  c.fillStyle = color;
  const min = Math.ceil(Math.min(...points.map((p) => p[1]))),
    max = Math.floor(Math.max(...points.map((p) => p[1])));
  for (let y = min; y <= max; y++) {
    const edges: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        edges.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    edges.sort((a, b) => a - b);
    for (let i = 0; i + 1 < edges.length; i += 2)
      c.fillRect(
        Math.ceil(edges[i]),
        y,
        Math.floor(edges[i + 1]) - Math.ceil(edges[i]) + 1,
        1,
      );
  }
}
