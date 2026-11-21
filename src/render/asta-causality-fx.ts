import type { Fighter } from "../engine/combat";
import { causalityRibbons } from "../engine/asta-antimagic";

/** Solid, tapered anti-magic ribbons: no electric zigzags, blur or sprite FX.
 * Samples and interception capsules share their centreline; the rim stays inside
 * the seven-pixel collision radius. All variation derives from simulation ticks. */
export function drawCausalityRibbons(c: CanvasRenderingContext2D, f: Fighter) {
  const paths = causalityRibbons(f);
  const t = f.stateFrame;
  for (let n = 0; n < paths.length; n++) {
    const path = paths[n];
    for (let i = 0; i < path.length; i++) {
      const p = path[i],
        previous = path[Math.max(0, i - 1)],
        next = path[Math.min(path.length - 1, i + 1)];
      const distance = Math.max(
        1,
        Math.hypot(next.x - previous.x, next.y - previous.y),
      );
      const nx = -(next.y - previous.y) / distance,
        ny = (next.x - previous.x) / distance;
      const u = i / (path.length - 1);
      const radius = Math.max(
        0.45,
        (5.8 + Math.sin(u * Math.PI) * 0.8) * Math.pow(1 - u, 0.65),
      );
      // Rasterized cross-sections overlap into a continuous, irregular volume.
      const end = i ? p : next;
      const start = i ? previous : p;
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(end.x - start.x, end.y - start.y)),
      );
      for (let j = 0; j <= steps; j++) {
        const q = j / steps,
          x = start.x + (end.x - start.x) * q,
          y = start.y + (end.y - start.y) * q;
        pixel(c, x, y, radius * 2 + 1, "#38222f");
        pixel(c, x, y, Math.max(1, radius * 2 - 1), "#0d0d15");
        // A broken, one-sided purple/maroon edge, rather than a luminous red tube.
        if ((i + n + Math.floor(t / 3)) % 4 !== 0)
          pixel(
            c,
            x + nx * radius * 0.55,
            y + ny * radius * 0.55,
            Math.max(1, radius * 0.65),
            "#302433",
          );
      }
    }
    // The tip sheds a few small flecks as the stream retracts into Destroyer.
    const tip = path[path.length - 1];
    for (let i = 0; i < 3; i++) {
      const pulse = (t * 2 + n * 7 + i * 11) % 15;
      pixel(
        c,
        tip.x - 6 + pulse,
        tip.y - 7 + ((i * 5 + t) % 13),
        1 + (i % 2),
        i ? "#181420" : "#583044",
      );
    }
  }
}
function pixel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const width = Math.max(1, Math.round(size));
  c.fillStyle = color;
  c.fillRect(
    Math.round(x - width / 2),
    Math.round(y - width / 2),
    width,
    width,
  );
}
