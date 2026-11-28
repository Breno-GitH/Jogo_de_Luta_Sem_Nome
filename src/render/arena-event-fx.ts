import { drawArenaSprite as sprite, type EventImages } from "./arena-sprites";
import { drawBenArenaEvents, benEventSheets } from "./ben-arena-fx";
import type { ArenaId, ArenaState } from "../engine/arenas";
import { arenaIds } from "../engine/arenas";
import { arenaEventSpecs, eventProjectile, eventStage, eventTiming, impactAt, isArenaEvent, type ArenaEventState } from "../engine/arena-events";
import type { Match } from "../engine/combat";
import type { Point } from "../engine/types";
import { ringBounds } from "../engine/arena-terrain";
import { dojoRoom, dojoRoomProfiles } from "../engine/arena-rooms";

export const arenaEventSheets = [...arenaIds.map(id => `arenas/events/${id}.png`), ...benEventSheets];
export type { EventImages } from "./arena-sprites";
const px = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
 c.fillStyle=color; c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const random=(seed:number,index:number)=>((Math.imul(seed^Math.imul(index+1,374761393),1664525)+1013904223)>>>0)/4294967296;
function pixelLine(c: CanvasRenderingContext2D, a: Point, b: Point, size: number, color: string) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 3));
  for (let i = 0; i <= steps; i++) px(c, color, Math.round((a.x + (b.x - a.x) * i / steps) / 2) * 2,
    Math.round((a.y + (b.y - a.y) * i / steps) / 2) * 2, size, size);
}
function lightning(c: CanvasRenderingContext2D, start: Point, end: Point, seed: number, palette: [string, string], branches = 5) {
  const points = [start];
  for (let n = 1; n < 11; n++) points.push({ x: start.x + (end.x - start.x) * n / 11 + (random(seed, n) - .5) * 48,
    y: start.y + (end.y - start.y) * n / 11 });
  points.push(end);
  for (let n = 1; n < points.length; n++) {
    pixelLine(c, points[n - 1], points[n], 6, palette[0]); pixelLine(c, points[n - 1], points[n], 2, palette[1]);
  }
  for (let n = 0; n < branches; n++) {
    const p = points[2 + n % 7], q = { x: p.x + (random(seed, n + 30) - .5) * 140, y: p.y + 35 + n * 9 };
    const middle = { x: q.x + (n % 2 ? 22 : -22), y: (p.y + q.y) / 2 };
    pixelLine(c, p, middle, 3, palette[0]); pixelLine(c, middle, q, 2, palette[1]);
  }
}
function debris(c: CanvasRenderingContext2D, event: ArenaEventState, age: number, colors: string[], paper = false) {
  for (let n = 0; n < (paper ? 26 : 22); n++) {
    const drift = (random(event.seed, n) - .5) * 6, speed = 2 + random(event.seed, n + 30) * 4;
    const x = event.x + drift * age, y = 575 - speed * age + age * age * .14;
    if (y > 595 || age > 54) continue;
    px(c, colors[n % colors.length], x, y, paper && n % 3 ? 10 : 4 + n % 3 * 3, paper ? 2 : 4 + n % 2 * 3);
  }
}
function marker(c: CanvasRenderingContext2D, a: ArenaState, event: ArenaEventState) {
  const spec = arenaEventSpecs[a.id];
  const radius = event.kind === "buster-call" ? 111 : spec.radius;
  if (["cooldown", "aftermath"].includes(event.stage)) return;
  const color = event.kind === "storm" ? "#c0e6ff" : event.kind === "alien-overload" ? "#97f48b" : event.kind === "mana-fracture" ? "#9fe7ff" : "#f4c881";
  const alpha = event.stage === "impact" ? .7 : .3 + (Math.floor(event.age / 9) % 2) * .25;
  c.save(); c.globalAlpha = alpha;
  px(c, "#101926", event.x - radius, event.y + 2, radius * 2, 7);
  for (let x = event.x - radius; x < event.x + radius; x += 18) px(c, color, x, event.y + 3, 10, 3);
  for (const side of [-1, 1]) {
    px(c, color, event.x + side * radius - 2, event.y - 14, 4, 18);
    px(c, color, event.x + side * radius - (side > 0 ? 10 : 0), event.y - 14, 12, 3);
  }
  c.globalAlpha = 1; c.fillStyle = color; c.font = "bold 11px monospace"; c.textAlign = "center";
  c.fillText(a.id === "dojo" ? dojoRoomProfiles[dojoRoom(a)].warning : event.variant === "transformation" && ["enies", "godvalley"].includes(a.id) ? "SUPORTE CEDENDO" : spec.warningLabel, event.x, event.y - 23);
  c.restore();
}
function eventTerrain(c: CanvasRenderingContext2D, a: ArenaState, images?: EventImages) {
  for (const item of a.terrain) {
    c.save();
    if (item.life && item.life - item.age < 90) c.globalAlpha = .45 + Math.floor(item.age / 8) % 2 * .45;
    if (item.kind === "lamp") sprite(c, images, "cairo", 6, item.x + item.w / 2, item.y, item.w, 34);
    else if (item.kind === "beam") sprite(c, images, "dojo", 7, item.x + item.w / 2, item.y, item.w, 35);
    else if (item.kind === "rubble") sprite(c, images, a.id, 7, item.x + item.w / 2, item.y, item.w, item.h);
    else if (item.kind === "crystal") {
      const phase = Math.min(1, item.age / 36);
      c.globalAlpha *= phase; sprite(c, images, "clover", item.age < 36 ? 4 : 5, item.x + item.w / 2, item.y, item.w, 74, false, 0, 0);
      px(c, "#d2f9f2", item.x + 5, item.y, item.w - 10, 2);
    } else if (item.kind === "wood-floor") {
      px(c, "#1a1917", item.x, item.y + 1, item.w, item.h + 5);
      sprite(c, images, "dojo", 5, item.x + item.w / 2, item.y + item.h + 4, item.w, 48);
      px(c, "#b47f46", item.x, item.y + item.h, item.w, 3);
    } else if (item.kind === "ring-edge") {
      px(c, "#263642", item.x, 583, item.w, 35);
      sprite(c, images, "budokai", 7, item.x + item.w / 2, 623, item.w, 25);
    } else if (item.kind === "roof") sprite(c, images, "uchiha", 5, 640, 190, 520, 140);
    c.restore();
  }
}
function storm(c: CanvasRenderingContext2D, a: ArenaState, event: ArenaEventState | undefined, images?: EventImages) {
  const intensity = event && !["cooldown"].includes(event.stage) ? .75 : .26 + Math.sin(a.tick / 260) * .1;
  c.fillStyle = `rgba(10,19,42,${intensity * .12})`; c.fillRect(-300, 0, 1880, 580);
  for (let n = 0; n < Math.floor(32 + intensity * 95); n++) {
    const x = (n * 137 + a.tick * 3) % 1480 - 100, y = (n * 71 + a.tick * 8) % 610;
    px(c, n % 3 ? "#a4b9d06a" : "#c3d6e484", x, y, 1, 6 + n % 4);
    if (y > 572) px(c, "#c1d8e499", x - 3, 583 + n % 13, 6, 1);
  }
  if (!event) return;
  const beat = eventStage(a, event), pulse = event.stage === "impact" && beat.tick < 4;
  sprite(c, images, "anteiku", event.stage === "impact" ? 2 : event.stage === "aftermath" ? 3 : event.stage === "action" ? 1 : 0,
    event.source.x, 494, 150, 260);
  if (pulse || event.stage === "action") {
    lightning(c, { x: event.source.x - 45, y: 18 }, event.source, event.seed + Math.floor(event.age / 2), ["#6399d8", "#effbff"], 5);
    c.fillStyle = `rgba(210,233,255,${pulse ? .12 : .045})`; c.fillRect(-300, 0, 1880, 625);
    px(c, "#d8edff33", event.x - 110, 585, 220, 30);
    if (pulse) lightning(c, event.source, { x: event.x, y: 580 }, event.seed + 7, ["#739dc5", "#eaf8ff"], 2);
  }
  if (event.stage === "aftermath") {
    sprite(c, images, "anteiku", 7, event.x, 591, 144, 31);
    if (Math.floor(event.age / 4) % 3) lightning(c, { x: event.source.x, y: 490 }, { x: event.x, y: 577 }, event.seed + (event.age >> 2), ["#77a2d5", "#effbff"], 1);
  }
}
function idleSource(c: CanvasRenderingContext2D, a: ArenaState, source: Point, images?: EventImages) {
  const flip = source.x > 640;
  switch (a.id) {
    case "enies": sprite(c, images, a.id, 0, source.x + (flip ? 76 : -76), source.y + 80, 194, 180, flip); break;
    case "anteiku": sprite(c, images, a.id, 0, source.x, 494, 150, 260); break;
    case "godvalley": sprite(c, images, a.id, 0, source.x, 580, 220, 420, flip); break;
    case "cairo": sprite(c, images, a.id, 4, source.x, 580, 83, 210, flip); break;
    case "uchiha": sprite(c, images, a.id, 0, source.x, 573, 135, 310, flip); break;
    case "dojo": break; // Existing full-size room architecture is the source; no miniature shoji props.
    case "undertown": sprite(c, images, a.id, 0, source.x, 460, 112, 141); break;
    case "clover": sprite(c, images, a.id, 0, source.x, source.y + 60, 88, 132); break;
  }
}
/** Environment animation is read-only; all contact rectangles come from arena-events.ts. */
export function drawArenaEvents(c: CanvasRenderingContext2D, a: ArenaState, match?: Match, images?: EventImages) {
  const event = isArenaEvent(a.hazard) ? a.hazard : undefined;
  c.save(); c.imageSmoothingEnabled = false;
  eventTerrain(c, a, images);
  if (a.id === "undertown") { drawBenArenaEvents(c, a, images, match); c.restore(); return; }
  if (a.id === "anteiku") storm(c, a, event, images);
  for (const source of arenaEventSpecs[a.id].sources) {
    if (event?.source.x === source.x) continue;
    idleSource(c, a, a.level ? { ...source, y: a.id === "enies" ? 170 : 90 } : source, images);
  }
  if (!event) {
    // Small distant activity remains cosmetic in Classic, without colliders or terrain writes.
    const frame = Math.floor(a.tick / 15) % 4;
    if (a.id === "budokai") sprite(c, images, a.id, a.tick < a.reactionUntil ? 5 : 4, 242 + (frame % 2), 473, 38, 56);
    c.restore(); return;
  }
  const beat = eventStage(a, event), action = event.stage === "action", impact = event.stage === "impact";
  const after = event.stage === "aftermath", calm = event.stage === "cooldown";
  const progress = action ? beat.progress : impact || after || calm ? 1 : 0;
  const age = event.age - impactAt(a, event);
  const sourceFrame = event.stage === "preparation" ? 0 : event.stage === "warning" ? 1 : action ? 2 : 3;
  if (!calm) marker(c, a, event);
  switch (event.kind) {
    case "buster-call": {
      const flip = event.source.x > 640;
      const t = eventTiming(a, event);
      const firing = event.age - t.preparation - t.warning;
      const muzzle = firing >= 0 && firing <= 30 && firing % 13 < 4;
      sprite(c, images, a.id, calm ? 0 : action ? muzzle ? 2 : 3 : sourceFrame, event.source.x + (flip ? 76 : -76), event.source.y + 80, 194, 180, flip);
      for (let shot = 0; shot < 3; shot++) {
        const shell = eventProjectile(a, event, shot);
        if (shell.visible) {
          for (let n = 1; n <= 7; n++) {
            const sample = { ...event, age: event.age - n * 2 }, trail = eventProjectile(a, sample, shot);
            if (trail.visible) px(c, ["#949ca3a0", "#d4d2c289", "#707b8790"][n % 3], trail.x - n, trail.y, 3 + n, 3 + n);
          }
          sprite(c, images, a.id, 4 + Math.floor((event.age - t.preparation - t.warning) / 4) % 2, shell.x, shell.y, 23, 23, false, shell.progress * 8, .5);
        }
        const hitAge = age - shot * 13;
        if (hitAge >= 0 && hitAge < 20) {
          sprite(c, images, a.id, 6, event.x + (shot - 1) * 66, 587, 110 + hitAge * 2, 105);
          debris(c, { ...event, x: event.x + (shot - 1) * 66 }, hitAge, ["#eee2ca", "#9fabb9", "#66758c"]);
        }
      }
      if (event.variant === "transformation" && !calm) sprite(c, images, a.id, 7, event.x, 642, 160, 150);
      break;
    }
    case "storm": break;
    case "canyon-shock":
      if (!calm) {
        sprite(c, images, a.id, sourceFrame, event.source.x, 580, 220, 420, event.source.x > 640);
        if (action) { const rock = eventProjectile(a, event); sprite(c, images, a.id, 4, rock.x, rock.y, 140, 135, false, progress * 1.3, .5); }
        if (impact || after && age < 46) { sprite(c, images, a.id, 6, event.x, 588, 180 + Math.min(age, 45), 120); debris(c, event, age, ["#8f7562", "#c7ac81", "#555367"]); }
        if (event.stage === "preparation") {
          c.strokeStyle = "#e0ddc18a"; c.lineWidth = 3; c.beginPath(); c.ellipse(640, 245, 60 + event.age * 7, 20 + event.age * 2, 0, 0, Math.PI * 2); c.stroke();
        }
      }
      break;
    case "car-crash": {
      const direction = event.source.x < 640 ? 1 : -1;
      const distance = event.stage === "preparation" ? 430 - beat.progress * 250 : event.stage === "warning" ? 180 - beat.progress * 60 : action ? 120 * (1 - progress) : 0;
      const carX = event.source.x - direction * distance;
      if (!calm) {
        sprite(c, images, a.id, impact || after ? 3 : action ? progress < .85 ? 1 : 2 : 0, carX, 542, 188, 84, direction < 0, action ? Math.sin(progress * Math.PI) * .06 : 0);
        if (!after && !impact) sprite(c, images, a.id, 4, event.source.x, 580, 83, 210, direction < 0, progress * direction * 1.35);
        if (action) for (let n = 0; n < 8; n++) px(c, "#c7b69288", carX - direction * (n * 10 + 40), 540 - n % 3 * 4, 12, 4);
        if (impact) debris(c, event, age, ["#b7a48b", "#667183", "#d4c298"]);
        if (after) { lightning(c, { x: event.source.x, y: 565 }, { x: event.x, y: 584 }, event.seed + (event.age >> 2), ["#e2b76a", "#f7ecd0"], 1); }
      }
      break;
    }
    case "column-collapse":
      if (!calm) {
        sprite(c, images, a.id, sourceFrame, event.source.x, 573, 135, 310, event.source.x > 640);
        if (action) { const block = eventProjectile(a, event); sprite(c, images, a.id, 4, block.x, block.y, 130, 95, false, progress * .8, .5); }
        if (impact || after && age < 45) { sprite(c, images, a.id, 6, event.x, 587, 190, 95); debris(c, event, age, ["#8c8d75", "#b2b39a", "#3c4a4c"]); }
      }
      break;
    case "timber-break":
      if (!calm) {
        if (event.stage !== "preparation") {
          const x = event.source.x, y = event.source.y;
          pixelLine(c, { x: x - 30, y: y - 7 }, { x: x + 2, y: y + 8 }, 3, "#291c14");
          pixelLine(c, { x: x + 2, y: y + 8 }, { x: x + 27, y: y + 3 }, 2, "#291c14");
          if (action) for (let n = 0; n < 8; n++) px(c, "#d3a16a", x + (n - 4) * 11, y + n * 9 + progress * 60, 4, 2);
        }
        if (action) { const timber = eventProjectile(a, event); sprite(c, images, a.id, 7, timber.x, timber.y, 150, 65, false, progress * .9, .5); }
        if (impact || after && age < 45) debris(c, event, age, ["#dba660", "#f0e1ba", "#6a3626"], true);
      }
      break;
    case "ring-fracture":
      if (!calm && !after) sprite(c, images, a.id, action ? 2 : impact ? 3 : sourceFrame, event.x, 600 + (impact ? Math.min(85, age * age * .4) : 0), 130, 80, event.x > 640, action ? progress * .18 : 0);
      sprite(c, images, a.id, calm ? 4 : 5, 240 + (calm ? 0 : Math.min(90, event.age)), 473, 38, 56, !calm);
      if (impact) debris(c, event, age, ["#dcd8c6", "#8f95a6", "#bbb7a8"]);
      break;
    case "alien-overload":
      sprite(c, images, a.id, calm ? 3 : sourceFrame, event.source.x, 460, 112, 141);
      pixelLine(c, { x: event.source.x, y: 452 }, { x: event.x, y: 552 }, 5, "#252e2d");
      px(c, "#6d7871", event.x - 24, 577, 48, 5);
      for (let n = 0; n < 6; n++) px(c, "#172321", event.x - 20 + n * 7, 578, 3, 3);
      if (action || impact) {
        sprite(c, images, a.id, 7, event.x, 581, 135, 95 + (action ? progress * 60 : 60));
        lightning(c, event.source, { x: event.source.x + 23, y: event.source.y + 32 }, event.seed + (event.age >> 2), ["#a4a56c", "#e4dc9a"], 1);
      }
      if (impact) debris(c, event, age, ["#a4ada4", "#d4d7c7", "#626e68"]);
      break;
    case "mana-fracture": {
      const anti = match?.fighters.some(f => f.asta && f.state === "attack" && Math.abs(f.x - event.source.x) < 280);
      c.save(); if (anti) c.globalAlpha = .48;
      sprite(c, images, a.id, calm ? 0 : sourceFrame, event.source.x, event.source.y + 60, 88, 132);
      if (action) {
        const mana = eventProjectile(a, event); sprite(c, images, a.id, 6, mana.x, mana.y, 85, 90, false, progress * 2, .5);
        for (let n = 0; n < 12; n++) px(c, "#b6eff5b0", mana.x - n * 4, mana.y + Math.sin(n + event.age / 5) * 13, 3, 5);
      }
      if (impact) { sprite(c, images, a.id, 7, event.x, 587, 155, 130); debris(c, event, age, ["#a1d9e9", "#ecfbef", "#5484ad"]); }
      c.restore(); break;
    }
  }
  if (a.id === "budokai" && a.mode !== "classico") for (const x of ringBounds(a)) px(c, "#eec884", x - 2, 573, 4, 11);
  c.restore();
}
