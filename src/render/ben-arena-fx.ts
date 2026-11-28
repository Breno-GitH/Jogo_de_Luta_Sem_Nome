import type { ArenaState } from "../engine/arenas";
import type { Match } from "../engine/combat";
import { benArea, benEventOrder, benEventSpecs, benVehicleX, type BenArenaEventKind } from "../engine/ben-arena";
import { eventSpec, eventStage, eventTiming, impactAt, isArenaEvent } from "../engine/arena-events";
import { drawArenaSprite as sprite, type EventImages } from "./arena-sprites";
import { drawArena, visibleWorldBounds } from "./arena";

export const benSheets: Record<BenArenaEventKind, string> = {
  "alien-sign": "ben-market-sign", "pressure-pipe": "undertown", "cargo-cart": "ben-market-cart", "alien-overload": "ben-market-generator",
  "smoothie-spill": "ben-smoothie", "smoothy-sign": "ben-smoothy-sign", "patio-collapse": "ben-patio", "delivery-cart": "ben-delivery",
};
export const benEventSheets = [...new Set([...Object.values(benSheets), "ben-lift", "ben-residents"])].map(id => `arenas/events/${id}.png`);
const ease = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function shadow(c: CanvasRenderingContext2D, x: number, y: number, width: number, alpha = .22) {
  c.save(); c.globalAlpha *= alpha; c.fillStyle = "#071319"; c.beginPath(); c.ellipse(x, y, width / 2, 7, 0, 0, Math.PI * 2); c.fill(); c.restore();
}
export function drawBenArenaBackground(c: CanvasRenderingContext2D, a: ArenaState, backgrounds: EventImages, props?: EventImages): boolean {
  if (a.id !== "undertown") return false;
  const market = backgrounds.get("undertown"), surface = backgrounds.get("ben-smoothy"), lift = a.ben?.lift;
  const clean = { ...a, phase: 0 };
  if (!lift) { drawArena(c, clean, benArea(a) === "smoothy" ? surface : market); return true; }
  const t = lift.tick, pan = 520 * ease((t - 28) / 16), b = visibleWorldBounds(c), rising = lift.to === "smoothy";
  c.save(); c.translate(-pan, 0); drawArena(c, clean, lift.from === "market" ? market : surface); c.restore();
  if (t >= 28) {
    c.save(); c.globalAlpha = ease((t - 28) / 16);
    rect(c, "#111d24", b.left, b.top, b.right - b.left, b.bottom - b.top);
    // A continuous masonry shaft sits behind the narrow utility columns.
    // Every seam moves down: the cabin is rising, rather than floating in a void.
    const scroll = (t * (rising ? 12 : -12) % 120 + 120) % 120;
    for (let y = Math.floor(b.top / 120) * 120 - 120 + scroll; y < b.bottom + 120; y += 120) {
      for (let x = Math.floor(b.left / 240) * 240 - 240; x < b.right + 240; x += 240) {
        rect(c, "#1b282e", x + 3, y + 3, 234, 114);
        rect(c, "#26363b", x + 3, y + 3, 234, 3);
        rect(c, "#0c171e", x + 232, y + 6, 4, 108);
        rect(c, "#445052", x + 12, y + 14, 3, 3);
        rect(c, "#445052", x + 221, y + 14, 3, 3);
      }
    }
    for (let row = -4; row < 8; row++) for (const x of [160, 640, 1120]) {
      const y = row * 250 + (t * (rising ? 12 : -12) % 250 + 250) % 250;
      sprite(c, props, "ben-lift", 5, x, y, 510, 270, false, 0, .5);
    }
    for (const x of [235, 1025]) { rect(c, "#0a1018", x, b.top, 20, b.bottom - b.top); rect(c, "#64777b", x + 4, b.top, 5, b.bottom - b.top); }
    c.restore();
  }
  if (t > 108) { c.save(); c.globalAlpha = ease((t - 108) / 48); drawArena(c, { ...clean, ben: { ...a.ben!, area: lift.to } }, rising ? surface : market); c.restore(); }
  return true;
}
/** All moving objects are cosmetic projections of shared event/terrain clocks. */
export function drawBenArenaEvents(c: CanvasRenderingContext2D, a: ArenaState, images?: EventImages, match?: Match) {
  const state = a.ben, event = isArenaEvent(a.hazard) ? a.hazard : undefined;
  const area = benArea(a), lift = state?.lift;
  if (lift) {
    const pan = 520 * ease((lift.tick - 28) / 16), sourceFloor = lift.from === "market" ? 450 : 580;
    const floor = lift.tick < 28 ? sourceFloor : lift.tick < 44 ? sourceFloor + (580 - sourceFloor) * ease((lift.tick - 28) / 16) : 580;
    if (lift.tick < 44) sprite(c, images, "ben-lift", lift.from === "market" ? 2 : 6, 1160 - pan, sourceFloor, 225, 235);
    c.save(); c.globalAlpha = lift.tick < 28 ? ease(lift.tick / 28) : lift.tick > 132 ? 1 - ease((lift.tick - 132) / 24) : 1;
    sprite(c, images, "ben-lift", 4, lift.tick < 44 ? 1160 - pan : 640, floor, lift.tick < 28 ? 250 : 780, 140, false, 0, 0); c.restore();
    c.fillStyle = "#e8eed7"; c.font = "bold 15px monospace"; c.textAlign = "center";
    c.fillText(lift.tick < 28 ? lift.to === "market" ? "ACESSO À CIDADE DE BAIXO" : "ACESSO À SUPERFÍCIE" : lift.tick < 132 ? "ELEVADOR DE MANUTENÇÃO" : lift.to === "market" ? "CIDADE DE BAIXO" : "MR. SMOOTHY", 640, 190);
    return;
  }
  if (state?.used) {
    if (area === "smoothy") sprite(c, images, "ben-lift", 6, 1140, 605, 170, 85);
    if (!match?.cinematicActive && match?.fighters.some(f => f.x > 900)) {
      c.fillStyle = "#111b25cc"; c.fillRect(1000, 310, 250, 38);
      c.fillStyle = "#e8e1b9"; c.font = "bold 10px monospace"; c.textAlign = "center";
      c.fillText(state.cooldown ? "ELEVADOR RETORNANDO…" : area === "smoothy" ? "↓ SEGURAR NO ACESSO: CIDADE DE BAIXO" : "↓ SEGURAR NO ACESSO: MR. SMOOTHY", 1125, 325);
      c.font = "9px monospace"; c.fillText("APROXIME OS DOIS LUTADORES", 1125, 339);
      rect(c, "#d3c17a", 1010, 345, state.accessHold / 36 * 230, 3);
    }
  }
  if (area === "market") {
    if (state?.supports) sprite(c, images, "ben-lift", state.exposed ? 2 : 1, 1160, 450, 225, 235);
    if (state?.exposed && !state.used && !match?.cinematicActive) {
      c.fillStyle = "#e0d7a0"; c.font = "bold 10px monospace"; c.textAlign = "center"; c.fillText("ACESSO EXPOSTO · IMPACTO FORTE", 1110, 245);
    }
  }
  for (const kind of benEventOrder[area]) {
    const spec = benEventSpecs[kind];
    for (const source of spec.sources) {
    const active = event?.kind === kind && event.source.x === source.x && event.stage !== "cooldown", stage = active ? event!.stage : "idle";
    const broken = state?.objects[`${kind}:${source.x}`];
    const detached = ["alien-sign", "smoothy-sign", "patio-collapse"].includes(kind) && ["action", "impact", "aftermath"].includes(stage);
    const frame = detached || broken && !active ? 3 : stage === "preparation" || stage === "idle" ? 0 : stage === "warning" ? 1 : stage === "action" ? 2 : 3;
    const moving = ["cargo-cart", "delivery-cart"].includes(kind), beat = active ? eventStage(a, event!) : undefined;
    if (moving && (!active || !["action", "impact", "aftermath"].includes(stage))) continue;
    let x = source.x;
    if (moving && active) {
      const target = event!.x, p = stage === "action" ? beat!.progress : ["impact", "aftermath"].includes(stage) ? 1 : 0;
      x = benVehicleX(source.x, target, p);
    }
    const w = moving ? kind === "delivery-cart" ? 380 : 360 : kind === "smoothy-sign" ? 104 : 132;
    const h = kind === "smoothy-sign" ? 170 : moving ? 300 : 140;
    if (kind === "smoothy-sign") { rect(c, "#465d65", source.x - 4, source.y + 70, 8, 245); rect(c, "#b2c1c2", source.x - 1, source.y + 70, 2, 245); }
    const removed = frame === 3 && ["alien-sign", "patio-collapse"].includes(kind);
    if (!removed) {
      shadow(c, x, moving ? 580 : source.y + h / 2, w * .72);
      sprite(c, images, benSheets[kind], frame, x, moving ? 580 : source.y, kind === "smoothy-sign" && frame === 3 ? 30 : w, kind === "smoothy-sign" && frame === 3 ? 35 : h, source.x > 640, stage === "action" && !moving ? Math.sin(beat!.progress * Math.PI) * .08 : 0, moving ? 1 : .5);
    } else if (kind === "alien-sign") {
      for (const offset of [-42, 42]) { rect(c, "#151a23", source.x + offset, source.y - 60, 3, 25); rect(c, "#737777", source.x + offset + 1, source.y - 60, 1, 20); }
    }
    }
  }
  for (const item of a.terrain) {
    if (!item.eventKind || !(item.eventKind in benSheets)) continue;
    const sheet = benSheets[item.eventKind as BenArenaEventKind];
    if (item.kind === "slick") {
      c.save(); c.globalAlpha = Math.min(1, item.age / 12, (item.life - item.age) / 100);
      sprite(c, images, sheet, 7, item.x + item.w / 2, 587, item.w, 32); c.restore();
    } else if (["market-wreck", "patio-wreck"].includes(item.kind)) {
      shadow(c, item.x + item.w / 2, 582, item.w); sprite(c, images, sheet, 7, item.x + item.w / 2, 580, item.w, 42);
    }
  }
  if (!event) return;
  const spec = eventSpec(a, event), beat = eventStage(a, event), t = eventTiming(a, event), age = event.age - impactAt(a, event);
  const sheet = benSheets[event.kind as BenArenaEventKind]; if (!sheet) return;
  if (["preparation", "warning", "action"].includes(event.stage)) {
    shadow(c, event.x, 583, spec.radius * 2, .35);
    c.save(); c.fillStyle = area === "market" ? "#d7c67b" : "#e67e9d"; c.font = "bold 11px monospace"; c.textAlign = "center";
    c.fillText(spec.warningLabel, event.x, 557);
    for (const x of [event.x - spec.radius, event.x + spec.radius]) rect(c, c.fillStyle, x, 565, 3, 15);
    c.restore();
  }
  if (event.stage === "action") {
    const p = beat.progress, source = event.source, x = source.x + (event.x - source.x) * p;
    const y = source.y + (580 - source.y) * p * p;
    if (["alien-sign", "smoothy-sign", "patio-collapse"].includes(event.kind)) {
      sprite(c, images, sheet, 4, x, y, 110, 130, source.x > 640, p * (source.x > 640 ? -.7 : .7), .5);
    } else if (event.kind === "alien-overload") {
      // One connected conduit ends at the warned floor zone; cable pieces never fly.
      const end = source.x < 640 ? source.x + 25 : source.x - 25;
      const cableWidth = Math.abs(event.x - end);
      sprite(c, images, sheet, 5, (end + event.x) / 2, 580, cableWidth + 45, 52);
      sprite(c, images, sheet, 4, event.x, 584, 65, 28);
    } else if (!["cargo-cart", "delivery-cart"].includes(event.kind)) for (let n = 0; n < 5; n++) {
      const q = Math.max(0, Math.min(1, p + n * .07));
      sprite(c, images, sheet, event.kind === "pressure-pipe" ? 7 : 4,
        source.x + (event.x - source.x) * q, source.y + (580 - source.y) * q, 28 + n * 13, 35 + n * 13, source.x > 640, 0, .5);
    }
  }
  if (age >= 0 && age < 30) {
    shadow(c, event.x, 583, spec.radius * 2);
    sprite(c, images, sheet, event.kind === "pressure-pipe" ? 7 : 6, event.x, 586, 160 + age, 120);
  }
  if (event.kind === "alien-overload" && event.stage === "aftermath") sprite(c, images, sheet, 6, event.x, 585, 130, 25);
}
