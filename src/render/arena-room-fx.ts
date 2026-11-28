import type { ArenaState } from "../engine/arenas";
import type { Match } from "../engine/combat";
import { dojoRoom, dojoRoomOrder, dojoRoomProfiles, dojoTravelProgress } from "../engine/arena-rooms";
import { drawArena, visibleWorldBounds } from "./arena";
import { drawArenaSprite, type EventImages } from "./arena-sprites";

export function drawDojoRooms(c: CanvasRenderingContext2D, a: ArenaState, images: ReadonlyMap<string, HTMLImageElement>): boolean {
  if (!a.dojo) return false;
  const room = dojoRoom(a), travel = a.dojo.transition;
  const texture = (id: typeof room) => images.get(dojoRoomProfiles[id].image);
  const still = { ...a, phase: 0 };
  drawArena(c, still, texture(room));
  if (!travel) return true;
  const p = dojoTravelProgress(a), b = visibleWorldBounds(c);
  if (travel.depth) {
    c.save(); c.globalAlpha = p; drawArena(c, still, texture(travel.to)); c.restore();
  } else {
    for (const [id, offset] of [[travel.from, -travel.direction * 1280 * p], [travel.to, travel.direction * 1280 * (1 - p)]] as const) {
      c.save(); c.beginPath(); c.rect(offset, b.top, 1280, b.bottom - b.top); c.clip(); c.translate(Math.round(offset), 0);
      drawArena(c, still, texture(id)); c.restore();
    }
  }
  return true;
}
export function drawDojoExits(c: CanvasRenderingContext2D, a: ArenaState, match?: Match, images?: EventImages) {
  if (!a.dojo || match?.cinematicActive || a.mode === "classico") return;
  const room = dojoRoom(a), travel = a.dojo.transition, index = dojoRoomOrder.indexOf(room);
  c.save(); c.font = "bold 11px monospace"; c.fillStyle = "#efe0b5"; c.textAlign = "center";
  c.fillText(`DOJO · ${dojoRoomProfiles[travel?.to ?? room].label}`, 640, 185);
  if (travel?.impact) {
    const victim = match?.fighters[travel.impact.victim];
    if (travel.tick >= 54 && victim) drawArenaSprite(c, images, "dojo", 6, victim.x, 586, 140, 65);
    else if (travel.tick < 18) drawArenaSprite(c, images, "dojo", 6, travel.direction > 0 ? 1200 : 80, 560, 130, 90);
  }
  if (!travel) {
    for (const direction of [-1, 1] as const) {
      const target = dojoRoomOrder[index + direction]; if (!target) continue;
      const x = direction < 0 ? 98 : 1182, nearby = match?.fighters.some(f => Math.abs(f.x - x) < 240);
      if (!nearby) continue;
      c.fillStyle = "#171b1dc9"; c.fillRect(x - 92, 410, 184, 31);
      c.fillStyle = "#efdcac"; c.fillText(`${direction < 0 ? "← " : ""}${dojoRoomProfiles[target].label}${direction > 0 ? " →" : ""}`, x, 424);
      c.font = "9px monospace"; c.fillText("GOLPEIE EM DIREÇÃO À SAÍDA", x, 436); c.font = "bold 11px monospace";
    }
  }
  c.restore();
}
