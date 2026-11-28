import type { ArenaState } from "./arenas";
import type { Fighter, Match } from "./combat";
import type { ArenaEventState } from "./arena-events";
import { shapeHitsRect } from "./geometry";
import { dojoRoom } from "./arena-rooms";

export type ArenaTerrainKind = "rubble" | "lamp" | "beam" | "wood-floor" | "ring-edge" | "crystal" | "roof" | "slick" | "market-wreck" | "patio-wreck";
export interface ArenaTerrain {
  id: string; kind: ArenaTerrainKind; x: number; y: number; w: number; h: number;
  age: number; life: number; health: number; hitBy: string[];
  eventKind?: ArenaEventState["kind"];
}
export function mainFloorHeight(arena: ArenaState, x: number): number {
  const patch = arena.terrain.find(t => t.kind === "wood-floor" && x >= t.x && x <= t.x + t.w);
  return patch ? 580 + patch.h : 580;
}
export function ringBounds(arena: ArenaState): [number, number] {
  const broken = arena.terrain.filter(t => t.kind === "ring-edge");
  return [broken.some(t => t.x < 640) ? 150 : 68, broken.some(t => t.x > 640) ? 1130 : 1212];
}
export function resolveArenaObstacles(arena: ArenaState, actor: Fighter, previousX: number) {
  for (const item of arena.terrain) {
    if (!["lamp", "beam", "rubble", "market-wreck", "patio-wreck"].includes(item.kind) || actor.y < item.y - item.h + 2 || actor.y > item.y + 15) continue;
    const half = actor.pushbox().w / 2;
    if (actor.x + half <= item.x || actor.x - half >= item.x + item.w) continue;
    const left = previousX <= item.x + item.w / 2;
    actor.x = left ? item.x - half : item.x + item.w + half;
    actor.vx = left ? Math.min(0, actor.vx) : Math.max(0, actor.vx);
  }
}
export function applyEventConsequence(arena: ArenaState, event: ArenaEventState) {
  if (event.consequence) return;
  event.consequence = true;
  if (arena.ben && ["alien-sign", "cargo-cart", "smoothy-sign", "patio-collapse", "delivery-cart"].includes(event.kind)) arena.ben.objects[`${event.kind}:${event.source.x}`] = true;
  const add = (kind: ArenaTerrainKind, x: number, y: number, w: number, h: number, life: number, health = 0) => {
    const id = `${kind}:${event.serial}`;
    arena.terrain = arena.terrain.filter(t => t.kind !== kind || kind === "ring-edge" && Math.abs(t.x - x) > 100);
    arena.terrain.push({ id, kind, x, y, w, h, life, health, hitBy: [], age: 0, eventKind: event.kind });
  };
  switch (event.kind) {
    case "car-crash": add("lamp", event.x - 60, 580, 120, 34, 600, 45); break;
    case "canyon-shock":
      if (event.variant !== "transformation" || arena.level) add("rubble", event.x - 55, 580, 110, 29, 780, 60);
      break;
    case "column-collapse":
      add("rubble", event.x - 65, 580, 130, 28, 900, 65);
      if (event.variant === "transformation" || arena.phase >= 3) {
        add("roof", 0, 0, 1280, 0, 0); arena.phase = Math.max(3, arena.phase); arena.phaseStart = arena.tick;
      }
      break;
    case "timber-break":
      add("beam", event.x - 63, 580, 126, 35, 660, 42);
      if (event.variant === "transformation" && dojoRoom(arena) !== "garden") add("wood-floor", event.x - 85, 580, 170, 24, 0);
      break;
    case "ring-fracture": add("ring-edge", event.x < 640 ? 68 : 1130, 580, 82, 30, 720); break;
    case "alien-sign": case "cargo-cart": case "smoothy-sign": case "delivery-cart": add("market-wreck", event.x - 65, 580, 130, 36, 840, 65); break;
    case "patio-collapse": add("patio-wreck", event.x - 50, 580, 100, 34, 660, 45); break;
    case "smoothie-spill": add("slick", event.x - 90, 580, 180, 5, 420); break;
    case "mana-fracture": add("crystal", 535, 410, 210, 25, 660, 75); break;
  }
  arena.terrain = arena.terrain.slice(-16);
}
export function stepArenaTerrain(match: Match) {
  const a = match.arena;
  for (const item of a.terrain) {
    item.age++;
    if (item.health <= 0 || item.kind === "crystal" && item.age < 36) continue;
    const box = { x: item.x, y: item.y - item.h, w: item.w, h: item.h };
    for (const actor of match.fighters) {
      if (actor.state !== "attack" || !actor.move) continue;
      const cast = `${actor.id}:${actor.moveId}:${match.combatFrame - actor.stateFrame}`;
      if (item.hitBy.includes(cast) || !actor.attackShapes().some(shape => shapeHitsRect(shape, box))) continue;
      item.hitBy.push(cast); item.hitBy = item.hitBy.slice(-24);
      item.health = Math.max(0, item.health - actor.move.damage);
      if (!item.health) item.life = item.age;
    }
  }
  a.terrain = a.terrain.filter(t => !t.life || t.age < t.life);
}
export function applyArenaTraction(arena: ArenaState, actor: Fighter, previousVx: number) {
  if (actor.y !== 580 || !["idle", "walk", "crouch", "dash"].includes(actor.state) || !arena.terrain.some(t => t.kind === "slick" && actor.x >= t.x && actor.x <= t.x + t.w)) return;
  if (Math.abs(actor.vx) < 10 && actor.vx) actor.vx *= 1.08;
  else if (!actor.vx && !actor.input.down) actor.vx = Math.max(-2, Math.min(2, previousVx * .65));
}
