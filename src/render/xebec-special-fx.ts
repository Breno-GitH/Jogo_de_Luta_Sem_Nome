import type { Match } from "../engine/combat";
import { isXebecSpecial } from "../engine/xebec-specials";

const crimson = "#ff325d";
const shadow = "#461023";
const glow = "#ffa195";

function sparks(
  c: CanvasRenderingContext2D,
  seed: number,
  age: number,
  count: number,
  color: string,
) {
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const angle = (seed * 0.61 + i * 2.4) % (Math.PI * 2);
    const distance = age * (1.2 + (i % 4) * 0.73) + 4;
    const x = Math.round(Math.cos(angle) * distance);
    const y = Math.round(Math.sin(angle) * distance + age * age * 0.065);
    const size = i % 3 === 0 ? 3 : 2;
    c.fillRect(x, y, size, size);
  }
}

function lightning(c: CanvasRenderingContext2D, tick: number, length: number) {
  c.beginPath();
  c.moveTo(0, 0);
  for (let i = 1; i <= 6; i++) {
    const jitter = Math.sin(tick * 2.8 + i * 7) * (i % 2 ? 8 : 4);
    c.lineTo(Math.round((length * i) / 6), Math.round(jitter));
  }
  c.strokeStyle = crimson;
  c.lineWidth = 3;
  c.stroke();
  c.strokeStyle = "#fff0df";
  c.lineWidth = 1;
  c.stroke();
}

function arc(
  c: CanvasRenderingContext2D,
  rising: boolean,
  progress: number,
  rank: number,
) {
  const sweep = 0.85 + progress * 0.85;
  c.scale(rising ? 0.69 : 1.1, rising ? 1.03 : 0.53);
  const angle = rising ? 0.9 - progress * 2.1 : 0.9 - progress * 0.85;
  const radius = 68 + 7 * rank;
  c.beginPath();
  c.arc(0, 0, radius, angle - sweep, angle + 0.12);
  c.arc(0, 0, radius - 9 - rank * 2, angle + 0.07, angle - sweep * 0.88, true);
  c.closePath();
  c.fillStyle = shadow;
  c.fill();
  c.strokeStyle = crimson;
  c.lineWidth = 3;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, radius - 1, angle - sweep * 0.66, angle - 0.02);
  c.strokeStyle = "#ffe0c5";
  c.lineWidth = 2;
  c.stroke();
}

export function drawXebecSpecials(
  c: CanvasRenderingContext2D,
  match: Match,
  effects: boolean,
  debug: boolean,
) {
  for (const fighter of match.fighters) {
    const move = fighter.move;
    if (
      !effects ||
      fighter.state !== "attack" ||
      !move ||
      !isXebecSpecial(move.special)
    )
      continue;
    const age = fighter.stateFrame - move.startup;
    if (age < -7 || age >= move.active + 5) continue;
    const rising = move.special === "xebecRising";
    c.save();
    c.translate(Math.round(fighter.x), Math.round(fighter.y));
    c.scale(fighter.facing, 1);
    if (age < 0) {
      c.translate(rising ? 14 : -15, rising ? -50 : -113);
      c.globalAlpha = (age + 8) / 8;
      lightning(c, fighter.stateFrame, 23 + 5 * move.rank);
    } else if (move.special !== "xebecWave") {
      if (!rising && Math.abs(fighter.vx) > 1) {
        c.fillStyle = "#b9a59e";
        c.globalAlpha = 0.4;
        for (let i = 0; i < 5; i++) {
          const x = -13 - i * 10 - age * 3;
          c.fillRect(x, -4 - (i % 3) * 3, 9 - i, 2);
        }
      }
      c.globalAlpha = Math.min(1, (move.active + 5 - age) / 5);
      c.translate(rising ? 29 : 47, rising ? -91 : -112);
      arc(c, rising, age / (move.active + 5), move.rank);
    } else {
      c.translate(96, -118);
      c.globalAlpha = Math.max(0, 0.8 - age * 0.12);
      lightning(c, fighter.stateFrame, 28 + move.rank * 5);
    }
    c.restore();
  }
  for (const p of match.kiProjectiles) {
    if (
      match.fighters[p.owner].data.specialMoves?.[p.move]?.special !==
      "xebecWave"
    )
      continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    const r = p.radius;
    if (p.state === "flight") {
      c.beginPath();
      c.moveTo(-r * 1.4, -r);
      c.quadraticCurveTo(r * 0.1, -r * 0.91, r * 0.84, -r * 0.33);
      c.quadraticCurveTo(r * 1.2, r * 0.45, -r * 1.7, r);
      c.quadraticCurveTo(-r * 0.02, r * 0.18, -r * 0.24, 0);
      c.quadraticCurveTo(-r * 0.42, -r * 0.51, -r * 1.4, -r);
      c.fillStyle = shadow;
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = crimson;
      c.stroke();
      c.beginPath();
      c.moveTo(-r * 0.82, -r * 0.71);
      c.quadraticCurveTo(r * 2.1, -r * 0.18, -r * 0.72, r * 0.66);
      c.strokeStyle = "#fff0df";
      c.lineWidth = 2;
      c.stroke();
      c.translate(-r * 0.5, 0);
      if (effects) lightning(c, p.age, r * 1.3);
      if (debug) {
        c.strokeStyle = "#ff8797";
        c.lineWidth = 1;
        c.strokeRect(-r * 0.5, -r, r * 2, r * 2);
      }
    }
    c.restore();
  }
  for (const hit of match.events) {
    if (!effects || !hit.xebec) continue;
    const age = (hit.total ?? 12) - hit.life;
    c.save();
    c.translate(Math.round(hit.x), Math.round(hit.y));
    c.scale(hit.xebec.facing, 1);
    c.globalAlpha = Math.max(0, 1 - age / (hit.total ?? 12));
    const radius = 7 + age * (1.6 + hit.xebec.rank * 0.3);
    const color = hit.blocked ? "#a4e3ff" : glow;
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(0, 0, radius * 0.63, radius, -0.48, 0.3, 5.3);
    c.stroke();
    sparks(c, hit.x + hit.y, age, 7 + hit.xebec.rank * 3, color);
    c.restore();
  }
}
