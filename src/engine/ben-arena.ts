import type { ArenaState } from "./arenas";
import type { ArenaEventSpec } from "./arena-events";
import type { CombatHit, Match } from "./combat";
import { neutral } from "./types";
import type { ArenaTerrain } from "./arena-terrain";

export type BenArea = "market" | "smoothy";
export type BenArenaEventKind = "alien-sign" | "pressure-pipe" | "cargo-cart" | "alien-overload" | "smoothie-spill" | "smoothy-sign" | "patio-collapse" | "delivery-cart";
export interface BenLift {
  tick: number; origins: number[]; boarding: number[]; targets: number[]; from: BenArea; to: BenArea;
}
export interface BenArenaState {
  area: BenArea; supports: number; exposed: boolean; pending: boolean; used: boolean;
  lift?: BenLift; liftSerial: number;
  objects: Record<string, boolean>;
  cooldown: number; accessHold: number;
  saved: Partial<Record<BenArea, { terrain: ArenaTerrain[]; phase: number; integrity: number }>>;
}
export const createBenArena = (): BenArenaState => ({ area: "market", supports: 0, exposed: false, pending: false, used: false, liftSerial: 0, objects: {}, cooldown: 0, accessHold: 0, saved: {} });
export const benLiftTicks = 156;
export const benArea = (a: ArenaState): BenArea => a.ben?.area ?? "market";
export const benVehicleX = (sourceX: number, targetX: number, progress: number) => {
  const origin = sourceX < 640 ? -240 : 1520;
  return origin + (targetX - origin) * Math.max(0, Math.min(1, progress));
};
export const benEventOrder: Record<BenArea, readonly BenArenaEventKind[]> = {
  market: ["alien-sign", "pressure-pipe", "cargo-cart", "alien-overload"],
  smoothy: ["smoothie-spill", "smoothy-sign", "patio-collapse", "delivery-cart"],
};
const spec = (kind: BenArenaEventKind, label: string, warningLabel: string, damage: number, radius: number, sources: { x: number; y: number }[], lanes: number[], action = 44, aftermath = 160, cooldown = 840): ArenaEventSpec =>
  ({ kind, label, warningLabel, damage, radius, sources, lanes, timing: { preparation: 30, warning: 84, action, impact: 14, aftermath, cooldown } });
export const benEventSpecs: Record<BenArenaEventKind, ArenaEventSpec> = {
  "alien-sign": spec("alien-sign", "LETREIRO INSTÁVEL", "CABOS SOLTANDO", 10, 74, [{ x: 345, y: 210 }, { x: 925, y: 195 }], [360, 910]),
  "pressure-pipe": spec("pressure-pipe", "PRESSÃO NA REDE", "VÁLVULA EM FALHA", 8, 66, [{ x: 240, y: 420 }, { x: 1040, y: 420 }], [350, 930], 28, 100),
  "cargo-cart": spec("cargo-cart", "CARGA SEM CONTROLE", "VEÍCULO NA VIA", 9, 170, [{ x: 75, y: 555 }, { x: 1205, y: 555 }], [440, 840], 64, 150),
  "alien-overload": spec("alien-overload", "SOBRECARGA DA REDE", "CABO ENERGIZADO", 8, 66, [{ x: 225, y: 440 }, { x: 1055, y: 440 }], [355, 925], 24, 200),
  "smoothie-spill": spec("smoothie-spill", "SMOOTHIE SOB PRESSÃO", "MANGUEIRA ROMPENDO", 0, 90, [{ x: 890, y: 460 }, { x: 390, y: 460 }], [810, 470], 32, 220),
  "smoothy-sign": spec("smoothy-sign", "MASCOTE INSTÁVEL", "SUPORTE DO MASCOTE", 10, 75, [{ x: 135, y: 210 }], [340]),
  "patio-collapse": spec("patio-collapse", "MOBILIÁRIO DA PRAÇA", "GUARDA-SOL CEDENDO", 0, 70, [{ x: 280, y: 485 }, { x: 1000, y: 485 }], [390, 890], 42, 180),
  "delivery-cart": spec("delivery-cart", "ENTREGA ATRAPALHADA", "VEÍCULO NA CALÇADA", 8, 180, [{ x: 80, y: 515 }, { x: 1200, y: 515 }], [410, 870], 68, 160, 1080),
};
export function benEventSpec(a: ArenaState, kind?: string, serial = a.eventSerial): ArenaEventSpec {
  if (kind && kind in benEventSpecs) return benEventSpecs[kind as BenArenaEventKind];
  const order = benEventOrder[benArea(a)];
  for (let n = 0; n < order.length; n++) {
    const candidate = benEventSpecs[order[(serial + n) % order.length]], sources = candidate.sources.filter(p => !a.ben?.objects[`${candidate.kind}:${p.x}`]);
    if (sources.length) return sources.length === candidate.sources.length ? candidate : { ...candidate, sources };
  }
  return benEventSpecs[benArea(a) === "market" ? "pressure-pipe" : "smoothie-spill"];
}
export function beginBenLift(match: Match): boolean {
  const a = match.arena, state = a.ben;
  if (!state || state.cooldown || state.lift || a.mode === "classico" || match.phase !== "fight" || match.cinematicActive || match.capture || match.temporal.active || match.hitstop || match.fighters.some(f => f.health <= 0)) return false;
  const from = state.area, to: BenArea = from === "market" ? "smoothy" : "market";
  state.saved[from] = { terrain: a.terrain, phase: a.phase, integrity: a.integrity };
  state.used = true; state.pending = false; state.liftSerial++;
  const count: number = Number(match.fighters.length), targets = match.fighters.map((_, i) => Math.round(350 + (count === 1 ? 290 : i * 580 / (count - 1))));
  const boarding = match.fighters.map((_, i) => Math.round(1070 + (count === 1 ? 85 : i * 170 / (count - 1))));
  state.lift = { tick: 0, origins: match.fighters.map(f => f.x), boarding, targets, from, to };
  state.accessHold = 0;
  a.hazard = undefined; a.terrain = []; a.supports = [null, null];
  match.projectiles = []; match.kiProjectiles = []; match.beams = [];
  for (const f of match.fighters) {
    if (f.omnitrix) f.omnitrix.objects = [];
    f.setState("walk"); f.vx = f.vy = 0; f.stun = 0; f.hitLaunch = false; f.knockedDown = false; f.buffer.clear();
  }
  return true;
}
/** Array-based choreography preserves resources and supports future larger fighter collections. */
export function stepBenArena(match: Match, hits: readonly CombatHit[]): boolean {
  const a = match.arena, state = a.ben; if (!state) return false;
  if (state.lift) {
    if (match.cinematicActive || match.capture || match.hitstop) return false;
    const lift = state.lift; lift.tick++;
    const ease = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
    match.fighters.forEach((f, i) => {
      f.x = Math.round(lift.tick < 28 ? lift.origins[i] + (lift.boarding[i] - lift.origins[i]) * ease(lift.tick / 28) :
        lift.tick < 44 ? lift.boarding[i] - 520 * ease((lift.tick - 28) / 16) :
        lift.boarding[i] - 520 + (lift.targets[i] - lift.boarding[i] + 520) * ease((lift.tick - 132) / 24));
      const depth = lift.from === "market" ? 130 : 0;
      f.y = Math.round(lift.tick < 28 ? 580 - depth * ease(lift.tick / 28) : lift.tick < 44 ? 580 - depth + depth * ease((lift.tick - 28) / 16) : 580);
      f.vx = f.vy = 0; f.stateFrame++;
    });
    if (lift.tick >= benLiftTicks) {
      state.area = lift.to; state.lift = undefined; state.cooldown = 180;
      const saved = state.saved[state.area]; a.terrain = saved?.terrain ?? []; a.phase = saved?.phase ?? 0; a.integrity = saved?.integrity ?? 0;
      a.phaseStart = a.tick; a.nextEventAt = a.eventClock + 360;
      for (const f of match.fighters) { f.setState("idle"); f.input = neutral(); f.buffer.clear(); }
    }
    return true;
  }
  if (a.mode === "classico") return false;
  if (state.cooldown && !match.cinematicActive && !match.capture && !match.hitstop) state.cooldown--;
  if (state.used) {
    const ready = !state.cooldown && !match.cinematicActive && !match.capture && !match.hitstop && match.fighters.every(f => f.health > 0 && f.x >= 780 && f.y === 580 && ["idle", "walk", "crouch"].includes(f.state));
    const holding = ready && match.fighters.some(f => Math.abs(f.x - 1140) <= 95 && f.input.down);
    state.accessHold = holding ? state.accessHold + 1 : 0;
    return state.accessHold >= 36 && beginBenLift(match);
  }
  if (state.area !== "market") return false;
  for (const hit of hits) {
    if (hit.blocked || hit.damage < 45 || Math.abs(match.fighters[hit.victim].x - 1050) > 185) continue;
    if (state.exposed) state.pending = true;
    else { state.supports = Math.min(3, state.supports + 1); state.exposed = state.supports >= 3; }
  }
  return state.pending && beginBenLift(match);
}
