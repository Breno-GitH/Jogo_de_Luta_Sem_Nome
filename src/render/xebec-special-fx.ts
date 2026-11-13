import type { Match } from "../engine/combat";
import { pandemoniumConfig, pandemoniumScene, type PandemoniumState } from "../engine/xebec-pandemonium";
import { isXebecSpecial, xebecProjectile, xebecRiposte } from "../engine/xebec-specials";

const red = "#ff3959";
const wine = "#220b1c";
const ivory = "#ffe1b9";

function path(c: CanvasRenderingContext2D, points: readonly [number, number][]) {
  c.beginPath();
  points.forEach(([x, y], i) => i === 0 ? c.moveTo(Math.round(x), Math.round(y)) :
    c.lineTo(Math.round(x), Math.round(y)));
}

function haki(c: CanvasRenderingContext2D, tick: number, x: number, y: number, reach: number, rise: number) {
  const points: [number, number][] = [[x, y]];
  for (let i = 1; i <= 6; i++) {
    const wave = Math.sin(tick * 2.31 + i * 15) * (i % 2 === 1 ? 10 : 4);
    points.push([x + reach * i / 6, y + rise * i / 6 + wave]);
  }
  path(c, points);
  c.strokeStyle = wine;
  c.lineWidth = 6;
  c.stroke();
  c.strokeStyle = red;
  c.lineWidth = 2;
  c.stroke();
}

function shards(c: CanvasRenderingContext2D, age: number, direction: number, n: number) {
  for (let i = 0; i < n; i++) {
    const sign = i % 4 === 0 ? -direction : direction;
    const x = sign * (i * 3 + age * (1.1 + i % 7 * .93));
    const y = -((i * 7) % 26 + age * (i % 4 + 1)) + age * age * .13;
    c.fillStyle = [red, ivory, "#573147"][i % 3];
    c.fillRect(Math.round(x), Math.round(y), i % 3 + 2, i % 3 + 1);
  }
}

function edge(c: CanvasRenderingContext2D, x: number, y: number, tilt: number, width: number, height: number) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.scale(width / 50, height / 50);
  c.beginPath();
  c.moveTo(-38, -45);
  c.quadraticCurveTo(45, -34, 43, -3);
  c.quadraticCurveTo(38, 36, -49, 48);
  c.quadraticCurveTo(21, 13, 21, -5);
  c.quadraticCurveTo(18, -25, -38, -45);
  c.fillStyle = wine;
  c.fill();
  c.strokeStyle = red;
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.moveTo(-19, -38);
  c.quadraticCurveTo(89, -8, -20, 39);
  c.strokeStyle = ivory;
  c.lineWidth = 1.6;
  c.stroke();
  c.restore();
}

function ring(c: CanvasRenderingContext2D, x: number, y: number, radius: number, flatten: number) {
  c.beginPath();
  c.ellipse(x, y, radius, radius * flatten, 0, 0, Math.PI * 2);
  c.strokeStyle = wine;
  c.lineWidth = 8;
  c.stroke();
  c.strokeStyle = red;
  c.lineWidth = 2;
  c.stroke();
}

export function drawXebecSpecials(c: CanvasRenderingContext2D, match: Match, effects: boolean, debug: boolean) {
  for (const f of match.fighters) {
    const move = f.move, id = f.moveId, t = f.stateFrame;
    if (!effects || f.state !== "attack" || !move || !f.domination ||
        !(isXebecSpecial(id) || id === xebecRiposte || move.rank === 3 || move.super)) continue;
    const age = t - move.startup;
    if (age < -7 || age > move.active + 4) continue;
    const power = f.domination.powered ? 1.3 : 1;
    c.save();
    c.translate(Math.round(f.x), Math.round(f.y));
    c.scale(f.facing, 1);
    c.globalAlpha = age < 0 ? (age + 7) / 10 : Math.min(1, (move.active + 5 - age) / 5);
    const heavySecondHit = (id === "xebecBreaker" || id === "xebecConqueror") && t >= move.hitWindows![1].fromTick;
    if (id === "xebecIntimidation" && age >= 0) {
      ring(c, 0, -61, 34 + age * 6, 1.04);
      ring(c, 0, -1, 26 + age * 8, .15);
    } else if (id === "xebecPressure" && age >= 0) {
      edge(c, 73 + age * 9, -86, 0, 37, 54);
      haki(c, t, 49, -101, 85, -16);
    } else if (id === "xebecCollision" || id === "xebecRift" || age < 0) {
      haki(c, t, id === "xebecCollision" ? 7 : 17, -103, 37 * power, -12);
    } else if (id === "xebecBrutal" || (id === "xebecBreaker" || id === "xebecConqueror") && !heavySecondHit) {
      c.translate(53, -104);
      shards(c, age, 1, 11);
    } else {
      const rising = id === "xebecRiposte" || id === "xebecBreaker" || id === "crouch_heavy";
      const downward = id === "xebecRupture" || id === "air_heavy";
      edge(c, 55, downward ? -69 : -106, rising ? -.7 : downward ? .43 : 1.46, 54 * power, 31 * power);
      haki(c, t, 22, -104, 73 * power, rising ? -35 : downward ? 51 : 2);
    }
    c.restore();
  }
  for (const p of match.kiProjectiles) {
    if (!xebecProjectile(p.move)) continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    if (p.state === "flight") {
      edge(c, 0, 0, 0, p.radius, p.radius * 1.5);
      if (effects) haki(c, p.age, -p.radius * 2, 0, p.radius * 2.4, -6);
      if (debug) {
        c.strokeStyle = "#ff8797";
        c.lineWidth = 1;
        c.strokeRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      }
    } else if (effects) {
      c.globalAlpha = Math.max(0, 1 - p.impactAge / 10);
      shards(c, p.impactAge, 1, 13);
    }
    c.restore();
  }
  if (!effects) return;
  for (const hit of match.events) {
    if (!hit.xebec) continue;
    const age = (hit.total ?? 12) - hit.life;
    c.save();
    c.translate(hit.x, hit.y);
    c.globalAlpha = Math.max(0, 1 - age / (hit.total ?? 12));
    if (!hit.blocked && hit.xebec.rank > 1)
      haki(c, age, 0, 0, hit.xebec.facing * (22 + age * 4), -15);
    else if (hit.blocked) {
      c.fillStyle = "#b5e1fa";
      c.fillRect(-7, -2, 13, 4);
      c.fillRect(-1, -10, 3, 20);
    }
    shards(c, age, hit.xebec.facing, 7 + hit.xebec.rank * 3);
    c.restore();
  }
}

export function drawPandemoniumSky(c: CanvasRenderingContext2D, scene: ReturnType<typeof pandemoniumScene>) {
  c.save();
  c.fillStyle = `rgba(12,6,21,${scene.darkness * .78})`;
  c.fillRect(-140, -80, 1560, 660);
  if (scene.split > 0) {
    const center = 640, spread = 28 + 206 * scene.split;
    const g = c.createLinearGradient(0, -30, 0, 285);
    g.addColorStop(0, "#f5b5a3");
    g.addColorStop(.55, "#e04a53");
    g.addColorStop(1, "rgba(140,34,66,0)");
    c.globalAlpha = scene.split * .91;
    c.fillStyle = g;
    path(c, [[center - spread, -30], [center + spread, -30], [center + 17, 285], [center - 20, 285]]);
    c.fill();
    for (const sign of [-1, 1]) {
      for (let layer = 0; layer < 4; layer++) {
        const x = center + sign * (spread * (.9 - .16 * layer));
        const y = 67 + 27 * layer;
        const drift = 60 * scene.split * sign;
        c.fillStyle = ["#181225","#25152b","#351b32","#542539"][layer];
        path(c, [[x + 70 * sign, -40], [x + 780 * sign, -40],
          [x + 780 * sign, y + 42], [x + 145 * sign + drift, y + 33],
          [x + 85 * sign, y + 18], [x - 13 * sign, y + 12],
          [x + 43 * sign, y - 9], [x - 30 * sign, y - 32]]);
        c.fill();
      }
    }
  }
  c.restore();
}

export function drawPandemoniumStrike(c: CanvasRenderingContext2D, s: PandemoniumState, scene: ReturnType<typeof pandemoniumScene>) {
  const t = s.tick, age = t - pandemoniumConfig.hits[0].tick;
  const a = scene.attacker, b = scene.victim;
  c.save();
  c.translate(a.x, a.y);
  c.scale(s.facing, 1);
  if (t > 14 && age < 2) {
    c.globalAlpha = scene.darkness * .92;
    const raised = Math.min(1, Math.max(0, (t - 58) / 59));
    haki(c, t, 20, -63 - 102 * raised, 66, -5);
    haki(c, t + 4, 32, -84 - 85 * raised, -57, -17);
    haki(c, t + 9, -15, -5, 76, -12);
  }
  if (age >= 0 && age < 44) {
    c.globalAlpha = Math.min(1, (44 - age) / 22);
    edge(c, 68 + age * 4, -133 - age * 1.2, .4, 83 + age * 3, 108 + age * 2);
    haki(c, t, 63, -78, 185 + 5 * age, -97);
    ring(c, 83, -3, 45 + age * 6, .12);
    c.translate((b.x - a.x) * s.facing, b.y - a.y - 59);
    shards(c, age, 1, 27);
  }
  c.restore();
}

export function drawDomination(c: CanvasRenderingContext2D, resource: NonNullable<Match["fighters"][number]["domination"]>, x: number, frame: number) {
  const pulse = resource.spentFrame !== undefined && frame - resource.spentFrame < 30;
  c.save();
  c.fillStyle = "#1a101e";
  c.fillRect(x, 668, 205, 11);
  c.fillStyle = resource.charge === 100 ? "#ff687b" : "#b83a58";
  c.fillRect(x + 2, 670, Math.round(201 * resource.charge / 100), 7);
  if (pulse) {
    c.strokeStyle = `rgba(255,208,157,${1 - (frame - resource.spentFrame!) / 30})`;
    c.strokeRect(x, 667, 205, 12);
  }
  c.font = "11px monospace";
  c.fillStyle = pulse || resource.charge === 100 ? "#ffe1b9" : "#f2acb6";
  c.fillText(pulse ? "HAKI FORTALECIDO" :
    resource.charge === 100 ? "DOMINAÇÃO · ESPECIAL L PRONTO" : `DOMINAÇÃO · ${resource.charge}%`, x, 661);
  c.restore();
}
