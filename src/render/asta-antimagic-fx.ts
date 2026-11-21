import { FLOOR, type Fighter, type Match } from "../engine/combat";
import {
  astaSpecialGrip,
  astaReach,
  isAstaAction,
} from "../engine/asta-specials";
import { swordReach } from "../engine/asta-normals";
import { visibleAstaSword } from "../engine/asta-stances";
import { drawCausalityRibbons } from "./asta-causality-fx";
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
  // Keep the last committed weapon visible until the next offensive drawing commits.
  return false;
}
/** Readable gameplay geometry remains visible when optional effects are disabled. Local fighter space. */
export function drawAstaBladeExtension(
  c: CanvasRenderingContext2D,
  f: Fighter,
) {
  if (
    f.state !== "attack" ||
    !isAstaAction(f.moveId) ||
    f.moveId !== "astaBlackDivider"
  )
    return;
  const t = f.stateFrame,
    m = f.move!,
    g = astaSpecialGrip(f.moveId, t, f.asta?.relay);
  if (t < 6 || t >= m.startup + m.active + 5) return;
  const a = (g.angle * Math.PI) / 180,
    native = swordReach[visibleAstaSword(f)];
  const gain =
    t < m.startup
      ? Math.min(1, (t - 6) / Math.max(1, m.startup - 6))
      : Math.min(1, (m.startup + m.active + 5 - t) / 5);
  const extended =
    native + (astaReach(f.moveId, t, f.asta?.relay) - native) * gain;
  // The active blade shares combat geometry. Its recovery dissolves above the ground.
  const reach =
    t >= m.startup + m.active && Math.sin(a) > 0
      ? Math.min(extended, -g.y / Math.sin(a))
      : extended;
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
  if (f.state !== "attack" || !isAstaAction(f.moveId)) return;
  const t = f.stateFrame,
    m = f.move!,
    g = astaSpecialGrip(f.moveId, t, f.asta?.relay),
    a = (g.angle * Math.PI) / 180;
  const active = t >= m.startup && t < m.startup + m.active;
  c.save();
  // Short quantized blade traces use the authored hand trajectory, never a screen-sized band.
  if (active && !["astaBlackSlash", "astaCausalityBreak"].includes(f.moveId)) {
    const before = astaSpecialGrip(
      f.moveId,
      Math.max(m.startup, t - 2),
      f.asta?.relay,
    );
    const reach = astaReach(f.moveId, t, f.asta?.relay),
      b = (before.angle * Math.PI) / 180;
    for (const fraction of [0.55, 0.8, 1]) {
      const from = {
        x: before.x + Math.cos(b) * reach * fraction,
        y: before.y + Math.sin(b) * reach * fraction,
      };
      const to = {
        x: g.x + Math.cos(a) * reach * fraction,
        y: g.y + Math.sin(a) * reach * fraction,
      };
      c.globalAlpha = 0.48;
      stroke(
        c,
        from.x,
        from.y,
        to.x,
        to.y,
        f.moveId === "astaBlackDivider" ? 4 : 2,
        "#211522",
      );
    }
    c.globalAlpha = 1;
  }
  if (
    ["astaBlackRush", "astaRisingDemon", "astaBlackDivider"].includes(
      f.moveId,
    ) &&
    active
  ) {
    const ground = FLOOR - f.y,
      intensity = f.moveId === "astaBlackDivider" ? 2 : 1;
    for (let i = 0; i < 8; i++) {
      const d = i * 9 + (((t - m.startup) * 7) % 18);
      c.fillStyle = i % 3 ? "#74655f" : "#b6a58c";
      c.fillRect(
        Math.round(20 + d),
        Math.round(ground - 2 - ((i * 3 + t) % 7) * intensity),
        4 + (i % 2) * 2,
        2,
      );
    }
  }
  if (f.moveId === "astaCausalityBreak") drawCausalityRibbons(c, f);
  if (
    active ||
    (t < m.startup &&
      ["astaBlackDivider", "astaCausalityBreak", "astaBlackSlash"].includes(
        f.moveId,
      ))
  ) {
    const reach = astaReach(f.moveId, t, f.asta?.relay);
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
    if (
      !["astaBlackSlash", "astaDualBreak"].includes(p.move) ||
      !m.fighters[p.owner].asta
    )
      continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    const fade = p.state === "flight" ? 1 : Math.max(0, 1 - p.impactAge / 8);
    c.globalAlpha = fade;
    // Crescent, its opaque edge matches the swept vertical combat capsule.
    for (let y = -p.radius; y <= p.radius; y += 2) {
      const x = -Math.round((y * y) / (p.radius * 4));
      stroke(c, x, y, x + 6, y, 5, "#171220");
      stroke(c, x + 4, y, x + 7, y, 2, "#8f3549");
    }
    if (cosmetics)
      for (let i = 0; i < 9; i++) {
        const x =
            -10 - ((p.age * 5 + i * 11) % Math.max(20, Math.abs(p.vx) * 3)),
          y = ((i * 13 + p.age * 3) % (p.radius * 2)) - p.radius;
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
          d =
            e.asta.kind === "restore"
              ? Math.max(3, 28 - age * 1.2)
              : 4 + age * (e.asta.kind === "break" ? 3 : 1.4);
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
