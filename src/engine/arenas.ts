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
  kind: "surge" | "fall";
  x: number;
  phase: "warning" | "active" | "cooldown";
  ticks: number;
  affected: [boolean, boolean];
}
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
}
export function createArena(id: ArenaId = "dojo", mode: ArenaMode = "classico"): ArenaState {
  return { id, mode, tick: 0, integrity: 0, phase: 0, phaseStart: 0, reactionUntil: 0, reactionX: 640, reactionKind: "hit" };
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Advance once before clearing last tick's hits. No random decisions, no decorative particles. */
export function stepArena(match: Match, previousHits: readonly CombatHit[]) {
  const a = match.arena;
  if (match.temporal.active) return; // Dio's time stop freezes the environment too.
  a.tick++;
  if (match.phase !== "fight") return;
  for (const hit of previousHits) {
    if (hit.blocked || hit.damage < 28) continue;
    const victim = match.fighters[hit.victim];
    a.reactionX = Math.round(victim.x);
    a.reactionKind = hit.damage >= 90 ? "super" : "hit";
    a.reactionUntil = a.tick + (hit.damage >= 90 ? 42 : 24);
    if (a.id === "budokai" && a.mode === "caotico" && victim.stun > 0 && victim.y >= 535 &&
        (victim.x <= 68 || victim.x >= 1212)) {
      a.ringOutSeat = victim.id === 0 ? 0 : 1;
      a.reactionKind = "ko";
      victim.health = 0;
      continue;
    }
    if (a.mode !== "classico" && hit.damage >= 45) {
      a.integrity = Math.min(4, a.integrity + 1);
      const threshold = ["uchiha", "dojo", "cairo", "anteiku", "clover"].includes(a.id) ? 3 : 2;
      if (a.integrity >= threshold && a.phase === 0) {
        a.phase = 1;
        a.phaseStart = a.tick;
      }
    }
    if (a.mode !== "caotico" || a.hazard || a.integrity < 2) continue;
    if (a.id === "undertown") a.hazard = { kind: "surge", x: clamp(a.reactionX, 180, 1100), phase: "warning", ticks: 64, affected: [false, false] };
    if (a.id === "enies" || a.id === "godvalley") a.hazard = { kind: "fall", x: clamp(a.reactionX, 180, 1100), phase: "warning", ticks: 90, affected: [false, false] };
  }
  // Cinematics own the combat clock; ambient reactions still observe their hits.
  if (match.cinematicActive || match.capture) return;
  const h = a.hazard;
  if (!h) return;
  if (--h.ticks > 0) {
    if (h.phase === "active") applyArenaHazard(match, h);
    return;
  }
  if (h.phase === "warning") { h.phase = "active"; h.ticks = h.kind === "fall" ? 22 : 16; return; }
  if (h.phase === "active") { h.phase = "cooldown"; h.ticks = 420; return; }
  a.hazard = undefined;
  a.integrity = 0;
}
function applyArenaHazard(match: Match, h: ArenaHazard) {
  for (const f of match.fighters) {
    if (h.affected[f.id] || Math.abs(f.x - h.x) > (h.kind === "fall" ? 65 : 78) || f.y < 535) continue;
    h.affected[f.id] = true;
    // Arena events cannot KO or start a juggle; combat remains the primary source of damage.
    f.health = Math.max(1, f.health - (h.kind === "fall" ? 18 : 12));
    f.setState("hitstun");
    f.stun = Math.max(f.stun, 12);
    f.vx = (f.x < h.x ? -1 : 1) * 5;
    f.vy = 0;
  }
}
