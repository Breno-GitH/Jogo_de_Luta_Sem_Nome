import type { Fighter, Match } from "../engine/combat";
import { curseSpecialContact, winged } from "../engine/sasuke-curse";
import { poseAt } from "../engine/moves";
import {
  isSasukeSpecial,
  sasukeSpecialContact,
} from "../engine/sasuke-specials";
import type { KiProjectile } from "../engine/goku-specials";
import {
  fireDragonPoint,
  fireDragonVolumes,
  nagashiVolumes,
  sasukePolish,
  sasukePolishArt,
} from "../engine/sasuke-polish";
import { drawCombatDebug } from "./debug";
import type { Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

export const sasukeEffectsSheet = "sasuke/special-effects.png";
export const goryukaHeadSheet = "sasuke/goryuka-heads.png";

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
const isLightning = (id: string) => id === "senbon" || id === "eiso";

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
  if (id === "chidori" && anchor) return drawChidori(c, f, anchor, curse);
  if (id === "nagashi") return drawNagashi(c, f, curse);
  if (f.attackPhase === "startup" && anchor) {
    if (isLightning(id)) forkHere(c, anchor, tick, 16, 5);
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
  if (id === "senbon") forkHere(c, anchor, tick, 14, 4);
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
    if (p.wave) {
      drawFireDragon(c, p, sprites.get(goryukaHeadSheet), debug);
      continue;
    }
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    if (p.move === "senbon") {
      if (p.state === "impact") {
        c.globalAlpha *= Math.max(0, 1 - p.impactAge / 10);
        fork(c, { x: 0, y: 0 }, p.impactAge, 12 + p.impactAge, 5, p.curse);
      } else {
        sasukeBolt(
          c,
          { x: p.curse ? -40 : -32, y: -2 },
          { x: -5, y: 0 },
          p.age,
          1,
          3,
          p.curse,
        );
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
      const row = p.move === "serpents" ? 2 : 0;
      const frame =
        p.state === "impact"
          ? row === 2
            ? Math.min(3, 2 + Math.floor(p.impactAge / 6))
            : 3
          : row === 2
            ? Math.min(2, Math.floor(p.age / 3))
            : Math.floor(p.age / 3) % 4;
      const scale =
        (p.move === "hosenka" ? 0.55 : 1) *
        (p.curse ? 1.17 : 1) *
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

function drawChidori(
  c: CanvasRenderingContext2D,
  f: Fighter,
  anchor: Point,
  cursed: boolean,
) {
  const m = f.move!,
    tick = f.stateFrame;
  const ending = tick - m.startup - m.active;
  if (ending > 6) return;
  const driving = Math.abs(f.vx) >= 6 && ending < 0;
  const power = Math.min(1, (tick + 2) / 11);
  c.save();
  c.globalAlpha *= ending < 0 ? 1 : 1 - ending / 7;
  const x = anchor.x,
    y = anchor.y;
  c.save();
  c.globalAlpha *= power * 0.27;
  fillPixels(
    c,
    [
      { x: x - 42, y: y - 16 },
      { x: x + 4, y: y - 28 },
      { x: x + 31, y: y - 2 },
      { x: x + 14, y: y + 23 },
      { x: x - 39, y: y + 13 },
    ],
    cursed ? "#8f5be3" : "#47c9ff",
  );
  c.restore();
  fork(c, anchor, tick, (cursed ? 42 : 35) * power, driving ? 9 : 6, cursed);
  sasukeBolt(c, { x: x - 22, y: y - 4 }, anchor, tick, 3, 7, cursed);
  if (driving) {
    for (let i = 0; i < 6; i++) {
      const y = -31 - i * 13;
      const left = -42 - ((i * 17 + tick * 13) % 78);
      fillPixels(
        c,
        [
          { x: left - 33, y: y + 3 },
          { x: left + 17, y: y - 2 },
          { x: left + 29, y: y },
          { x: left + 9, y: y + 3 },
        ],
        cursed ? "#9263cb" : "#74c9ef",
      );
      if (i % 2 === 0)
        sasukeBolt(
          c,
          { x: left - 26, y: y + 4 },
          { x: left + 19, y },
          tick + i,
          1,
          4,
          cursed,
        );
    }
    sasukeBolt(c, { x: x - 61, y: y + 12 }, anchor, tick, 2, 8, cursed);
  }
  c.restore();
}

function drawNagashi(c: CanvasRenderingContext2D, f: Fighter, cursed: boolean) {
  const m = f.move!,
    age = f.stateFrame - m.startup;
  const decay = age - m.active;
  if (age < -5 || decay >= 8) return;
  c.save();
  c.globalAlpha *=
    age < 0 ? 0.31 + (age + 5) * 0.07 : decay < 0 ? 1 : 1 - decay / 8;
  for (const [i, { a, b, r }] of nagashiVolumes(age, cursed).entries()) {
    const tick = f.stateFrame + i * 5;
    const reach = Math.sign(b.x);
    const branch = { x: a.x + (b.x - a.x) * 0.63, y: a.y + (b.y - a.y) * 0.61 };
    sasukeBolt(c, a, b, tick, 3, 9, cursed);
    sasukeBolt(
      c,
      branch,
      { x: b.x + reach * (r - 5), y: b.y + (i % 2 ? -r + 3 : r - 4) },
      tick + 3,
      1,
      6,
      cursed,
    );
    if (age >= 0)
      sasukeBolt(
        c,
        branch,
        { x: branch.x + reach * 20, y: branch.y - 25 },
        tick + 9,
        1,
        7,
        cursed,
      );
  }
  for (const side of [-1, 1])
    sasukeBolt(
      c,
      { x: 12 * side, y: -8 },
      { x: (cursed ? 88 : 71) * side, y: -3 },
      f.stateFrame + side,
      2,
      4,
      cursed,
    );
  c.restore();
}

function fireRibbon(c: CanvasRenderingContext2D, p: KiProjectile) {
  const w = p.wave!,
    cap = Math.min(w.distance, sasukePolish.goryuka.bodyLength);
  if (cap < 3) return;
  const step = 8,
    count = Math.ceil(cap / step);
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const lag = Math.min(cap, i * step);
    const at = w.distance - lag;
    const pt = fireDragonPoint(w, at);
    const tail = fireDragonPoint(w, at - 4),
      fore = fireDragonPoint(w, at + 4);
    const dx = fore.x - tail.x,
      dy = fore.y - tail.y,
      length = Math.hypot(dx, dy) || 1;
    const fade = 1 - lag / sasukePolish.goryuka.bodyLength;
    return { ...pt, nx: -dy / length, ny: dx / length, fade, lag };
  });
  for (const [scale, color] of [
    [1.0, "#71231c"],
    [0.8, "#e94d17"],
    [0.51, "#ff9f25"],
    [0.23, "#fff18b"],
  ] as const) {
    const edge = (side: number) =>
      path.map((pt, i) => {
        const tremor = (3 + 3 * Math.sin(i * 2.29 - p.age * 0.67)) * pt.fade;
        const width = side * scale * (3 + (p.radius * 0.68 + tremor) * pt.fade);
        return {
          x: Math.round(pt.x + width * pt.nx),
          y: Math.round(pt.y + width * pt.ny),
        };
      });
    const top = edge(1),
      bottom = edge(-1);
    for (let i = 1; i < top.length; i++)
      fillPixels(c, [top[i - 1], top[i], bottom[i], bottom[i - 1]], color);
  }
  for (let i = 2; i < path.length; i += 3) {
    const pt = path[i];
    const jitter = 7 + ((p.age + i * 3) % 8);
    const sign = i % 2 ? -1 : 1;
    const x = Math.round(pt.x + pt.nx * jitter * sign);
    const y = Math.round(pt.y + pt.ny * jitter * sign);
    fillPixels(
      c,
      [
        { x: x - 24 * w.facing, y: y - 5 * sign },
        { x: x + 7 * w.facing, y: y - 2 },
        { x: x - 3 * w.facing, y: y + 4 },
      ],
      i % 4 ? "#fa7620" : "#ffc947",
    );
  }
}

function drawFireDragon(
  c: CanvasRenderingContext2D,
  p: KiProjectile,
  image?: HTMLImageElement,
  debug = false,
) {
  const w = p.wave!;
  fireRibbon(c, p);
  const a = fireDragonPoint(w, w.distance - 5),
    b = fireDragonPoint(w, w.distance + 5);
  const tilt = Math.atan2(b.y - a.y, Math.abs(b.x - a.x));
  const angle = tilt < -0.22 ? 0 : tilt > 0.22 ? 2 : 1;
  const jaw = Math.floor(p.age / 4) % 2;
  const pivot = sasukePolishArt.fire[angle + 3 * jaw];
  c.save();
  c.translate(Math.round(p.x), Math.round(p.y));
  c.scale(w.facing, 1);
  const size = Math.min(1, 0.48 + p.age * 0.095);
  if (image)
    c.drawImage(
      image,
      angle * 128,
      jaw * 108,
      128,
      108,
      -Math.round(pivot.x * size),
      -Math.round(pivot.y * size),
      Math.round(128 * size),
      Math.round(108 * size),
    );
  c.restore();
  if (debug && !w.struck)
    drawCombatDebug(
      c,
      [],
      fireDragonVolumes(w, { x: p.previousX, y: p.previousY }, p.radius),
    );
}

export function drawSasukeContact(
  c: CanvasRenderingContext2D,
  m: Match,
  sprites: ReadonlyMap<string, HTMLImageElement>,
) {
  for (const event of m.events) {
    if (!event.sasuke) continue;
    const age = (event.total ?? 16) - event.life;
    const { kind, facing, cursed } = event.sasuke;
    c.save();
    c.translate(Math.round(event.x), Math.round(event.y));
    c.scale(facing, 1);
    c.globalAlpha *= Math.max(0, 1 - age / 16);
    if (kind === "chidori") {
      fork(c, { x: 0, y: 0 }, age, 43 + age * 2, 11, cursed);
      sasukeBolt(c, { x: -43, y: 14 }, { x: 49, y: -23 }, age, 4, 13, cursed);
    } else {
      const sheet = sprites.get(sasukeEffectsSheet);
      if (sheet)
        c.drawImage(
          sheet,
          384,
          0,
          128,
          96,
          -57 - age,
          -39 - age,
          103 + age * 3,
          78 + age * 2,
        );
      for (let i = 0; i < 11; i++) {
        const x = Math.round(Math.cos(i * 2.4) * (21 + age * 3));
        const y = Math.round(Math.sin(i * 2.4) * (16 + age * 2));
        fillPixels(
          c,
          [
            { x: x - 4, y: y + 3 },
            { x: x + 4, y: y - 4 },
            { x: x + 9, y: y + 1 },
          ],
          i % 2 ? "#ffdd63" : "#ff6d27",
        );
      }
    }
    c.restore();
  }
}

export function chidoriCamera(m: Match) {
  if (m.cinematicActive || m.capture) return;
  const contact = m.events.find((e) => e.sasuke?.kind === "chidori");
  if (!contact) return;
  const strength = (contact.life / (contact.total ?? 16)) ** 1.3;
  const scale = 1 + 0.14 * strength;
  const x = Math.max(640 / scale, Math.min(1280 - 640 / scale, contact.x));
  return {
    x,
    y: 360 + 47 * strength,
    scale,
    shakeX: Math.round(strength * 5) * (m.frame % 2 ? 1 : -1),
    shakeY: Math.round(strength * 2) * (m.frame % 3 ? 1 : -1),
  };
}
