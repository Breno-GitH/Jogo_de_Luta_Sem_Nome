import type { Fighter } from "../engine/combat";
import { sasukeCurseBalance, winged } from "../engine/sasuke-curse";
import { poseAt } from "../engine/moves";
import { fillPixels } from "./pixel-contour";
import { sasukeBolt } from "./sasuke-special-fx";

export function drawSasukeCurseFX(c: CanvasRenderingContext2D, f: Fighter) {
  const s = f.sasukeCurse;
  if (!s) return;
  const tick = f.stateFrame;
  if (s.phase === "awakening" || s.phase === "reverting") {
    const remaining = (f.move?.recovery ?? 0) - tick;
    c.save();
    c.globalAlpha *= s.phase === "awakening" ? Math.min(1, (tick + 4) / 18) : Math.min(1, remaining / 14);
    for (let i = 0; i < 8; i++) {
      const radius = 21 + ((i * 11 + tick * 3) % 53);
      const x = Math.round(Math.cos(i * 2.4) * radius),
        y = -8 - ((i * 17 + tick * 4) % 116);
      fillPixels(c, [{ x: x - 4, y }, { x: x + 1, y: y - 7 }, { x: x + 3, y: y + 3 }], i % 2 ? "#52445a" : "#b99acc");
    }
    c.restore();
    return;
  }
  if (!winged(f)) return;
  if (s.airBurstTick) {
    for (let i = 0; i < 5; i++) {
      const x = -46 - (i % 3) * 13, y = -26 - i * 12;
      fillPixels(c, [{ x: x - 46, y: y + 2 }, { x, y }, { x: x + 13, y: y + 3 }, { x: x - 14, y: y + 4 }], i % 2 ? "#9c889e" : "#5e516c");
    }
  }
  if (f.attackPhase === "active" && (f.moveId === "stand_heavy" || f.moveId === "air_heavy")) {
    const contact = poseAt(f.move!, tick)?.hitboxes?.[0];
    if (contact && "a" in contact) sasukeBolt(c, contact.a, contact.b, tick, 2, 7, true);
  }
}

export function drawCurseHud(c: CanvasRenderingContext2D, f: Fighter, x: number) {
  const s = f.sasukeCurse;
  const phase = s?.phase;
  const clock = Math.ceil((s?.remaining ?? 0) / 60);
  const label = phase === "active" ? `ATIVA · ${clock}s`
    : phase === "cooldown" ? `RECARGA · ${clock}s`
    : phase === "awakening" ? "DESPERTANDO"
    : phase ? "REVERTENDO" : "DISPONÍVEL · ↓ ↓ + FORTE";
  const fraction = phase === "active" ? s!.remaining / sasukeCurseBalance.durationTicks
    : phase === "cooldown" ? 1 - s!.remaining / sasukeCurseBalance.cooldownTicks
    : phase ? 0 : 1;
  c.save();
  c.fillStyle = "#181428";
  c.fillRect(x, 655, 180, 4);
  c.fillStyle = phase === "active" ? "#d7a1ec" : "#9a78b7";
  c.fillRect(x, 655, Math.floor(180 * fraction), 4);
  c.font = "10px monospace";
  c.fillStyle = "#c8aadc";
  c.fillText(`MARCA II · ${label}`, x, 650);
  c.restore();
}
