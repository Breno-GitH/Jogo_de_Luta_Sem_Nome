import type { Fighter, Match } from "../engine/combat";
import {
  astaSpecialGrip,
  astaReach,
  isAstaSpecial,
} from "../engine/asta-specials";
import { swordReach } from "../engine/asta-normals";
import { visibleAstaSword } from "../engine/asta-stances";
/** Quantized strokes: no bitmaps, gradients, blur or simulation mutations. */
function stroke(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  tx: number,
  ty: number,
  size: number,
  color: string,
) {
  c.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.hypot(tx - x, ty - y) / 2));
  for (let i = 0; i <= n; i++)
    c.fillRect(
      Math.round((x + ((tx - x) * i) / n) / 2) * 2,
      Math.round((y + ((ty - y) * i) / n) / 2) * 2,
      size,
      size,
    );
}
export function astaWeaponHidden(f: Fighter) {
  return (
    f.state === "attack" &&
    f.moveId === "astaDualBreak" &&
    f.stateFrame >= 24 &&
    f.stateFrame < 26
  );
}
/** Readable gameplay geometry remains visible when optional effects are disabled. Local fighter space. */
export function drawAstaBladeExtension(
  c: CanvasRenderingContext2D,
  f: Fighter,
) {
  if (
    f.state !== "attack" ||
    !isAstaSpecial(f.moveId) ||
    !["astaBlackDivider", "astaSeveringLine"].includes(f.moveId)
  )
    return;
  const t = f.stateFrame,
    m = f.move!,
    g = astaSpecialGrip(f.moveId, t);
  if (t < 6 || t >= m.startup + m.active + 5) return;
  const a = (g.angle * Math.PI) / 180,
    native = swordReach[visibleAstaSword(f)];
  const gain =
    t < m.startup
      ? Math.min(1, (t - 6) / Math.max(1, m.startup - 6))
      : Math.min(1, (m.startup + m.active + 5 - t) / 5);
  const reach = native + (astaReach(f.moveId, t) - native) * gain;
  const nx = Math.cos(a),
    ny = Math.sin(a),
    px = -ny,
    py = nx,
    half = f.moveId === "astaBlackDivider" ? 10 : 4;
  c.fillStyle = "#100e19";
  c.beginPath();
  c.moveTo(g.x + nx * 16 + px * half, g.y + ny * 16 + py * half);
  c.lineTo(g.x + nx * reach + px * 2, g.y + ny * reach + py * 2);
  c.lineTo(g.x + nx * reach - px * 2, g.y + ny * reach - py * 2);
  c.lineTo(g.x + nx * 16 - px * half, g.y + ny * 16 - py * half);
  c.closePath();
  c.fill();
  stroke(
    c,
    g.x + nx * native,
    g.y + ny * native,
    g.x + nx * reach,
    g.y + ny * reach,
    2,
    "#a23949",
  );
}
/** Optional cosmetic accents follow authored hand sockets, not the neutral pivot. */
export function drawAstaAntimagic(
  c: CanvasRenderingContext2D,
  f: Fighter,
  frame: number,
) {
  if (f.state !== "attack" || !isAstaSpecial(f.moveId)) return;
  const t = f.stateFrame,
    m = f.move!,
    g = astaSpecialGrip(f.moveId, t),
    a = (g.angle * Math.PI) / 180;
  const active = t >= m.startup && t < m.startup + m.active;
  c.save();
  if (f.moveId === "astaDualBreak" && t >= 19 && t < 30) {
    const p = (t - 19) / 11;
    c.fillStyle = "#332b36";
    c.fillRect(-34, -87, 18, 23);
    c.fillStyle = "#ab8255";
    c.fillRect(-32, -85, 14, 2);
    c.fillStyle = "#c7b68b";
    c.fillRect(-25, -83, 1, 17);
    for (let i = 0; i < 7; i++) {
      const x = -25 + p * 50 + i * 3;
      c.fillStyle = i % 2 ? "#5e2a3d" : "#191626";
      c.fillRect(Math.round(x), -80 + ((i * 7 + t) % 19), 2, 2);
    }
  }
  if (f.moveId === "astaCausalityBreak" && t >= 3 && t < 17) {
    const radius = t < 12 ? 12 + (t - 3) * 2 : 30 - (t - 12) * 3;
    for (let i = 0; i < 5; i++) {
      const y = g.y - radius + (i * radius) / 2;
      stroke(c, g.x - 8, y, g.x + 4 + (i % 2) * 9, y - 7, 3, "#1a1422");
    }
  }
  if (
    active ||
    (t < m.startup &&
      ["astaBlackDivider", "astaCausalityBreak"].includes(f.moveId))
  ) {
    const reach = astaReach(f.moveId, t);
    for (let i = 0; i < 5; i++) {
      const d =
        18 + ((i * 19 + Math.floor(frame / 2) * 7) % Math.max(20, reach - 22));
      const x = g.x + Math.cos(a) * d,
        y = g.y + Math.sin(a) * d;
      const jitter = ((i * 13 + Math.floor(frame / 2)) % 9) - 4;
      stroke(
        c,
        x,
        y,
        x - Math.cos(a) * 8 - Math.sin(a) * jitter,
        y - Math.sin(a) * 8 + Math.cos(a) * jitter,
        3,
        "#391c30",
      );
      c.fillStyle = "#ad3e4c";
      c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
    }
  }
  c.restore();
}
export function drawAstaWaves(
  c: CanvasRenderingContext2D,
  m: Match,
  cosmetics: boolean,
) {
  for (const p of m.kiProjectiles) {
    if (p.move !== "astaBlackSlash") continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    const fade = p.state === "flight" ? 1 : Math.max(0, 1 - p.impactAge / 8);
    c.globalAlpha = fade;
    // Crescent, its opaque edge matches the swept vertical combat capsule.
    for (let y = -22; y <= 22; y += 2) {
      const x = -Math.round((y * y) / 96);
      stroke(c, x, y, x + 6, y, 5, "#171220");
      stroke(c, x + 4, y, x + 7, y, 2, "#8f3549");
    }
    if (cosmetics)
      for (let i = 0; i < 9; i++) {
        const x = -10 - ((p.age * 5 + i * 11) % 39),
          y = ((i * 13 + p.age * 3) % 43) - 22;
        c.fillStyle = i % 3 ? "#25182d" : "#ad4153";
        c.fillRect(x, y, 2 + (i % 2) * 2, 2);
      }
    c.restore();
  }
  if (cosmetics)
    for (const e of m.events) {
      if (!e.asta) continue;
      const total = e.total ?? 12,
        age = total - e.life;
      c.save();
      c.globalAlpha = e.life / total;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          d = 4 + age * (e.asta.kind === "break" ? 3 : 1.4);
        stroke(
          c,
          e.x + Math.cos(a) * d,
          e.y + Math.sin(a) * d,
          e.x + Math.cos(a) * (d + 8),
          e.y + Math.sin(a) * (d + 8),
          3,
          i % 2 ? "#9c3c57" : "#17131e",
        );
      }
      c.restore();
    }
}
