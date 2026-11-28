import type { ArenaState } from "./arenas";
import type { ArenaTerrain } from "./arena-terrain";
import type { CombatHit, Match } from "./combat";
import { neutral } from "./types";

export type DojoRoom = "west" | "hall" | "veranda" | "garden";
export interface DojoRoomTransition {
  from: DojoRoom; to: DojoRoom; direction: -1 | 1; depth: boolean; tick: number;
  origins: number[]; targets: number[];
  impact?: { attacker: number; victim: number; heights: number[] };
}
export interface DojoRooms {
  room: DojoRoom; serial: number; cooldown: number;
  pending?: { attacker: number; victim: number; to: DojoRoom; direction: -1 | 1 };
  transition?: DojoRoomTransition;
  saved: Partial<Record<DojoRoom, { terrain: ArenaTerrain[]; phase: number; integrity: number }>>;
}
export const dojoRoomOrder: readonly DojoRoom[] = ["west", "hall", "veranda", "garden"];
export const dojoRoomProfiles: Record<DojoRoom, { label: string; image: string; sourceY: number; warning: string }> = {
  west: { label: "SALA DE TREINO", image: "dojo-west", sourceY: 290, warning: "SUPORTE DO ARSENAL CEDENDO" },
  hall: { label: "SALÃO PRINCIPAL", image: "dojo", sourceY: 110, warning: "VIGA DO TETO RACHANDO" },
  veranda: { label: "VARANDA", image: "dojo-veranda", sourceY: 125, warning: "BEIRAL ENFRAQUECIDO" },
  garden: { label: "JARDIM", image: "dojo-garden", sourceY: 220, warning: "TRAVESSA DA PÉRGOLA SOLTA" },
};
export const dojoTravelTicks = 66;
export const createDojoRooms = (): DojoRooms => ({ room: "hall", serial: 0, cooldown: 0, saved: {} });
export function dojoRoom(a: ArenaState): DojoRoom { return a.dojo?.room ?? "hall"; }
export function dojoTravelProgress(a: ArenaState): number {
  const travel = a.dojo?.transition;
  const p = Math.max(0, Math.min(1, travel?.impact ? (travel.tick - 10) / (dojoTravelTicks - 22) : (travel?.tick ?? 0) / dojoTravelTicks));
  return p * p * (3 - 2 * p);
}
export function beginDojoTravel(match: Match, to: DojoRoom, direction: -1 | 1, depth = false, impact?: { attacker: number; victim: number }) {
  const a = match.arena, rooms = a.dojo;
  if (!rooms || a.mode === "classico" || match.phase !== "fight" || rooms.transition || rooms.room === to || match.cinematicActive || match.capture || match.temporal.active || match.hitstop || match.fighters.some(f => f.health <= 0 || (!impact && (f.y !== 580 || !["idle", "walk", "crouch", "landing"].includes(f.state))))) return false;
  rooms.saved[rooms.room] = { terrain: a.terrain, phase: a.phase, integrity: a.integrity };
  const ordered = [...match.fighters].sort((f, g) => f.x - g.x), targets = [0, 0];
  ordered.forEach((f, i) => targets[f.id] = depth ? 400 + i * 480 : direction > 0 ? 180 + i * 260 : 840 + i * 260);
  if (impact) { targets[impact.attacker] = direction > 0 ? 360 : 920; targets[impact.victim] = direction > 0 ? 740 : 540; }
  rooms.transition = { from: rooms.room, to, direction, depth, tick: 0, origins: match.fighters.map(f => f.x), targets,
    impact: impact ? { ...impact, heights: match.fighters.map(f => f.y) } : undefined };
  rooms.pending = undefined; rooms.serial++; a.hazard = undefined; a.supports = [null, null];
  match.projectiles = []; match.kiProjectiles = []; match.beams = [];
  for (const f of match.fighters) {
    if (f.omnitrix) f.omnitrix.objects = []; f.buffer.clear(); f.vx = f.vy = 0; f.stun = 0;
    f.setState(impact ? f.id === impact.victim ? "hitstun" : "dash" : "walk");
    f.hitLaunch = !!impact && f.id === impact.victim; f.knockedDown = false;
  }
  return true;
}
/** Connected spaces use the existing combat coordinate system, with one authoritative travel clock. */
export function stepDojoRooms(match: Match, hits: readonly CombatHit[] = []): boolean {
  const a = match.arena, rooms = a.dojo; if (!rooms) return false;
  if (match.phase !== "fight" || a.mode === "classico" || match.temporal.active) return false;
  if (!rooms.transition && !rooms.cooldown && !match.cinematicActive && !match.capture) for (const hit of hits) {
    if (hit.blocked || hit.damage < 28) continue;
    const victim = match.fighters[hit.victim], attacker = match.fighters[hit.attacker];
    if (!victim || !attacker || victim.health <= 0 || victim.y < 420) continue;
    const direction = victim.x >= 1120 && attacker.x < victim.x ? 1 : victim.x <= 160 && attacker.x > victim.x ? -1 : 0;
    const to = dojoRoomOrder[dojoRoomOrder.indexOf(rooms.room) + direction];
    if (direction && to) rooms.pending = { attacker: hit.attacker, victim: hit.victim, to, direction };
  }
  if (match.cinematicActive || match.capture || match.hitstop) return false;
  const travel = rooms.transition;
  if (travel) {
    travel.tick++; const p = dojoTravelProgress(a);
    match.fighters.forEach((f, i) => {
      if (travel.impact) {
        const victim = f.id === travel.impact.victim;
        const q = Math.max(0, Math.min(1, (travel.tick - (victim ? 0 : 12)) / (dojoTravelTicks - 12)));
        const movement = q * q * (3 - 2 * q);
        f.x = Math.round(travel.origins[i] + (travel.targets[i] + travel.direction * 1280 - travel.origins[i]) * movement - travel.direction * 1280 * p);
        const height = travel.impact.heights[i];
        f.y = victim ? Math.round(height + (580 - height) * movement - Math.sin(Math.PI * q) * 125) : 580;
        if (victim && travel.tick === dojoTravelTicks - 12) { f.hitLaunch = false; f.setState("getup"); }
        f.facing = victim ? -travel.direction as -1 | 1 : travel.direction;
      } else { f.x = Math.round(travel.origins[i] + (travel.targets[i] - travel.origins[i]) * p); f.y = 580; f.facing = travel.direction; }
      f.vx = f.vy = 0; f.stateFrame++;
    });
    if (travel.tick >= dojoTravelTicks) {
      rooms.room = travel.to; rooms.transition = undefined; rooms.cooldown = 90;
      const saved = rooms.saved[rooms.room]; a.terrain = saved?.terrain ?? []; a.phase = saved?.phase ?? 0; a.integrity = saved?.integrity ?? 0;
      a.phaseStart = a.tick; a.nextEventAt = a.eventClock + 300;
      for (const f of match.fighters) { f.x = travel.targets[f.id]; f.y = 580; f.hitLaunch = f.knockedDown = false; f.setState("idle"); f.input = neutral(); f.buffer.clear(); }
    }
    return true;
  }
  if (rooms.cooldown > 0) { rooms.cooldown--; rooms.pending = undefined; return false; }
  const pending = rooms.pending;
  return !!pending && beginDojoTravel(match, pending.to, pending.direction, false, pending);
}
