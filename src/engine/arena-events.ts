import type { ArenaId, ArenaState } from "./arenas";
import type { Match } from "./combat";
import { overlaps, type Point, type Rect } from "./types";
import { dojoRoom, dojoRoomProfiles } from "./arena-rooms";
import { benEventSpec, benVehicleX, type BenArenaEventKind } from "./ben-arena";

export type ArenaEventKind = "buster-call" | "storm" | "canyon-shock" | "car-crash" | "column-collapse" | "timber-break" | "ring-fracture" | "mana-fracture" | BenArenaEventKind;
export type ArenaEventStage = "preparation" | "warning" | "action" | "impact" | "aftermath" | "cooldown";
export type ArenaEventVariant = "primary" | "transformation";
export interface EventTiming { preparation: number; warning: number; action: number; impact: number; aftermath: number; cooldown: number }
export interface ArenaEventSpec {
  kind: ArenaEventKind; label: string; warningLabel: string; timing: EventTiming;
  radius: number; damage: number; sources: readonly Point[]; lanes: readonly number[];
}
export interface ArenaEventState {
  kind: ArenaEventKind; variant: ArenaEventVariant;
  phase: "warning" | "active" | "cooldown";
  stage: ArenaEventStage; ticks: number; age: number; serial: number; seed: number;
  source: Point; x: number; y: number;
  affected: boolean[]; residueAffected: boolean[]; consequence: boolean;
}
const timing = (preparation: number, warning: number, action: number, impact: number, aftermath: number, cooldown = 660): EventTiming =>
  ({ preparation, warning, action, impact, aftermath, cooldown });
export const arenaEventSpecs: Record<ArenaId, ArenaEventSpec> = {
  enies: { kind: "buster-call", label: "BUSTER CALL", warningLabel: "CANHÕES APONTADOS", timing: timing(30, 66, 48, 42, 90), radius: 58, damage: 12,
    sources: [{ x: 105, y: 350 }, { x: 1175, y: 350 }], lanes: [370, 910, 640] },
  anteiku: { kind: "storm", label: "TEMPESTADE", warningLabel: "CABO SOB TENSÃO", timing: timing(36, 78, 10, 8, 240, 780), radius: 69, damage: 8,
    sources: [{ x: 252, y: 355 }, { x: 1040, y: 355 }], lanes: [320, 975] },
  godvalley: { kind: "canyon-shock", label: "ABALO NA RAVINA", warningLabel: "PENHASCO CEDENDO", timing: timing(36, 84, 48, 14, 180, 780), radius: 75, damage: 14,
    sources: [{ x: 155, y: 390 }, { x: 1120, y: 390 }], lanes: [355, 925, 640] },
  cairo: { kind: "car-crash", label: "COLISÃO NA RUA", warningLabel: "POSTE INSTÁVEL", timing: timing(24, 72, 54, 12, 240), radius: 65, damage: 10,
    sources: [{ x: 285, y: 580 }, { x: 1020, y: 580 }], lanes: [395, 910] },
  uchiha: { kind: "column-collapse", label: "COLAPSO DO SALÃO", warningLabel: "COLUNA FRATURADA", timing: timing(32, 84, 46, 14, 200, 780), radius: 72, damage: 12,
    sources: [{ x: 245, y: 255 }, { x: 1040, y: 255 }], lanes: [375, 915, 640] },
  dojo: { kind: "timber-break", label: "ESTRUTURA DE MADEIRA", warningLabel: "VIGA ENFRAQUECIDA", timing: timing(32, 78, 44, 12, 190), radius: 62, damage: 8,
    sources: [{ x: 220, y: 280 }, { x: 1060, y: 280 }], lanes: [350, 940] },
  budokai: { kind: "ring-fracture", label: "BORDA DO TORNEIO", warningLabel: "LAJE SOLTANDO", timing: timing(24, 84, 34, 12, 180, 900), radius: 50, damage: 0,
    sources: [{ x: 87, y: 580 }, { x: 1193, y: 580 }], lanes: [96, 1184] },
  undertown: { kind: "alien-overload", label: "PANE NA REDE DE SERVIÇO", warningLabel: "PRESSÃO NA TUBULAÇÃO", timing: timing(30, 78, 22, 14, 300, 780), radius: 72, damage: 10,
    sources: [{ x: 240, y: 355 }, { x: 1010, y: 355 }], lanes: [350, 930, 640] },
  clover: { kind: "mana-fracture", label: "CRISTAL INSTÁVEL", warningLabel: "MANA EM RUPTURA", timing: timing(30, 84, 32, 14, 250, 780), radius: 72, damage: 10,
    sources: [{ x: 260, y: 185 }, { x: 1018, y: 185 }], lanes: [410, 870, 640] },
};
export const eventStages: readonly ArenaEventStage[] = ["preparation", "warning", "action", "impact", "aftermath", "cooldown"];
export function eventSpec(arena: ArenaState, event?: ArenaEventState): ArenaEventSpec {
  return arena.id === "undertown" ? benEventSpec(arena, event?.kind, Math.max(0, (event?.serial ?? arena.eventSerial) - 1)) : arenaEventSpecs[arena.id];
}
export function eventTiming(arena: ArenaState, event: ArenaEventState = arena.hazard as ArenaEventState): EventTiming {
  const t = eventSpec(arena, event).timing;
  return event.variant === "transformation" ? { ...t, warning: t.warning + 30, action: t.action + 18 } : t;
}
export function eventStage(arena: ArenaState, event: ArenaEventState): { stage: ArenaEventStage; tick: number; progress: number } {
  const t = eventTiming(arena, event);
  let tick = event.age;
  for (const stage of eventStages) {
    if (tick < t[stage]) return { stage, tick, progress: tick / t[stage] };
    tick -= t[stage];
  }
  return { stage: "cooldown", tick: t.cooldown, progress: 1 };
}
export function impactAt(arena: ArenaState, event: ArenaEventState): number {
  const t = eventTiming(arena, event); return t.preparation + t.warning + t.action;
}
export function isArenaEvent(value: ArenaState["hazard"]): value is ArenaEventState {
  return !!value && "age" in value;
}
/** Selection never reads fighter position, health, score, seat or input. */
export function createArenaEvent(arena: ArenaState, variant?: ArenaEventVariant): ArenaEventState {
  const serial = ++arena.eventSerial, spec = arena.id === "undertown" ? benEventSpec(arena, undefined, serial - 1) : arenaEventSpecs[arena.id];
  const index = serial - 1, source = spec.sources[index % spec.sources.length];
  const transforms = ["enies", "godvalley", "uchiha", "dojo"].includes(arena.id) && !arena.level && serial % 3 === 0;
  const event: ArenaEventState = {
    kind: spec.kind, variant: variant ?? (transforms ? "transformation" : "primary"),
    source: { ...source }, x: spec.lanes[index % spec.lanes.length], y: 580,
    phase: "warning", stage: "preparation", ticks: 0, age: 0, serial,
    seed: (Math.imul(serial + arena.id.length, 1664525) + 1013904223) >>> 0,
    affected: [], residueAffected: [], consequence: false,
  };
  if (arena.id === "dojo") {
    const room = dojoRoom(arena); event.source.y = dojoRoomProfiles[room].sourceY;
    if (room === "garden") { event.source.x = 300; event.x = 420; }
    if (room === "west") { event.source.x = serial % 2 ? 780 : 1040; event.x = event.source.x - 50; }
  }
  if (arena.level) event.source.y = arena.id === "enies" ? 170 : 90;
  const t = eventTiming(arena, event);
  event.ticks = t.preparation + t.warning + t.action;
  return event;
}
export function forceArenaEvent(arena: ArenaState, variant: ArenaEventVariant = "primary", kind?: ArenaEventKind) {
  arena.hazard = createArenaEvent(arena, variant);
  if (kind && arena.id === "undertown") {
    const h = arena.hazard, spec = benEventSpec(arena, kind);
    h.kind = spec.kind; h.source = { ...spec.sources[0] }; h.x = spec.lanes[0]; h.ticks = impactAt(arena, h);
  }
}
export function eventProjectile(arena: ArenaState, event: ArenaEventState, shot = 0): { x: number; y: number; progress: number; visible: boolean } {
  const t = eventTiming(arena, event), delay = event.kind === "buster-call" ? shot * 13 : 0;
  const flight = (event.age - t.preparation - t.warning - delay) / t.action;
  const p = Math.max(0, Math.min(1, flight)), targetX = event.x + (event.kind === "buster-call" ? (shot - 1) * 66 : 0);
  const arc = event.kind === "buster-call" ? 235 : 35;
  return { x: event.source.x + (targetX - event.source.x) * p,
    y: event.source.y + (event.y - event.source.y) * p - Math.sin(p * Math.PI) * arc,
    progress: p, visible: flight >= 0 && flight <= 1 };
}
export function eventVolumes(arena: ArenaState, event: ArenaEventState): Rect[] {
  const age = event.age - impactAt(arena, event), spec = eventSpec(arena, event);
  if (["cargo-cart", "delivery-cart"].includes(event.kind)) {
    const beat = eventStage(arena, event);
    if (beat.stage !== "action" && beat.stage !== "impact") return [];
    const x = benVehicleX(event.source.x, event.x, beat.stage === "action" ? beat.progress : 1);
    return [{ x: x - spec.radius + 12, y: 405, w: spec.radius * 2 - 24, h: 175 }];
  }
  if (event.kind === "buster-call") return [0, 1, 2].flatMap(shot => age >= shot * 13 && age < shot * 13 + 9 ?
    [{ x: event.x + (shot - 1) * 66 - 45, y: event.y - 85, w: 90, h: 95 }] : []);
  return age >= 0 && age < eventTiming(arena, event).impact && spec.damage ?
    [{ x: event.x - spec.radius, y: event.y - 88, w: spec.radius * 2, h: 98 }] : [];
}
export function residueVolume(arena: ArenaState, event: ArenaEventState): Rect | undefined {
  if (!["storm", "car-crash", "alien-overload"].includes(event.kind) || event.stage !== "aftermath") return;
  return { x: event.x - 66, y: event.y - 13, w: 132, h: 17 };
}
/** One hit per actor and channel; iterable contact history can accommodate future FFA actors. */
export function applyEventContacts(match: Match, event: ArenaEventState) {
  const a = match.arena, spec = eventSpec(a, event), primary = eventVolumes(a, event), residue = residueVolume(a, event);
  for (const actor of match.fighters) {
    if (actor.health <= 0 || actor.invulnerable) continue;
    const body = actor.pushbox();
    const channel = !event.affected[actor.id] && primary.some(box => overlaps(box, body)) ? "primary" :
      residue && !event.residueAffected[actor.id] && overlaps(residue, body) ? "residue" : undefined;
    if (!channel) continue;
    const damage = channel === "primary" ? spec.damage : 3;
    (channel === "primary" ? event.affected : event.residueAffected)[actor.id] = true;
    actor.health = Math.max(1, actor.health - damage);
    actor.setState("hitstun"); actor.stun = Math.max(actor.stun, channel === "primary" ? 12 : 7);
    actor.vx = (["cargo-cart", "delivery-cart"].includes(event.kind) ? event.source.x < 640 ? 1 : -1 : actor.x < event.x ? -1 : 1) * (channel === "primary" ? 3 : 1);
    a.reactionKind = "hit"; a.reactionX = event.x; a.reactionUntil = a.tick + 28;
  }
}
export function advanceEventClock(arena: ArenaState, event: ArenaEventState): boolean {
  const t = eventTiming(arena, event);
  if (++event.age >= Object.values(t).reduce((sum, duration) => sum + duration, 0)) return false;
  const beat = eventStage(arena, event); event.stage = beat.stage;
  event.phase = ["preparation", "warning", "action"].includes(beat.stage) ? "warning" :
    beat.stage === "cooldown" ? "cooldown" : "active";
  if (event.phase === "warning") event.ticks = impactAt(arena, event) - event.age;
  else if (event.phase === "active") event.ticks = impactAt(arena, event) + t.impact + t.aftermath - event.age;
  else event.ticks = t.cooldown - beat.tick;
  return true;
}
