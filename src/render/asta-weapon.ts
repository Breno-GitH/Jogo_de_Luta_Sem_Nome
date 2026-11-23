import { astaWeaponHidden, drawAstaBladeExtension } from "./asta-antimagic-fx";
import { drawAstaGrimoire, grimoireWeaponPose } from "./asta-grimoire";
import { recoverableAstaHealth } from "../engine/asta-causality";
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
  drawAstaGrimoire(c, f);
  const pose = grimoireWeaponPose(f, grip);
  const sword = visibleAstaSword(f),
    weapon = weapons[sword];
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(pose.x, pose.y);
  c.rotate(((pose.angle + 90) * Math.PI) / 180);
  c.scale(pose.scale, pose.scale);
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
  const x = Math.round(grip.x + s.pivot.x),
    y = Math.round(grip.y + s.pivot.y);
  if (pose.scale >= 0.99)
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
  const s = f.asta!,
    sword = s.equipped,
    now = f.match?.combatFrame ?? 0;
  c.save();
  c.font = "12px monospace";
  c.fillStyle = "#e5c677";
  c.fillText("ESPADA · " + swordNames[sword], x, 151);
  astaSwords.forEach((id, i) => {
    c.fillStyle = id === sword ? "#e5c677" : "#39414b";
    c.fillRect(x + i * 44, 158, 38, 4);
  });
  const relay = s.relay,
    cooldown = Math.max(0, s.restorationReadyAt - now);
  c.font = "10px monospace";
  c.fillStyle = cooldown ? "#8b8792" : "#c9baa3";
  c.fillText(
    cooldown
      ? "CAUSALITY · REVERSÃO " + (cooldown / 60).toFixed(1) + "s"
      : "CAUSALITY · REVERSÃO PRONTA (" + recoverableAstaHealth(f) + " HP)",
    x,
    177,
  );
  if (
    s.causalityResult &&
    now - s.causalityResult.at < 45 &&
    (s.causalityResult.hp || s.causalityResult.cleansed.length)
  ) {
    c.fillStyle = "#ded4b6";
    c.fillText(
      "REVERSÃO +" +
        s.causalityResult.hp +
        " HP · " +
        s.causalityResult.cleansed.length +
        " EFEITOS",
      x,
      192,
    );
  }
  if (relay) {
    c.fillStyle = "#d3a5ad";
    c.fillText(
      "RELAY · " +
        (relay.phase === "branch"
          ? "FINALIZAÇÃO " + swordNames[relay.sword]
          : relay.phase === "choice"
            ? "ESCOLHA UMA ESPADA"
            : "ABERTURA"),
      x,
      207,
    );
    c.fillStyle = relay.phase === "choice" ? "#e8d8b8" : "#88909c";
    relay.options.forEach((sword, i) =>
      c.fillText(
        ["J", "K", "L"][i] + " · " + swordNames[sword],
        x + i * 125,
        221,
      ),
    );
    if (relay.phase === "choice") {
      c.fillStyle = "#8b3c52";
      c.fillRect(
        x,
        227,
        240 * Math.max(0, Math.min(1, (relay.windowTo - f.stateFrame) / 16)),
        3,
      );
    }
  }
  c.restore();
}
