import type { Match } from "../engine/combat";
import { projectileBox } from "../engine/projectiles";

export function drawKnives(
  c: CanvasRenderingContext2D,
  match: Match,
  atlas?: HTMLImageElement,
  debug = false,
) {
  for (const p of match.projectiles) {
    if (atlas?.complete && atlas.naturalWidth) {
      const frame = p.sprite * 2 + (Math.floor(p.age / 3) % 2);
      c.save();
      c.translate(Math.round(p.x), Math.round(p.y));
      c.scale(p.facing, 1);
      if (p.owner === 1) c.filter = "hue-rotate(145deg)";
      c.drawImage(atlas, frame * 128 + 40, 52, 48, 24, -24, -12, 48, 24);
      c.restore();
    }
    if (debug) {
      const box = projectileBox(p);
      c.strokeStyle = "#ff8481";
      c.strokeRect(box.x, box.y, box.w, box.h);
      c.fillStyle = "#ffeac5";
      c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
  }
}
export function drawTimeTint(c: CanvasRenderingContext2D, match: Match) {
  if (match.temporal.active) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#7564bc35";
    c.fillRect(0, 0, 1280, 720);
    c.restore();
  }
}
export function drawTemporalEffects(
  c: CanvasRenderingContext2D,
  match: Match,
  atlas?: HTMLImageElement,
) {
  const t = match.temporal;
  if (!atlas?.complete || !atlas.naturalWidth) return;
  const elapsed = t.config.durationTicks - t.s.remaining;
  const pulse =
    t.active && elapsed < 16
      ? Math.floor(elapsed / 2)
      : t.s.endFlash > 0
        ? 7 - Math.floor((10 - t.s.endFlash) * 0.8)
        : -1;
  if (pulse < 0) return;
  const owner = match.fighters[t.active ? t.s.owner : t.s.lastOwner];
  if (!owner) return;
  c.save();
  c.globalAlpha = t.active ? 0.8 : 0.65;
  const x = Math.round(owner.stand?.transform.x ?? owner.x),
    y = Math.round((owner.stand?.transform.y ?? owner.y) - 90);
  const scale = t.active ? 3 : 2;
  c.drawImage(
    atlas,
    (6 + Math.max(0, Math.min(7, pulse))) * 128,
    0,
    128,
    128,
    x - 64 * scale,
    y - 64 * scale,
    128 * scale,
    128 * scale,
  );
  c.restore();
  if (t.active && elapsed < 3) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#d1c7fa32";
    c.fillRect(0, 0, 1280, 720);
    c.restore();
  }
}
