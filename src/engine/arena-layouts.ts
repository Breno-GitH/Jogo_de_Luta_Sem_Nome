import type { ArenaId, ArenaState } from "./arenas";
import type { Fighter } from "./combat";
import type { InputFrame } from "./types";
import { mainFloorHeight } from "./arena-terrain";

export const arenaFloor = 580;
export const lowerLevelOffset = 720;
export const descentTicks = 84;
export interface ArenaPlatform { id: string; x: number; y: number; width: number; material: "metal" | "stone"; }
export interface ArenaLayout { structure: "traditional" | "descent" | "platform" | "hybrid"; lowerName?: string; platforms: readonly ArenaPlatform[]; }
export const arenaLayouts: Record<ArenaId, ArenaLayout> = {
  dojo: { structure: "traditional", platforms: [] },
  budokai: { structure: "traditional", platforms: [] },
  cairo: { structure: "traditional", platforms: [] },
  enies: { structure: "descent", lowerName: "Passarela sob a ponte", platforms: [] },
  uchiha: { structure: "hybrid", platforms: [] },
  anteiku: { structure: "traditional", platforms: [] },
  undertown: { structure: "traditional", platforms: [] },
  godvalley: { structure: "descent", lowerName: "Leito da ravina", platforms: [] },
  clover: { structure: "platform", platforms: [
    { id: "left-ruin", x: 230, y: 468, width: 225, material: "stone" },
    { id: "right-ruin", x: 825, y: 468, width: 225, material: "stone" },
  ] },
};
export const arenaPlatforms = (a: ArenaState): readonly ArenaPlatform[] => {
  if (a.mode === "classico" || a.transition) return [];
  const base = arenaLayouts[a.id].platforms;
  return [...base, ...a.terrain.filter(t => t.kind === "crystal" && t.age >= 36 || t.kind === "rubble").map(t =>
    ({ id: t.id, x: t.x, y: t.kind === "rubble" ? t.y - t.h : t.y, width: t.w, material: "stone" as const }))];
};
export function openStage(a: ArenaState): boolean { return a.mode !== "classico" && arenaLayouts[a.id].structure === "platform"; }
export function hasMainFloor(a: ArenaState, x: number): boolean {
  const left = a.id === "clover" ? 150 : 245, right = a.id === "clover" ? 1130 : 1035;
  return !openStage(a) || x >= left && x <= right;
}

/** Support is explicit synchronized state; one-way collision uses the swept foot position. */
export function supportHeight(a: ArenaState, f: Fighter): number {
  const support = arenaPlatforms(a).find(p => p.id === a.supports[f.id] && f.x >= p.x && f.x <= p.x + p.width);
  return support && Math.abs(f.y - support.y) < .1 ? support.y : hasMainFloor(a, f.x) ? mainFloorHeight(a, f.x) : Infinity;
}
export function prepareArenaMovement(a: ArenaState, f: Fighter, input: InputFrame): InputFrame {
  const support = supportHeight(a, f);
  if (support < arenaFloor && input.down && input.pressed.includes("jump") &&
      ["idle", "walk", "crouch", "landing"].includes(f.state)) {
    a.supports[f.id] = null;
    a.dropUntil[f.id] = a.tick + 18;
    f.y += 3; f.vy = 1; f.setState("air");
    f.buffer.actions = f.buffer.actions.filter(action => action.button !== "jump");
    return { ...input, pressed: input.pressed.filter(button => button !== "jump") };
  }
  if (support >= arenaFloor && (f.y < support || support === Infinity) && f.vy === 0 && ["idle", "walk", "crouch", "dash", "landing"].includes(f.state)) {
    a.supports[f.id] = null;
    f.setState("air");
  }
  return input;
}
export function arenaLanding(a: ArenaState, f: Fighter, previousY: number): number | undefined {
  if (f.vy < 0) { a.supports[f.id] = null; return; }
  const platform = a.dropUntil[f.id] <= a.tick && arenaPlatforms(a).find(p =>
    f.x >= p.x && f.x <= p.x + p.width && previousY <= p.y + .1 && f.y >= p.y);
  if (platform) { a.supports[f.id] = platform.id; return platform.y; }
  a.supports[f.id] = null;
  const ground = mainFloorHeight(a, f.x);
  return f.y >= ground && hasMainFloor(a, f.x) && (!openStage(a) || previousY <= ground + .1) ? ground : undefined;
}

/** Pure render clock. Gameplay positions are canonical again after the descent completes. */
export function descentProgress(a: ArenaState): number {
  const t = a.transition;
  if (!t) return 0;
  const p = Math.max(0, Math.min(1, (t.tick - 12) / 54));
  return p * p * (3 - 2 * p);
}
