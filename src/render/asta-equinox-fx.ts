import { astaUnionScene, type AstaUnionState } from "../engine/asta-super";
import { unionBeats as b } from "../engine/asta-super-acts";
type Point = readonly [number, number];
const u = (t: number, a: number, z: number) =>
  Math.max(0, Math.min(1, (t - a) / (z - a)));
function shape(c: CanvasRenderingContext2D, p: Point[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  p.forEach(([x, y], i) =>
    i
      ? c.lineTo(Math.round(x / 2) * 2, Math.round(y / 2) * 2)
      : c.moveTo(Math.round(x / 2) * 2, Math.round(y / 2) * 2),
  );
  c.closePath();
  c.fill();
}
/** Temporary world-space parallax: the original arena remains underneath and returns intact.
 * No stored scene geometry or collision is changed by the split clouds. */
export function drawUnionSky(c: CanvasRenderingContext2D, s: AstaUnionState) {
  const t = s.tick,
    p = u(t, b.aerial, b.retreat) * (1 - u(t, b.outro, b.end));
  if (!p) return;
  const scene = astaUnionScene(s),
    split = u(t, b.release, b.outro),
    axis = scene.plane.x;
  c.save();
  c.globalAlpha = p * 0.74;
  c.fillStyle = "#141624";
  c.fillRect(-400, -500, 2080, 1080);
  for (let layer = 0; layer < 3; layer++) {
    const y = -110 + layer * 155,
      shift = (scene.camera.x - 640) * (0.15 + layer * 0.1);
    for (let i = -1; i < 7; i++) {
      const cx = i * 240 + shift + (layer % 2 ? 70 : 0),
        side = cx < axis ? -1 : 1,
        drift = split * side * (70 + layer * 25);
      shape(
        c,
        [
          [cx + drift, y + 38],
          [cx + 40 + drift, y + 18],
          [cx + 80 + drift, y + 18],
          [cx + 110 + drift, y],
          [cx + 170 + drift, y + 8],
          [cx + 208 + drift, y + 30],
          [cx + 270 + drift, y + 42],
          [cx + 275 + drift, y + 68],
          [cx + drift, y + 68],
        ],
        ["#292b3e", "#333449", "#3c3b4b"][layer],
      );
    }
  }
  // Long torn anti-magic currents live behind the actors, in a separate parallax layer.
  c.globalAlpha = p * 0.46;
  for (let i = 0; i < 4; i++) {
    const flow = (t * (0.7 + i * 0.12)) % 160,
      y = -180 + i * 134;
    const top: Point[] = Array.from(
      { length: 16 },
      (_, n) =>
        [
          -220 + n * 120 + flow,
          y + Math.sin(n * 0.6 + i + t * 0.018) * 30,
        ] as Point,
    );
    const bottom = top
      .map(([x, y], n) => [x, y + 8 + (n % 4) * 3] as Point)
      .reverse();
    shape(c, [...top, ...bottom], i % 2 ? "#0a0a12" : "#1a1120");
  }
  // Five separate leaves evoke the grimoire; no borrowed cinematic backdrop.
  c.globalAlpha = p * 0.12;
  c.translate(scene.attacker.x + 40 * s.facing, 200);
  for (let i = 0; i < 5; i++) {
    c.save();
    c.rotate((i * Math.PI * 2) / 5);
    shape(
      c,
      [
        [0, -18],
        [-24, -50],
        [-30, -83],
        [-8, -104],
        [14, -94],
        [24, -65],
        [8, -26],
      ],
      "#8d697b",
    );
    c.restore();
  }
  c.restore();
}
/** Asta's ordinary 80px katana releases this SEPARATE distant cutting plane.
 * At release it incises sky-to-ground; eleven ticks later the principal impact opens it.
 * All procedural points depend only on the cinematic clock, never on combat randomness. */
export function drawRemoteEquinox(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const { plane } = astaUnionScene(s),
    t = s.tick;
  if (!plane.released || t > b.outro + 28) return;
  const age = t - b.release,
    impact = t - b.impact,
    fade = 1 - u(t, b.outro, b.outro + 28);
  const top = plane.top,
    bottom = plane.bottom,
    x = plane.x,
    progress = u(age, 0, 5);
  const end = top + (bottom - top) * progress;
  const open = impact < 0 ? 0 : Math.sin(Math.PI * u(impact, 0, 60));
  const width = impact < 0 ? 2 : 14 + open * 23;
  c.save();
  c.globalAlpha = fade;
  const edge: Point[] = Array.from({ length: 24 }, (_, i) => {
    const y = top + ((end - top) * i) / 23,
      notch = (((i * 37 + Math.floor(age / 3) * 11) % 17) - 8) * 0.6;
    return [x + notch + ((i % 3) - 1) * open * 5, y];
  });
  const band = (w: number, color: string) =>
    shape(
      c,
      [
        ...edge.map(([px, py]) => [px - w, py] as Point),
        ...edge.map(([px, py]) => [px + w, py] as Point).reverse(),
      ],
      color,
    );
  band(width + 6, "#6e244baa");
  band(width + 2, "#b94a6bcc");
  band(width, "#05060c");
  if (impact >= 0) {
    // Directional pressure sheets, not an opaque circular explosion.
    for (let k = 0; k < 3; k++) {
      const p = u(impact, k * 4, 35 + k * 4);
      if (!p || p >= 1) continue;
      c.globalAlpha = fade * (1 - p) * 0.65;
      for (const side of [-1, 1]) {
        const reach = 60 + p * 300,
          offset = side * reach;
        shape(
          c,
          [
            [x + side * width, top + 60],
            [x + offset, top + 135],
            [x + offset * 0.8, bottom - 85],
            [x + side * width, bottom],
            [x + offset * 0.76, bottom - 85],
            [x + offset - side * 4, top + 138],
          ],
          k % 2 ? "#777080" : "#a295a0",
        );
      }
    }
    c.globalAlpha = fade * (1 - u(impact, 16, 68));
    for (let i = 0; i < 30; i++) {
      const direction = i % 2 ? 1 : -1,
        px = x + direction * (12 + impact * (1.2 + (i % 5))),
        py = top + 25 + ((i * 47) % 440);
      shape(
        c,
        [
          [px, py],
          [px + direction * (5 + (i % 12)), py - 8],
          [px + direction * 4, py + 9],
        ],
        i % 4 ? "#10101b" : "#84516a",
      );
    }
    const spread = 20 + u(impact, 0, 38) * 230;
    c.globalAlpha = fade * (1 - u(impact, 18, 70)) * 0.8;
    for (const side of [-1, 1])
      shape(
        c,
        [
          [x, bottom - 2],
          [x + side * spread, bottom - 10],
          [x + side * (spread - 15), bottom + 2],
        ],
        "#1c1625",
      );
  }
  c.restore();
}
