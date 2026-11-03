import config from "../data/luffy-elastic.json";
import type { ElasticGeometry } from "../engine/elastic";

/** Rasterise contours at native resolution. Integer filled quadrilaterals,
 * no Canvas stroked curves, raster scaling or smoothing of an arm image. */
export function paintElastic(
  g: CanvasRenderingContext2D,
  limb: ElasticGeometry,
) {
  const polygon = (points: { x: number; y: number }[], color: string) => {
    // Canvas path fills can antialias diagonals; integer scan conversion below
    // guarantees binary coverage at native resolution, like Pillow polygons.
    const minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    g.fillStyle = color;
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if (a.y === b.y) {
          if (y === a.y) xs.push(a.x, b.x);
        } else if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y))
          xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      if (xs.length) {
        const left = Math.ceil(Math.min(...xs)),
          right = Math.floor(Math.max(...xs));
        if (right >= left) g.fillRect(left, y, right - left + 1, 1);
      }
    }
  };
  const band = (shrink: number, shift: number, color: string) => {
    for (let i = 0; i < limb.centers.length - 1; i++) {
      const a = limb.centers[i],
        b = limb.centers[i + 1],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1,
        nx = -dy / length,
        ny = dx / length;
      const ra = Math.max(0, limb.radii[i] - shrink),
        rb = Math.max(0, limb.radii[i + 1] - shrink);
      polygon(
        [
          {
            x: Math.round(a.x + nx * ra),
            y: Math.round(a.y + ny * ra + shift),
          },
          {
            x: Math.round(b.x + nx * rb),
            y: Math.round(b.y + ny * rb + shift),
          },
          {
            x: Math.round(b.x - nx * rb),
            y: Math.round(b.y - ny * rb + shift),
          },
          {
            x: Math.round(a.x - nx * ra),
            y: Math.round(a.y - ny * ra + shift),
          },
        ],
        color,
      );
    }
  };
  band(0, 0, config.colors.outline);
  band(1, 0, config.colors.shadow);
  band(2, -1, config.colors.light);
  band(3, -1, config.colors.highlight);
}
