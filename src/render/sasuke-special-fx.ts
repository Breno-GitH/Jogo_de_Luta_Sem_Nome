import type { Fighter, Match } from "../engine/combat";
import { curseSpecialContact, winged } from "../engine/sasuke-curse";
import { poseAt } from "../engine/moves";
import {
  isSasukeSpecial,
  sasukeSpecialBalance,
  sasukeSpecialContact,
} from "../engine/sasuke-specials";
import type { Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

export const sasukeEffectsSheet = "sasuke/special-effects.png";

function pixelLine(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  width: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = Math.max(1, Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= length; i++) {
    c.fillRect(
      Math.round(a.x + (dx * i) / length - width / 2),
      Math.round(a.y + (dy * i) / length - width / 2),
      width,
      width,
    );
  }
}
export function sasukeBolt(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  tick: number,
  width = 2,
  spread = 8,
  curse = false,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  if (length < 1) return;
  const n = Math.max(3, Math.ceil(length / 17));
  const path = [a];
  for (let i = 1; i < n; i++) {
    const s = (((i * 23 + tick * 17) % 19) / 9 - 1) * spread;
    path.push({
      x: a.x + (dx * i) / n - (dy * s) / length,
      y: a.y + (dy * i) / n + (dx * s) / length,
    });
  }
  path.push(b);
  for (const [color, weight] of [
    [curse ? "#140f1f" : "#253baf", width + 4],
    [curse ? "#583471" : "#61c7ff", width + 1],
    [curse ? "#ddc1ef" : "#eefcff", width],
  ] as const) {
    c.fillStyle = color;
    for (let i = 1; i < path.length; i++)
      pixelLine(c, path[i - 1], path[i], weight);
  }
}
function fork(
  c: CanvasRenderingContext2D,
  center: Point,
  tick: number,
  radius: number,
  count: number,
  curse = false,
) {
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count + tick * 0.32;
    const scale = radius * (0.58 + ((i * 3 + tick * 5) % 7) * 0.07);
    sasukeBolt(
      c,
      center,
      {
        x: center.x + Math.cos(angle) * scale,
        y: center.y + Math.sin(angle) * scale,
      },
      tick + i,
      1,
      4,
      curse,
    );
  }
}
const isLightning = (id: string) =>
  id === "senbon" || id === "eiso" || id === "chidori" || id === "nagashi";

export function drawSasukeTechnique(c: CanvasRenderingContext2D, f: Fighter) {
  const m = f.move;
  if (f.state !== "attack" || !m?.special || !isSasukeSpecial(m.special))
    return;
  const { special: id } = m;
  const curse = winged(f);
  const boltHere: typeof sasukeBolt = (ctx, a, b, tick, width, spread) =>
    sasukeBolt(ctx, a, b, tick, width, spread, curse);
  const forkHere: typeof fork = (ctx, a, tick, radius, count) =>
    fork(ctx, a, tick, radius, count, curse);
  const tick = f.stateFrame,
    age = tick - m.startup;
  const anchor = poseAt(m, tick)?.release;
  if (f.attackPhase === "startup" && anchor) {
    if (isLightning(id)) forkHere(c, anchor, tick, id === "chidori" ? 24 : 16, 5);
    if (id === "serpents") {
      c.fillStyle = "#cab6e2";
      c.fillRect(anchor.x - 5, anchor.y - 4, 9, 2);
      c.fillRect(anchor.x + 4, anchor.y - 6, 2, 6);
    }
    return;
  }
  if (f.attackPhase !== "active" || !anchor) return;
  if (id === "eiso") {
    const [{ a, b }] = curse
      ? curseSpecialContact(id, age, f.facing, f.x, anchor)
      : sasukeSpecialContact(id, age, f.facing, f.x);
    fillPixels(
      c,
      [
        { x: Math.round(a.x), y: a.y - 4 },
        { x: Math.round(b.x) - 9, y: b.y - 9 },
        { x: Math.round(b.x) + 9, y: b.y },
        { x: Math.round(b.x) - 13, y: b.y + 7 },
        { x: Math.round(a.x), y: a.y + 5 },
      ],
      curse ? "#3a234d" : "#2559be",
    );
    boltHere(c, a, b, tick, 3, 4);
    boltHere(
      c,
      { x: a.x + (b.x - a.x) * 0.55, y: a.y },
      { x: b.x - 9, y: b.y - 13 },
      tick,
      1,
      4,
    );
    forkHere(c, a, tick, 14, 4);
  }
  if (id === "chidori") {
    forkHere(c, anchor, tick, curse ? 38 : 30, 8);
    boltHere(c, { x: anchor.x - 36, y: anchor.y + 10 }, anchor, tick, 3, 6);
    for (let i = 0; i < 3; i++) {
      const y = anchor.y + i * 10 - 10;
      boltHere(
        c,
        { x: anchor.x - 44 - i * 7, y: y + 3 },
        { x: anchor.x - 14, y },
        tick + i,
        1,
        2,
      );
    }
  }
  if (id === "senbon") forkHere(c, anchor, tick, 14, 4);
  if (id === "nagashi") {
    const nodes = [
      { x: -51, y: -27 },
      { x: -62, y: -56 },
      { x: -31, y: -94 },
      { x: 5, y: -106 },
      { x: 38, y: -90 },
      { x: 66, y: -53 },
      { x: 53, y: -25 },
      { x: 34, y: -11 },
      { x: -32, y: -14 },
    ].map(p => ({ x: Math.round(p.x * (curse ? 1.3 : 1)), y: p.y }));
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i],
        b = nodes[(i + 1) % nodes.length];
      boltHere(c, a, b, tick + i, i % 2 ? 1 : 2, 7);
      if (i % 2 === 0) boltHere(c, a, { x: a.x * 1.2, y: a.y - 10 }, tick, 1, 5);
    }
  }
}

export function drawSasukeProjectiles(
  c: CanvasRenderingContext2D,
  m: Match,
  sprites: ReadonlyMap<string, HTMLImageElement>,
  debug: boolean,
) {
  const sheet = sprites.get(sasukeEffectsSheet);
  for (const p of m.kiProjectiles) {
    if (!isSasukeSpecial(p.move)) continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    if (p.move === "senbon") {
      if (p.state === "impact") {
        c.globalAlpha *= Math.max(0, 1 - p.impactAge / 10);
        fork(c, { x: 0, y: 0 }, p.impactAge, 12 + p.impactAge, 5, p.curse);
      } else {
        sasukeBolt(c, { x: p.curse ? -40 : -32, y: -2 }, { x: -5, y: 0 }, p.age, 1, 3, p.curse);
        fillPixels(
          c,
          [
            { x: -16, y: -2 },
            { x: 8, y: 0 },
            { x: -12, y: 3 },
          ],
          "#e3f9ff",
        );
      }
    } else if (sheet?.complete) {
      const row = p.move === "goryuka" ? 1 : p.move === "serpents" ? 2 : 0;
      const frame =
        p.state === "impact"
          ? row === 2
            ? Math.min(3, 2 + Math.floor(p.impactAge / 6))
            : 3
          : row === 2
            ? Math.min(2, Math.floor(p.age / 3))
            : Math.floor(p.age / 3) % 4;
      const scale =
        (p.move === "hosenka" ? 0.55 : 1) * (p.curse ? 1.17 : 1) *
        (p.state === "impact" ? 1 + (row === 2 ? 0 : p.impactAge * 0.034) : 1);
      if (p.state === "impact")
        c.globalAlpha *= Math.max(0, 1 - p.impactAge / 11);
      c.drawImage(
        sheet,
        frame * 128,
        row * 96,
        128,
        96,
        -Math.round(92 * scale),
        -Math.round(48 * scale),
        Math.round(128 * scale),
        Math.round(96 * scale),
      );
      if (p.state === "impact" && row !== 2) {
        for (let i = 0; i < 7; i++) {
          const x = (4 + p.impactAge * 2) * Math.cos(i * 2.4),
            y = (3 + p.impactAge * 2.4) * Math.sin(i * 2.4);
          c.fillStyle = i % 2 ? "#ffc145" : "#fff1bd";
          c.fillRect(Math.round(x), Math.round(y), 4, 2);
        }
      }
    }
    if (debug && p.state === "flight") {
      c.strokeStyle = "#ff6464";
      c.strokeRect(
        -p.radius + 0.5,
        -p.radius + 0.5,
        p.radius * 2,
        p.radius * 2,
      );
    }
    c.restore();
  }
}

export function drawSasukeClouds(c: CanvasRenderingContext2D, m: Match) {
  const left = m.sasukeStormUntil - m.combatFrame;
  if (left <= 0) return;
  const age = sasukeSpecialBalance.stormTicks - left;
  const strength = Math.min(1, age / 32, left / 45);
  c.save();
  c.globalAlpha *= strength * 0.77;
  for (let i = 0; i < 7; i++) {
    const x = i * 205 - 110 + Math.round(age / 8);
    const y = 21 + (i % 3) * 13;
    fillPixels(
      c,
      [
        { x: x - 42, y: 0 },
        { x: x + 249, y: 0 },
        { x: x + 286, y: y + 41 },
        { x: x + 224, y: y + 76 },
        { x: x + 141, y: y + 64 },
        { x: x + 113, y: y + 83 },
        { x: x + 31, y: y + 69 },
        { x: x + 19, y: y + 48 },
        { x: x - 38, y: y + 52 },
      ],
      "#27304c",
    );
    fillPixels(
      c,
      [
        { x: x - 25, y: 0 },
        { x: x + 229, y: 0 },
        { x: x + 246, y: y + 29 },
        { x: x + 191, y: y + 43 },
        { x: x + 131, y: y + 39 },
        { x: x + 98, y: y + 55 },
        { x: x + 20, y: y + 43 },
        { x: x - 22, y: y + 29 },
      ],
      "#171d34",
    );
  }
  c.restore();
}
