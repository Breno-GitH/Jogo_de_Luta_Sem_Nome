import { equinoxCut } from "./asta-equinox-geometry";
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
    cut = equinoxCut(s),
    split = u(t, b.release, b.impact + 20),
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
        passed = Math.max(0, (cut.ceilingX - cx) * s.facing),
        drift = split * Math.min(1, passed / 110) * side * (70 + layer * 25);
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

  if (cut.active && cut.growth >= 0.999) {
    const a = cut.origin[0],
      z = cut.ceilingX;
    c.globalAlpha = cut.residue * 0.7;
    shape(
      c,
      [
        [a, 100],
        [z, 88],
        [z - s.facing * 24, 125],
        [a + s.facing * 16, 112],
      ],
      "#050710",
    );
    shape(
      c,
      [
        [a, 96],
        [z, 84],
        [z, 88],
        [a, 100],
      ],
      "#9a8b9b55",
    );
    shape(
      c,
      [
        [a, 112],
        [z - s.facing * 24, 125],
        [z - s.facing * 30, 130],
        [a, 116],
      ],
      "#74687d55",
    );
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
/** Straight, colossal cleaving plane released by the sword.
 * The ground trench and separated sky advance with the same cutting front. */
export function drawRemoteEquinox(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const cut = equinoxCut(s);
  if (!cut.active) return;
  const { front, back, facing: f } = cut,
    t = s.tick,
    age = t - b.release,
    impact = t - b.impact;
  c.save();
  // Perspective fissure left by the lower tip, from Asta's release to the moving edge.
  const groundEnd = cut.floorX,
    start = cut.origin[0],
    distance = Math.max(0, (groundEnd - start) * f);
  c.globalAlpha = cut.residue;
  if (distance > 2 && cut.bottom >= 577) {
    shape(
      c,
      [
        [start, 579],
        [groundEnd, 577],
        [groundEnd - f * 26, 604],
        [start + f * 12, 583],
      ],
      "#080a12",
    );
    shape(
      c,
      [
        [start, 577],
        [groundEnd, 575],
        [groundEnd - f * 8, 579],
        [start, 581],
      ],
      "#79727b88",
    );
    for (let i = 0; i < 18; i++) {
      const dx = 17 + i * 28 + ((i * i * 7) % 19);
      if (dx > distance) break;
      const localX = start + dx * f,
        localAge = Math.max(
          0,
          age -
            (dx / Math.max(1, Math.abs(cut.target - start))) *
              (b.impact - b.release),
        );
      const flight = Math.min(36, localAge),
        rise = Math.max(
          0,
          (3.2 + ((i * 13) % 17) * 0.1) * flight - 0.14 * flight * flight,
        ),
        x = localX + f * flight * (0.15 + (i % 3) * 0.25),
        size = 5 + ((i * 7) % 9);
      if (localAge > 36) continue;
      shape(
        c,
        [
          [x, 579 - rise],
          [x + f * size * 0.4, 572 - rise - (i % 3) * 2],
          [x + f * size, 574 - rise],
          [x + f * size * 0.7, 581 - rise],
        ],
        i % 3 ? "#31313b" : "#867b83",
      );
    }
    // Low torn pressure sheets peel away from the moving incision, not a radial blast.
    c.globalAlpha = cut.fade * 0.65;
    for (let i = 0; i < 3; i++) {
      const reach = 36 + i * 22,
        x = groundEnd - f * (10 + i * 10);
      shape(
        c,
        [
          [x - f * reach, 581],
          [x + f * 15, 574],
          [x + f * (reach * 0.7), 545 - i * 9],
          [x + f * (reach * 0.4), 571],
          [x + f * reach, 578],
          [x - f * reach * 0.4, 585],
        ],
        i === 0 ? "#c9c1ce" : "#77718199",
      );
    }
  }
  // A cleft in the sky follows the TOP of the traveling blade, never a fixed vertical line.
  if (cut.growth >= 0.999) {
    c.globalAlpha = cut.residue * 0.6;
    const skyEnd = cut.ceilingX;
    shape(
      c,
      [
        [start, 102],
        [skyEnd, 94],
        [skyEnd - f * 10, 106],
        [start, 108],
      ],
      "#070811",
    );
    shape(
      c,
      [
        [start, 102],
        [skyEnd, 92],
        [skyEnd, 95],
        [start, 104],
      ],
      "#77707d55",
    );
  }
  if (cut.fade > 0) {
    c.globalAlpha = cut.fade;
    const rim = front.map(([x, y]) => [x + f * 3, y] as Point);
    shape(c, [...rim, ...[...back].reverse()], "#462b46aa");
    shape(c, [...front, ...[...back].reverse()], "#060711");
    const flank = back.map(
      ([x, y], i) =>
        [x - f * (7 + Math.sin((i / 32) * Math.PI) * 15), y] as Point,
    );
    c.globalAlpha = cut.fade * 0.32;
    shape(c, [...back, ...[...flank].reverse()], "#6d506e");
    c.globalAlpha = cut.fade;
    // Unequal swept tails form the torn trailing silhouette of a giant MUGEN slash.
    // They peel in different frames, while the dense front remains continuous.
    for (let i = 0; i < 3; i++) {
      const index = [10, 19, 28][i],
        [x, y] = back[index],
        phase = Math.floor(age / 3) + i * 3,
        available = Math.max(0, (x - cut.origin[0]) * f - 12),
        width = Math.min(available, [120, 185, 94][i] * u(age, 1, 9)),
        bend = Math.sin(phase * 0.62) * (7 + i * 3),
        peel = Math.max(0.15, 1 - u(impact, 8 + i * 4, 32 + i * 4));
      c.globalAlpha = cut.fade * peel;
      shape(
        c,
        [
          [x + f * 12, y - 32],
          [x - f * width * 0.4, y - 21 + bend],
          [x - f * width, y - 66 + bend],
          [x - f * width * 0.68, y - 9 + bend],
          [x - f * width * 0.9, y + 22 + bend],
          [x - f * width * 0.25, y + 10],
          [x + f * 14, y + 26],
        ],
        i % 2 ? "#090910" : "#100c19",
      );
    }
    c.globalAlpha = cut.fade;
    // A narrow continuous leading edge makes the surface read as a blade.
    shape(c, [...rim, ...[...front].reverse()], "#a65b79bb");
    const highlight = front.slice(8, 25),
      edge = highlight.map(([x, y]) => [x + f * 1.5, y] as Point);
    shape(c, [...edge, ...[...highlight].reverse()], "#b9a6b566");
    // Trailing strokes peel from the dark mass and carry its direction of travel.
    for (let i = 4; i < 30; i += 5) {
      const [x, y] = back[i],
        length = 18 + (i % 4) * 10;
      shape(
        c,
        [
          [x, y],
          [x - f * length, y + 8],
          [x - f * (length * 0.6), y + 3],
        ],
        "#1b1026aa",
      );
    }
  }
  if (impact >= 0 && impact < 24) {
    const birth = astaUnionScene({ ...s, tick: b.impact }).victim;
    const x = birth.x,
      y = birth.y - 75,
      p = impact / 24;
    c.globalAlpha = (1 - p) * 0.75;
    // Thin slanted shear sheets at the contact, with no enclosing shield outline.
    for (let i = 0; i < 4; i++) {
      const span = 35 + p * (130 + i * 19),
        dy = (i - 1.5) * 16;
      shape(
        c,
        [
          [x - f * span * 0.5, y - span * 0.6 + dy],
          [x + f * span, y + span * 0.35 + dy],
          [x + f * span * 0.8, y + span * 0.32 + dy],
        ],
        i % 2 ? "#8f8292" : "#17101f",
      );
    }
  }
  c.restore();
}
