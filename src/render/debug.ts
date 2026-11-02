import type { AttackShape, Capsule, Rect } from "../engine/types";

function rectangle(c: CanvasRenderingContext2D, r: Rect, color: string) {
  c.strokeStyle = color;
  c.fillStyle = color + "15";
  c.lineWidth = 1;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeRect(r.x, r.y, r.w, r.h);
}
function capsule(c: CanvasRenderingContext2D, s: Capsule, color: string) {
  const angle = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x),
    nx = Math.cos(angle + Math.PI / 2) * s.r,
    ny = Math.sin(angle + Math.PI / 2) * s.r;
  c.beginPath();
  c.moveTo(s.a.x + nx, s.a.y + ny);
  c.lineTo(s.b.x + nx, s.b.y + ny);
  c.arc(s.b.x, s.b.y, s.r, angle + Math.PI / 2, angle - Math.PI / 2, true);
  c.lineTo(s.a.x - nx, s.a.y - ny);
  c.arc(s.a.x, s.a.y, s.r, angle - Math.PI / 2, angle + Math.PI / 2, true);
  c.closePath();
  c.strokeStyle = color;
  c.fillStyle = color + "35";
  c.lineWidth = 1;
  c.fill();
  c.stroke();
}
export function drawCombatDebug(
  c: CanvasRenderingContext2D,
  hurtboxes: Rect[],
  attacks: AttackShape[],
  pushbox?: Rect,
  blade?: Capsule,
) {
  c.save();
  for (const box of hurtboxes) rectangle(c, box, "#72ee99");
  if (pushbox) rectangle(c, pushbox, "#629cff");
  if (blade && !attacks.length) {
    c.strokeStyle = "#e8c969";
    c.setLineDash([2, 2]);
    c.beginPath();
    c.moveTo(blade.a.x, blade.a.y);
    c.lineTo(blade.b.x, blade.b.y);
    c.stroke();
    c.setLineDash([]);
  }
  for (const shape of attacks)
    if ("a" in shape) capsule(c, shape, "#ff6c77");
    else rectangle(c, shape, "#ff6c77");
  c.restore();
}
