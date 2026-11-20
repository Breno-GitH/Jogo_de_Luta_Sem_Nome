import type { Fighter } from "../engine/combat";
import {
  visibleAstaSword,
  swordNames,
  astaSwords,
} from "../engine/asta-stances";
import type { Animator } from "./animator";
import sockets from "../data/asta-sockets.json";
import weapons from "../data/asta-weapons.json";
export function drawAstaWeapon(
  c: CanvasRenderingContext2D,
  f: Fighter,
  a: Animator,
  atlas: CanvasImageSource | undefined,
  body: CanvasImageSource,
) {
  if (!atlas) return;
  const s = a.sprite(),
    id = s.sheet.replace("asta/", "").replace(".png", "");
  const grip = (
    sockets as Record<string, { x: number; y: number; angle: number }[]>
  )[id]?.[a.frame()];
  if (!grip) return;
  const sword = visibleAstaSword(f),
    weapon = weapons[sword];
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(grip.x, grip.y);
  c.rotate(((grip.angle + 90) * Math.PI) / 180);
  c.drawImage(
    atlas,
    weapon.index * 128,
    0,
    128,
    192,
    -weapon.pivot.x,
    -weapon.pivot.y,
    128,
    192,
  );
  c.restore();
  // The closed fist occludes the hilt. This is the authored cel, never a posed/warped body.
  const x = Math.round(grip.x + s.pivot.x),
    y = Math.round(grip.y + s.pivot.y);
  c.drawImage(
    body,
    s.x + x - 5,
    s.y + y - 5,
    10,
    10,
    grip.x - 5,
    grip.y - 5,
    10,
    10,
  );
}
export function drawAstaSwordHud(
  c: CanvasRenderingContext2D,
  f: Fighter,
  x: number,
) {
  const sword = f.asta!.equipped;
  c.save();
  c.font = "12px monospace";
  c.fillStyle = "#e5c677";
  c.fillText("ESPADA · " + swordNames[sword], x, 151);
  astaSwords.forEach((id, i) => {
    c.fillStyle = id === sword ? "#e5c677" : "#39414b";
    c.fillRect(x + i * 44, 158, 38, 4);
  });
  c.restore();
}
