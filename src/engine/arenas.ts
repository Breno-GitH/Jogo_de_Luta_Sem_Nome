import type { CombatHit, Match } from "./combat";
import { arenaLayouts, descentProgress, descentTicks, lowerLevelOffset, openStage } from "./arena-layouts";
import { advanceEventClock, applyEventContacts, eventSpec, createArenaEvent, isArenaEvent, type ArenaEventState } from "./arena-events";
import { applyEventConsequence, ringBounds, stepArenaTerrain, type ArenaTerrain } from "./arena-terrain";
import { createDojoRooms, stepDojoRooms, type DojoRooms } from "./arena-rooms";
import { createBenArena, stepBenArena, type BenArenaState } from "./ben-arena";

/** Arena state is part of the deterministic match snapshot. Decoration is not. */
export const arenaIds = ["dojo", "budokai", "cairo", "enies", "uchiha", "anteiku", "undertown", "godvalley", "clover"] as const;
export type ArenaId = typeof arenaIds[number];
export const arenaModes = ["classico", "interativo"] as const;
/** caotico remains a wire/load alias for older room presets, never a separate ruleset. */
export type ArenaMode = typeof arenaModes[number] | "caotico";
export interface ArenaInfo { id: ArenaId; name: string; origin: string; description: string; hazard: string; }
export const arenas: ArenaInfo[] = [
  { id: "dojo", name: "Dojo do Samurai", origin: "M.S.F.D", description: "Salão, sala de treino, varanda e jardim conectados", hazard: "Passagens laterais e madeira quebrável" },
  { id: "budokai", name: "Tenkaichi Budokai", origin: "Dragon Ball", description: "Torneio e plateia na Ilha Papaya", hazard: "Ring-out opcional" },
  { id: "cairo", name: "Ruas do Cairo", origin: "JoJo", description: "Cidade do confronto final de Jotaro e DIO", hazard: "Objetos urbanos" },
  { id: "enies", name: "Ponte da Hesitação", origin: "One Piece", description: "Enies Lobby sob o Buster Call", hazard: "Ponte instável" },
  { id: "uchiha", name: "Esconderijo Uchiha", origin: "Naruto", description: "Salão do duelo entre irmãos", hazard: "Teto e colunas" },
  { id: "anteiku", name: "Exterior do Anteiku", origin: "Tokyo Ghoul", description: "Café da 20ª Ala", hazard: "Vitrine quebrável" },
  { id: "undertown", name: "Undertown", origin: "Ben 10", description: "Cidade de Baixo → Mr. Smoothy · Arena viva: vença 3 rounds", hazard: "Mercado, tubulações, cargas e elevador" },
  { id: "godvalley", name: "God Valley", origin: "One Piece", description: "Ravina do incidente lendário", hazard: "Colapso rochoso" },
  { id: "clover", name: "Exame dos Cavaleiros Reais", origin: "Black Clover", description: "Campo de cristais · ravina e patamares de pedra", hazard: "Cristais reativos" },
];
export const arenaForCharacter: Record<string, ArenaId> = {
  samurai: "dojo", dio: "cairo", goku: "budokai", luffy: "enies",
  sasuke: "uchiha", kaneki: "anteiku", ben: "undertown", xebec: "godvalley", asta: "clover",
};
export function validArena(id: unknown): id is ArenaId { return typeof id === "string" && arenaIds.includes(id as ArenaId); }
export function validArenaMode(mode: unknown): mode is ArenaMode { return mode === "caotico" || mode === "classico" || mode === "interativo"; }

export interface LegacyArenaHazard {
  kind: "surge" | "fall" | "debris" | "bombardment" | "floor";
  x: number;
  phase: "warning" | "active" | "cooldown";
  ticks: number;
  affected: [boolean, boolean];
}
export type ArenaHazard = LegacyArenaHazard | ArenaEventState;
export interface ArenaFall { kind: "collapse" | "ringout" | "void"; tick: number; x: number }
export interface ArenaTransition { tick: number; x: number; origins: [number, number]; targets: [number, number]; }
export interface ArenaState {
  id: ArenaId;
  mode: ArenaMode;
  tick: number;
  integrity: number;
  phase: number;
  phaseStart: number;
  reactionUntil: number;
  reactionX: number;
  reactionKind: "hit" | "super" | "ko";
  ringOutSeat?: 0 | 1;
  hazard?: ArenaHazard;
  falling: [ArenaFall | null, ArenaFall | null];
  collapsed: number[];
  fallSafeUntil: [number, number];
  level: 0 | 1;
  transition?: ArenaTransition;
  supports: [string | null, string | null];
  dropUntil: [number, number];
  eventSerial: number;
  eventClock: number;
  nextEventAt: number;
  terrain: ArenaTerrain[];
  dojo?: DojoRooms;
  ben?: BenArenaState;
}
export function createArena(id: ArenaId = "dojo", mode: ArenaMode = "classico"): ArenaState {
  return { id, mode: mode === "caotico" ? "interativo" : mode, tick: 0, integrity: 0, phase: 0, phaseStart: 0, reactionUntil: 0, reactionX: 640, reactionKind: "hit", falling: [null, null], collapsed: [], fallSafeUntil: [0, 0], level: 0, supports: [null, null], dropUntil: [0, 0], eventSerial: 0, eventClock: 0, nextEventAt: 480 + arenaIds.indexOf(id) * 17, terrain: [], ...(id === "dojo" ? { dojo: createDojoRooms() } : id === "undertown" ? { ben: createBenArena() } : {}) };
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const hazardFor: Partial<Record<ArenaId, { kind: ArenaHazard["kind"]; warning: number; active: number; radius: number; damage: number }>> = {
  dojo: { kind: "floor", warning: 72, active: 20, radius: 55, damage: 8 },
  cairo: { kind: "debris", warning: 70, active: 18, radius: 57, damage: 10 },
  enies: { kind: "fall", warning: 90, active: 28, radius: 68, damage: 18 },
  uchiha: { kind: "debris", warning: 78, active: 18, radius: 60, damage: 12 },
  anteiku: { kind: "debris", warning: 70, active: 18, radius: 48, damage: 7 },
  undertown: { kind: "surge", warning: 64, active: 16, radius: 78, damage: 12 },
  godvalley: { kind: "fall", warning: 90, active: 28, radius: 70, damage: 18 },
  clover: { kind: "surge", warning: 70, active: 18, radius: 65, damage: 10 },
};
export function hazardRadius(a: ArenaState): number {
  if (isArenaEvent(a.hazard)) return eventSpec(a, a.hazard).radius;
  return a.hazard?.kind === "bombardment" ? 90 : hazardFor[a.id]?.radius ?? 65;
}

function beginDescent(match: Match, x: number) {
  const a = match.arena;
  if (a.level || a.transition || !arenaLayouts[a.id].lowerName || match.fighters.some(f => f.health <= 0)) return;
  const [left, right] = [...match.fighters].sort((f, g) => f.x - g.x);
  const targets: [number, number] = [0, 0];
  targets[left.id] = clamp(left.x, 210, 600);
  targets[right.id] = clamp(right.x, 760, 1070);
  a.transition = { tick: 0, x, origins: [match.fighters[0].x, match.fighters[1].x], targets };
  a.supports = [null, null]; a.falling = [null, null];
  match.hitstop = 0;
  match.projectiles = []; match.kiProjectiles = []; match.beams = [];
  for (const f of match.fighters) {
    f.setState("hitstun"); f.stun = descentTicks; f.vx = f.vy = 0;
    f.hitLaunch = true; f.knockedDown = false; f.buffer.clear();
  }
}

function advanceDescent(match: Match): boolean {
  const a = match.arena, transition = a.transition;
  if (!transition) return false;
  transition.tick++;
  const progress = descentProgress(a);
  for (const f of match.fighters) {
    f.x = transition.origins[f.id] + (transition.targets[f.id] - transition.origins[f.id]) * progress;
    f.y = 580 + Math.round(progress * lowerLevelOffset);
    f.vx = 0; f.vy = transition.tick < 66 ? 8 : 0; f.stateFrame++; f.stun = descentTicks;
    f.syncReactionClock(true);
  }
  if (transition.tick >= descentTicks) {
    a.level = 1; a.transition = undefined; a.falling = [null, null];
    a.hazard = undefined; a.collapsed = []; a.terrain = []; a.phase = Math.max(a.phase, 3);
    a.nextEventAt = a.eventClock + 540;
    a.reactionUntil = a.tick + 30;
    for (const f of match.fighters) {
      f.y = 580; f.combo = f.comboAge = f.comboAirHits = f.airChaseTicks = 0;
      f.hitLaunch = false; f.knockedDown = false; f.stun = 0;
      f.health = Math.max(1, f.health - 8);
      f.setState("landing"); f.buffer.clear();
      a.fallSafeUntil[f.id] = a.tick + 180;
    }
  }
  return true;
}

function advanceFalls(match: Match) {
  const a = match.arena;
  for (const seat of [0, 1] as const) {
    const fall = a.falling[seat];
    if (!fall) continue;
    const fighter = match.fighters[seat];
    fall.tick++;
    if (fall.kind === "void") {
      fighter.y = 920 + Math.round(fall.tick * fall.tick * .35);
      fighter.vx = 0; fighter.vy = 8;
      fighter.stateFrame++; fighter.syncReactionClock(true);
      if (fall.tick >= 22) {
        // Crossing the lower blast boundary is a round loss, independent of remaining HP.
        fighter.health = 0;
        a.ringOutSeat = seat;
        a.falling[seat] = null;
      }
      continue;
    }
    fighter.y = 580 + Math.min(230, Math.max(2, Math.round(fall.tick * fall.tick * .42)));
    fighter.vx = fighter.vy = 0;
    if (fall.tick < 27) continue;
    if (fall.kind === "ringout") {
      a.ringOutSeat = seat;
      fighter.health = 0;
    }
    a.falling[seat] = null;
  }
}

/** Advance once before clearing last tick's hits. No random decisions, no decorative particles. */
export function stepArena(match: Match, previousHits: readonly CombatHit[]) {
  const a = match.arena;
  if (match.temporal.active) return; // Dio's time stop freezes the environment too.
  a.tick++;
  if (match.phase !== "fight") {
    if (match.phase === "roundEnd" && a.reactionKind !== "ko") {
      a.reactionKind = "ko";
      a.reactionUntil = a.tick + 90;
    }
    return;
  }
  // Cinematic and capture clocks own all arena timers. The previous hit may still change the scenery.
  const paused = match.cinematicActive || !!match.capture;
  // Structural hits may be recorded during hitstop, but boarding waits for a safe live tick.
  if (stepBenArena(match, previousHits)) return;
  if (stepDojoRooms(match, previousHits)) return;
  if (!paused && advanceDescent(match)) return;
  if (paused) a.supports = [null, null];
  if (!paused) advanceFalls(match);
  if (!paused && !match.hitstop && a.mode !== "classico") {
    a.eventClock++;
    stepArenaTerrain(match);
  }
  if (!paused && openStage(a)) for (const f of match.fighters) {
    if (f.y < 920 || a.falling[f.id] || f.health <= 0) continue;
    a.falling[f.id] = { kind: "void", tick: 0, x: f.x };
    a.supports[f.id] = null;
    f.setState("hitstun"); f.stun = 30; f.hitLaunch = true; f.knockedDown = false;
    f.buffer.clear();
  }
  for (const hit of previousHits) {
    if (hit.blocked || hit.damage < 28) continue;
    const victim = match.fighters[hit.victim];
    a.reactionX = Math.round(victim.x);
    a.reactionKind = hit.damage >= 90 ? "super" : "hit";
    a.reactionUntil = a.tick + (hit.damage >= 90 ? 42 : 24);
    const [ringLeft, ringRight] = ringBounds(a);
    if (!paused && a.id === "budokai" && a.mode !== "classico" && !a.falling[victim.id] &&
        victim.stun > 0 && victim.y >= 535 && (victim.x <= ringLeft || victim.x >= ringRight)) {
      a.falling[victim.id] = { kind: "ringout", tick: 0, x: victim.x };
      a.reactionKind = "ko";
      victim.setState("hitstun");
      continue;
    }
    if (a.mode !== "classico" && hit.damage >= 45) {
      a.integrity = Math.min(13, a.integrity + (hit.damage >= 120 ? 2 : 1));
      const threshold = ["uchiha", "dojo", "cairo", "anteiku", "clover"].includes(a.id) ? 3 : 2;
      const next = Math.min(5, Math.max(0, 1 + Math.floor((a.integrity - threshold) / 2)));
      if (a.integrity >= threshold && next > a.phase) {
        a.phase = next;
        a.phaseStart = a.tick;
      }
    }
    if (a.mode === "classico" || a.hazard || a.integrity < 2 || paused) continue;
    if (!a.falling.some(Boolean)) a.hazard = createArenaEvent(a);
  }
  if (paused) return;
  if (!a.hazard && a.mode !== "classico" && a.eventClock >= a.nextEventAt && !a.falling.some(Boolean)) a.hazard = createArenaEvent(a);
  if (a.collapsed.length && (!a.hazard || a.hazard.phase === "cooldown")) for (const f of match.fighters) {
    if (a.falling[f.id] || a.fallSafeUntil[f.id] > a.tick || f.y < 535 || f.health <= 0) continue;
    const hole = a.collapsed.find(x => Math.abs(f.x - x) <= 44);
    if (hole === undefined) continue;
    beginDescent(match, hole);
    break;
  }
  const h = a.hazard;
  if (!h || a.transition || match.hitstop > 0) return;
  if (isArenaEvent(h)) {
    if (!advanceEventClock(a, h)) {
      a.hazard = undefined; a.integrity = 0; a.nextEventAt = a.eventClock + 150;
      return;
    }
    if (h.stage === "impact" && !h.consequence) {
      applyEventConsequence(a, h);
      a.reactionKind = "super"; a.reactionX = h.x; a.reactionUntil = a.tick + 36;
      if (h.variant === "transformation" && !a.level && ["enies", "godvalley"].includes(a.id)) {
        if (!a.collapsed.some(x => Math.abs(x - h.x) < 125)) a.collapsed.push(h.x);
        if (match.fighters.some(f => f.health > 0 && f.y >= 535 && Math.abs(f.x - h.x) <= hazardRadius(a))) beginDescent(match, h.x);
      }
    }
    if (!a.transition) applyEventContacts(match, h);
    return;
  }
  if (--h.ticks > 0) {
    if (h.phase === "active") applyArenaHazard(match, h);
    return;
  }
  if (h.phase === "warning") {
    h.phase = "active";
    h.ticks = h.kind === "bombardment" ? 24 : hazardFor[a.id]?.active ?? 16;
    if (h.kind === "fall" && !a.collapsed.some(x => Math.abs(x - h.x) < 125)) a.collapsed.push(h.x);
    return;
  }
  if (h.phase === "active") { h.phase = "cooldown"; h.ticks = 420; return; }
  a.hazard = undefined;
  a.integrity = 0;
}
function applyArenaHazard(match: Match, h: ArenaHazard) {
  const a = match.arena;
  const config = hazardFor[a.id];
  for (const f of match.fighters) {
    if (h.affected[f.id] || a.falling[f.id] || f.health <= 0 || Math.abs(f.x - h.x) > hazardRadius(a) || f.y < 535) continue;
    h.affected[f.id] = true;
    // Environmental hits are nonlethal and recorded once per event in the match snapshot.
    f.health = Math.max(1, f.health - (h.kind === "bombardment" ? 14 : config?.damage ?? 10));
    f.setState("hitstun");
    if (h.kind === "fall") {
      beginDescent(match, h.x);
      return;
    } else {
      f.stun = Math.max(f.stun, 12);
      f.vx = (f.x < h.x ? -1 : 1) * (h.kind === "floor" ? 2 : 5);
      f.vy = h.kind === "floor" ? -4 : 0;
    }
  }
}
