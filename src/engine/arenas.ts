import type { CombatHit, Match } from "./combat";

/** Arena state is part of the deterministic match snapshot. Decoration is not. */
export const arenaIds = ["dojo", "budokai", "cairo", "enies", "uchiha", "anteiku", "undertown", "godvalley", "clover"] as const;
export type ArenaId = typeof arenaIds[number];
export const arenaModes = ["classico", "interativo", "caotico"] as const;
export type ArenaMode = typeof arenaModes[number];
export interface ArenaInfo { id: ArenaId; name: string; origin: string; description: string; hazard: string; }
export const arenas: ArenaInfo[] = [
  { id: "dojo", name: "Dojo do Samurai", origin: "M.S.F.D", description: "Madeira, jardim e alunos em treino", hazard: "Painéis quebráveis" },
  { id: "budokai", name: "Tenkaichi Budokai", origin: "Dragon Ball", description: "Torneio e plateia na Ilha Papaya", hazard: "Ring-out opcional" },
  { id: "cairo", name: "Ruas do Cairo", origin: "JoJo", description: "Cidade do confronto final de Jotaro e DIO", hazard: "Objetos urbanos" },
  { id: "enies", name: "Ponte da Hesitação", origin: "One Piece", description: "Enies Lobby sob o Buster Call", hazard: "Ponte instável" },
  { id: "uchiha", name: "Esconderijo Uchiha", origin: "Naruto", description: "Salão do duelo entre irmãos", hazard: "Teto e colunas" },
  { id: "anteiku", name: "Exterior do Anteiku", origin: "Tokyo Ghoul", description: "Café da 20ª Ala", hazard: "Vitrine quebrável" },
  { id: "undertown", name: "Undertown", origin: "Ben 10", description: "Mercado alienígena sob Bellwood", hazard: "Pane tecnológica" },
  { id: "godvalley", name: "God Valley", origin: "One Piece", description: "Ravina do incidente lendário", hazard: "Colapso rochoso" },
  { id: "clover", name: "Exame dos Cavaleiros Reais", origin: "Black Clover", description: "Campo de cristais", hazard: "Cristais reativos" },
];
export const arenaForCharacter: Record<string, ArenaId> = {
  samurai: "dojo", dio: "cairo", goku: "budokai", luffy: "enies",
  sasuke: "uchiha", kaneki: "anteiku", ben: "undertown", xebec: "godvalley", asta: "clover",
};
export function validArena(id: unknown): id is ArenaId { return typeof id === "string" && arenaIds.includes(id as ArenaId); }
export function validArenaMode(mode: unknown): mode is ArenaMode { return typeof mode === "string" && arenaModes.includes(mode as ArenaMode); }

export interface ArenaHazard {
  kind: "surge" | "fall" | "debris" | "bombardment" | "floor";
  x: number;
  phase: "warning" | "active" | "cooldown";
  ticks: number;
  affected: [boolean, boolean];
}
export interface ArenaFall { kind: "collapse" | "ringout"; tick: number; x: number }
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
}
export function createArena(id: ArenaId = "dojo", mode: ArenaMode = "classico"): ArenaState {
  return { id, mode, tick: 0, integrity: 0, phase: 0, phaseStart: 0, reactionUntil: 0, reactionX: 640, reactionKind: "hit", falling: [null, null], collapsed: [], fallSafeUntil: [0, 0] };
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
  return a.hazard?.kind === "bombardment" ? 90 : hazardFor[a.id]?.radius ?? 65;
}

function advanceFalls(match: Match) {
  const a = match.arena;
  for (const seat of [0, 1] as const) {
    const fall = a.falling[seat];
    if (!fall) continue;
    const fighter = match.fighters[seat];
    fall.tick++;
    fighter.y = 580 + Math.min(230, Math.max(2, Math.round(fall.tick * fall.tick * .42)));
    fighter.vx = fighter.vy = 0;
    if (fall.tick < 27) continue;
    if (fall.kind === "ringout") {
      a.ringOutSeat = seat;
      fighter.health = 0;
    } else {
      const radius = hazardRadius(a);
      fighter.x = clamp(fall.x + (fall.x < 640 ? -1 : 1) * (radius + 44), fighter.stageInset, 1280 - fighter.stageInset);
      fighter.y = 580;
      fighter.stun = Math.max(fighter.stun, 22);
      a.fallSafeUntil[seat] = a.tick + 150;
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
  if (!paused) advanceFalls(match);
  for (const hit of previousHits) {
    if (hit.blocked || hit.damage < 28) continue;
    const victim = match.fighters[hit.victim];
    a.reactionX = Math.round(victim.x);
    a.reactionKind = hit.damage >= 90 ? "super" : "hit";
    a.reactionUntil = a.tick + (hit.damage >= 90 ? 42 : 24);
    if (!paused && a.id === "budokai" && a.mode === "caotico" && !a.falling[victim.id] &&
        victim.stun > 0 && victim.y >= 535 && (victim.x <= 68 || victim.x >= 1212)) {
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
    if (a.mode !== "caotico" || a.hazard || a.integrity < 2 || paused) continue;
    const config = hazardFor[a.id];
    if (config) {
      const kind = a.id === "enies" && a.phase >= 3 && a.tick % 2 === 0 ? "bombardment" : config.kind;
      a.hazard = { kind, x: clamp(a.reactionX, 180, 1100), phase: "warning", ticks: kind === "bombardment" ? 100 : config.warning, affected: [false, false] };
    }
  }
  if (paused) return;
  if (a.collapsed.length && (!a.hazard || a.hazard.phase === "cooldown")) for (const f of match.fighters) {
    if (a.falling[f.id] || a.fallSafeUntil[f.id] > a.tick || f.y < 535 || f.health <= 0) continue;
    const hole = a.collapsed.find(x => Math.abs(f.x - x) <= 44);
    if (hole === undefined) continue;
    a.falling[f.id] = { kind: "collapse", tick: 0, x: hole };
    f.health = Math.max(1, f.health - 12);
    f.setState("hitstun");
    f.stun = Math.max(f.stun, 36);
    f.vx = f.vy = 0;
  }
  const h = a.hazard;
  if (!h) return;
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
    if (h.affected[f.id] || a.falling[f.id] || Math.abs(f.x - h.x) > hazardRadius(a) || f.y < 535) continue;
    h.affected[f.id] = true;
    // Environmental hits are nonlethal and recorded once per event in the match snapshot.
    f.health = Math.max(1, f.health - (h.kind === "bombardment" ? 14 : config?.damage ?? 10));
    f.setState("hitstun");
    if (h.kind === "fall") {
      a.falling[f.id] = { kind: "collapse", tick: 0, x: f.x };
      f.stun = Math.max(f.stun, 36);
      f.vx = f.vy = 0;
    } else {
      f.stun = Math.max(f.stun, 12);
      f.vx = (f.x < h.x ? -1 : 1) * (h.kind === "floor" ? 2 : 5);
      f.vy = h.kind === "floor" ? -4 : 0;
    }
  }
}
