import { FLOOR, type Match } from "../engine/combat";
import { poseAt } from "../engine/moves";
import {
  pandemonium,
  pandemoniumId,
  pandemoniumScene,
} from "../engine/xebec-pandemonium";
import {
  isXebecSpecial,
  xebecCounterReply,
  xebecExtraShock,
} from "../engine/xebec-specials";
import type { Capsule } from "../engine/types";

const crimson = "#ff395e";
const shadow = "#180c1c";
const pale = "#ffd7bb";

function lightning(
  c: CanvasRenderingContext2D,
  tick: number,
  length: number,
  color = crimson,
) {
  c.beginPath();
  c.moveTo(0, 0);
  for (let i = 1; i <= 7; i++) {
    const jitter = Math.sin(tick * 2.8 + i * 7) * (i % 2 ? 11 : 5);
    c.lineTo(Math.round((length * i) / 7), Math.round(jitter));
  }
  c.lineWidth = 5;
  c.strokeStyle = shadow;
  c.stroke();
  c.lineWidth = 1.5;
  c.strokeStyle = color;
  c.stroke();
}

function bolts(
  c: CanvasRenderingContext2D,
  tick: number,
  count: number,
  radius: number,
  color = crimson,
) {
  for (let i = 0; i < count; i++) {
    c.save();
    c.rotate((i * Math.PI * 2) / count + Math.sin(tick / 9) * 0.32);
    c.translate(radius * (0.15 + (i % 3) * 0.1), 0);
    lightning(c, tick + i, radius * (0.55 + (i % 3) * 0.15), color);
    c.restore();
  }
}

function ring(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color = crimson,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.lineWidth = 6;
  c.strokeStyle = shadow;
  c.stroke();
  c.lineWidth = 1.7;
  c.strokeStyle = color;
  c.stroke();
}

function cut(
  c: CanvasRenderingContext2D,
  shape: Capsule,
  thickness: number,
  bend: number,
) {
  const { a, b } = shape;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length,
    ny = dx / length;
  const mx = (a.x + b.x) / 2,
    my = (a.y + b.y) / 2;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.quadraticCurveTo(mx + nx * bend, my + ny * bend, b.x, b.y);
  c.quadraticCurveTo(
    mx + nx * (bend + thickness),
    my + ny * (bend + thickness),
    a.x,
    a.y,
  );
  c.fillStyle = shadow;
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = crimson;
  c.stroke();
  c.beginPath();
  c.moveTo(mx, my);
  c.quadraticCurveTo(mx * 0.45 + b.x * 0.55, my * 0.45 + b.y * 0.55, b.x, b.y);
  c.lineWidth = 1;
  c.strokeStyle = pale;
  c.stroke();
}

function groundWave(
  c: CanvasRenderingContext2D,
  tick: number,
  width: number,
  tall: number,
) {
  c.save();
  c.globalAlpha *= Math.max(0.08, 1 - tick / 26);
  c.beginPath();
  c.moveTo(-16, 0);
  for (let i = 0; i < 10; i++) {
    const x = (width * i) / 9;
    c.lineTo(x, -(i % 2 ? tall * (1 - i / 12) : 2));
  }
  c.lineTo(width + 12, 0);
  c.fillStyle = shadow;
  c.fill();
  c.lineWidth = 1.8;
  c.strokeStyle = crimson;
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const x = (width * (i + 0.3)) / 8;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x - 8, 5 + (i % 3));
    c.lineTo(x + 4, 7);
    c.lineTo(x - 10, 16);
    c.stroke();
    c.fillStyle = i % 2 ? "#bd866e" : pale;
    c.fillRect(
      x + tick * 0.9,
      -3 - tick * (1.2 + (i % 3)) + tick * tick * 0.08,
      3 + (i % 3),
      2,
    );
  }
  c.restore();
}

export function drawXebecSpecials(
  c: CanvasRenderingContext2D,
  match: Match,
  effects: boolean,
  debug: boolean,
) {
  for (const f of match.fighters) {
    const m = f.move;
    if (
      !effects ||
      f.state !== "attack" ||
      !m ||
      (!isXebecSpecial(m.special) && f.moveId !== pandemoniumId)
    )
      continue;
    const id = f.moveId,
      t = f.stateFrame,
      age = t - m.startup;
    const powered = !!f.xebec?.empowered;
    const hit = f.hitWindow;
    const pose = poseAt(m, t);
    c.save();
    c.translate(Math.round(f.x), Math.round(f.y));
    c.scale(f.facing, 1);
    if (id === "xebecCollision" && t < m.startup + m.active) {
      c.translate(38, -113);
      c.rotate(-0.95);
      lightning(c, t, 74, powered ? pale : crimson);
    } else if (id === "xebecIntimidation" && age >= 0 && age < 10) {
      c.globalAlpha = 1 - age / 11;
      ring(c, 0, -77, 44 + age * 7, 23 + age * 3, pale);
      c.translate(0, -77);
      bolts(c, t, 5, 45 + age * 4);
    } else if (id === "xebecPressure" && age >= 0 && age < 11) {
      c.globalAlpha = 1 - age / 12;
      const x = 51 + age * 10;
      c.beginPath();
      c.moveTo(51, -128);
      c.bezierCurveTo(x + 15, -150, x + 34, -120, x + 18, -39);
      c.lineTo(x - 11, -44);
      c.quadraticCurveTo(x + 8, -88, 51, -128);
      c.fillStyle = "#30212b88";
      c.fill();
      ring(c, x + 7, -92, 14, 49, "#d893aa");
      c.translate(x, -116);
      c.rotate(1.1);
      lightning(c, t, 62);
    } else if (
      (id === "xebecRupture" && hit?.id === 2 && !f.airborne) ||
      (id === "xebecImpact" && hit?.id === 2)
    ) {
      groundWave(c, t - hit!.fromTick, powered ? 159 : 112, powered ? 46 : 29);
    } else if (
      (id === "xebecBrutal" || id === "xebecBreaker" || id === "xebecImpact") &&
      hit?.id === 1
    ) {
      c.translate(
        id === "xebecBrutal" ? 63 : 73,
        id === "xebecBrutal" ? -118 : -89,
      );
      c.rotate(-0.19);
      c.globalAlpha = 0.72;
      ring(
        c,
        2,
        0,
        12 + (t - hit.fromTick) * 5,
        9 + (t - hit.fromTick) * 3,
        "#ffc59a",
      );
      if (id === "xebecImpact") bolts(c, t, 5, powered ? 47 : 34);
    } else if (id === "xebecFissure" && age >= -10 && age < 4) {
      c.translate(age < 0 ? 12 : 110, -108);
      lightning(c, t, 32 + Math.max(0, age + 5) * 4);
    } else {
      const edge = pose?.hitboxes?.find(
        (shape): shape is Capsule => "a" in shape,
      );
      if (edge && (!m.xebec?.confirmedFollow || f.hitConfirmed)) {
        cut(
          c,
          edge,
          id === "xebecRupture" ? 43 : 22,
          id === "xebecBreaker" ? -25 : 12,
        );
        c.translate(edge.b.x - 13, edge.b.y);
        lightning(c, t, 28, powered ? pale : crimson);
      }
    }
    if (id === "xebecFlash" && Math.abs(f.vx) > 1) {
      c.fillStyle = "#ba819b";
      c.globalAlpha = 0.45;
      for (let i = 0; i < 8; i++)
        c.fillRect(-22 - i * 10, -18 - (i % 4) * 26, 26 - i, 2);
    }
    c.restore();
  }
  for (const p of match.kiProjectiles) {
    if (
      (p.move !== "xebecFissure" && p.move !== xebecExtraShock) ||
      p.state !== "flight"
    )
      continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    const r = p.radius;
    if (p.move === xebecExtraShock) {
      c.translate(-r, r - 7);
      groundWave(c, Math.min(11, p.age), r * 2.4, r * 1.7);
    } else {
      const spread = Math.min(1, 0.64 + p.age * 0.11);
      cut(
        c,
        {
          a: { x: -r * 1.4, y: -r * spread },
          b: { x: -r * 1.7, y: r * spread },
          r,
        },
        -r * 0.89,
        -r * 4,
      );
      if (effects) lightning(c, p.age, r * 1.2);
    }
    if (debug) {
      c.strokeStyle = "#ff8797";
      c.lineWidth = 1;
      c.strokeRect(-r - Math.abs(p.vx), -r, r * 2 + Math.abs(p.vx), r * 2);
    }
    c.restore();
  }
  for (const hit of match.events) {
    if (!effects || !hit.xebec) continue;
    const age = (hit.total ?? 12) - hit.life;
    const color = hit.blocked
      ? "#a4e3ff"
      : hit.xebec.empowered
        ? pale
        : crimson;
    c.save();
    c.translate(Math.round(hit.x), Math.round(hit.y));
    c.globalAlpha = Math.max(0, 1 - age / (hit.total ?? 12));
    const radius = 7 + age * (1.5 + hit.xebec.rank * 0.32);
    ring(c, 0, 0, radius * 0.64, radius, color);
    if (hit.xebec.move === xebecCounterReply || hit.xebec.empowered)
      bolts(c, age, 6, radius + 11, color);
    c.fillStyle = color;
    for (let i = 0; i < 6 + hit.xebec.rank * 3; i++) {
      const angle = (hit.x + hit.y) * 0.06 + i * 2.4,
        distance = age * (1.5 + (i % 4) * 0.7);
      c.fillRect(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance + age * age * 0.065,
        (i % 3) + 1,
        2,
      );
    }
    c.restore();
  }
}

export function drawPandemoniumSky(c: CanvasRenderingContext2D, match: Match) {
  const s = match.pandemonium!;
  const t = s.tick;
  const fade = Math.min(1, Math.max(0, (pandemonium.end - t) / 24));
  const dusk = c.createLinearGradient(0, 0, 0, 630);
  dusk.addColorStop(0, `rgba(31,8,28,${Math.min(0.71, t * 0.027) * fade})`);
  dusk.addColorStop(1, "rgba(27,6,23,0)");
  c.fillStyle = dusk;
  c.fillRect(0, 0, 1280, 630);
  if (t < pandemonium.split) return;
  const open = Math.min(1, (t - pandemonium.split) / 23);
  const center = 640 + (s.originX - 640) * 0.37;
  const edge = (side: number, step: number) =>
    center +
    side * (8 + open * (37 + step * 8)) +
    Math.sin(step * 2.2) * (7 + step);
  c.save();
  c.globalAlpha = fade * 0.78;
  for (const side of [-1, 1]) {
    c.save();
    c.beginPath();
    c.moveTo(edge(side, 0), 25);
    for (let i = 1; i <= 8; i++) c.lineTo(edge(side, i), 25 + i * 26);
    c.lineTo(side < 0 ? 0 : 1280, 258);
    c.lineTo(side < 0 ? 0 : 1280, 28);
    c.closePath();
    c.clip();
    const cloud = c.createLinearGradient(0, 48, 0, 251);
    cloud.addColorStop(0, "#201b31");
    cloud.addColorStop(0.43, "#503550");
    cloud.addColorStop(0.74, "#473044be");
    cloud.addColorStop(1, "#39233700");
    for (let i = 0; i < 14; i++) {
      const x = center + side * (i * 55 - 55 + open * 40);
      const y = 99 + Math.sin(i * 1.43) * 28;
      c.fillStyle = cloud;
      c.beginPath();
      c.ellipse(
        x,
        y,
        86 + (i % 4) * 19,
        47 + (i % 5) * 7,
        -0.12 * side,
        0,
        Math.PI * 2,
      );
      c.ellipse(
        x + 38 * side,
        y + 41,
        110,
        36 + (i % 3) * 11,
        -0.08 * side,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.restore();
    c.beginPath();
    c.moveTo(edge(side, 0), 25);
    for (let i = 1; i <= 7; i++) c.lineTo(edge(side, i), 25 + i * 26);
    c.strokeStyle = "#c47497a0";
    c.lineWidth = 2;
    c.stroke();
  }
  c.restore();
}

export function drawPandemoniumWorld(
  c: CanvasRenderingContext2D,
  match: Match,
) {
  const s = match.pandemonium!;
  const t = s.tick,
    age = t - pandemonium.impact;
  const scene = pandemoniumScene(s, FLOOR);
  c.save();
  c.translate(scene.attackerX, FLOOR);
  c.scale(s.facing, 1);
  if (scene.phase === "charge") {
    const buildup =
      (t - pandemonium.charge) / (pandemonium.impact - pandemonium.charge);
    c.translate(1, -144);
    c.globalAlpha = Math.min(1, 0.37 + buildup);
    bolts(c, t, 6, 33 + buildup * 62, buildup > 0.76 ? pale : crimson);
    c.rotate(-1.1);
    lightning(c, t, 56 + buildup * 21);
  } else if (age >= 0 && age < 32) {
    c.globalAlpha = Math.max(0, 1 - age / 32);
    cut(
      c,
      { a: { x: 7, y: -239 }, b: { x: 153 + age * 4, y: -7 }, r: 20 },
      71,
      -104,
    );
    groundWave(c, age * 0.69, 160 + age * 11, 47 - age);
    if (age < 13) {
      c.translate(106, -68);
      bolts(c, t, 8, 78 + age * 4, pale);
    }
  }
  c.restore();
}
