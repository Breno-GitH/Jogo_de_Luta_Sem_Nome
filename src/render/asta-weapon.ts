import { astaWeaponHidden, drawAstaBladeExtension } from "./asta-antimagic-fx";
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
  if (!atlas || astaWeaponHidden(f)) return;
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
  drawAstaBladeExtension(c, f);
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
  const relay = f.asta?.relay,
    pursuit = f.asta?.pursuit;
  if (relay) {
    c.fillStyle = "#d3a5ad";
    c.fillText(
      "RELAY · " +
        relay.extensions +
        "/2 · " +
        (relay.phase === "finish"
          ? "FINALIZAÇÃO"
          : relay.confirmed
            ? "CONFIRMADO"
            : "ABERTURA"),
      x,
      182,
    );
    c.font = "10px monospace";
    c.fillStyle = "#c3c8d0";
    c.fillText("Frente+J Slayer · Trás+J Slasher", x, 199);
    c.fillText("Baixo+J Dweller · Baixo+K Destroyer", x, 212);
    if (relay.confirmed && relay.phase !== "finish" && relay.extensions < 2) {
      const remaining = Math.max(
        0,
        Math.min(1, (relay.windowTo - f.stateFrame) / 12),
      );
      c.fillStyle = "#8b3c52";
      c.fillRect(x, 219, 170 * remaining, 3);
    }
  } else if (pursuit && !pursuit.used && f.match!.frame <= pursuit.until) {
    c.fillStyle = "#c8b0ce";
    c.fillText("BLACK SLASH · J PARA PERSEGUIR", x, 182);
  }
  c.restore();
}
