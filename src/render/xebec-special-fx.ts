import type { Match } from "../engine/combat";
import { pandemoniumConfig, pandemoniumScene, type PandemoniumState } from "../engine/xebec-pandemonium";
import { gateGuard, isXebecSpecial, xebecBladeAt, xebecGrapple, xebecProjectile } from "../engine/xebec-specials";
import type { Fighter } from "../engine/combat";
import { hakiBolt, hakiBurst } from "./xebec-haki-fx";

const red = "#ff3959";
const wine = "#220b1c";
const ivory = "#ffe1b9";

function path(c: CanvasRenderingContext2D, points: readonly [number, number][]) {
  c.beginPath();
  points.forEach(([x, y], i) => i === 0 ? c.moveTo(Math.round(x), Math.round(y)) :
    c.lineTo(Math.round(x), Math.round(y)));
}

function haki(c: CanvasRenderingContext2D, tick: number, x: number, y: number, reach: number, rise: number, width = 4) {
  hakiBolt(c, tick, Math.round(x * 97 + y * 3 + reach / 10), { x, y }, { x: x + reach, y: y + rise }, width);
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

const bladeCels: Record<string, Record<number, [number, number, number, number]>> = {
  "xebec/movement.png": {
    0: [-21,-62,45,-22], 1: [-24,-66,44,-21], 2: [-24,-66,43,-21], 3: [-23,-65,44,-21],
    4: [-22,-66,52,-12], 5: [-23,-64,47,-16], 6: [-23,-67,48,-19], 7: [-21,-66,57,-17],
    8: [-24,-64,44,-20], 9: [-23,-65,44,-21], 10: [-24,-65,51,-22], 11: [-23,-67,47,-18],
    12: [-24,-53,39,-24], 13: [-4,-63,77,-23], 14: [-14,-67,53,-18], 15: [-15,-68,52,-28],
  },
  "xebec/reactions.png": {
    2: [-27,-47,44,-30], 4: [-16,-78,39,-12], 5: [-15,-77,36,-17], 6: [-12,-81,21,-40],
    7: [-13,-69,9,-12], 8: [-22,-45,48,-28], 9: [-6,-132,53,-146],
    10: [-22,-51,55,-34], 13: [-16,-69,42,-3],
  },
  "xebec/normals.png": {
    0: [-25,-69,41,-18], 2: [-28,-61,34,-18], 4: [-44,-129,16,-155], 5: [31,-108,107,-108],
    7: [-29,-42,40,-9], 9: [-31,-30,25,-9], 11: [22,-133,68,-162],
    12: [-25,-71,19,-13], 13: [-24,-71,19,-17], 15: [25,-43,60,-5], 19: [-25,-65,22,-16],
  },
  "xebec/pandemonium.png": {
    12: [-28,-66,40,-12], 13: [-26,-66,42,-9], 14: [-29,-67,38,-14], 15: [-26,-65,29,-10],
  },
};

export function drawXebecCharge(c: CanvasRenderingContext2D, f: Fighter, frame: number, sheet: string, cel: number) {
  const charge = f.domination;
  if (!charge || (charge.charge !== 100 && !charge.powered) || f.health <= 0) return;
  const data = bladeCels[sheet]?.[cel];
  const blade = data ? { grip: { x: data[0], y: data[1] }, tip: { x: data[2], y: data[3] } } :
    xebecBladeAt(f.moveId, f.stateFrame);
  const crouched = f.crouching || f.state === "landing";
  const shoulder = f.airborne ? -89 : crouched ? -79 : -116;
  const fold = f.state === "dash" || gateGuard(f.moveId) && f.state === "attack" ? 13 : 0;
  const hand = f.state === "attack" && f.attackPhase === "active" && !f.move?.super ?
    f.attackShapes().map(shape => "a" in shape ? shape.b : { x: shape.x + (f.facing > 0 ? shape.w : 0), y: shape.y + shape.h / 2 })[0] : undefined;
  const forearm = hand ? { x: (hand.x - f.x) * f.facing, y: hand.y - f.y } : { x: 34 + fold, y: shoulder - 4 };
  c.save();
  c.translate(Math.round(f.x), Math.round(f.y));
  c.scale(f.facing, 1);
  c.globalAlpha = charge.powered ? .92 : .62 + .19 * Math.sin(frame * .13);
  hakiBolt(c, frame, 29, { x: -23 + fold, y: shoulder + 8 }, { x: -51, y: shoulder + 42 }, 3);
  hakiBolt(c, frame, 73, { x: 11 + fold, y: shoulder + 13 }, forearm, 3);
  hakiBolt(c, frame, 162, blade.grip, blade.tip, charge.powered ? 5 : 3);
  hakiBolt(c, frame, 215, { x: -3, y: -47 }, { x: -32, y: -9 }, 2);
  if (!f.airborne) hakiBolt(c, frame, 971, { x: -13, y: -4 }, { x: 40, y: 1 }, 3);
  if (charge.powered && f.attackPhase === "startup")
    hakiBolt(c, frame, 377, { x: -36, y: shoulder + 45 }, forearm, 4);
  c.restore();
}

export function drawXebecSpecials(c: CanvasRenderingContext2D, match: Match, effects: boolean, debug: boolean) {
  if (effects && match.capture?.xebec) {
    const s = match.capture, grab = s.xebec!, a = match.fighters[s.attacker], b = match.fighters[s.victim];
    const p = xebecGrapple(grab.id)!;
    const age = s.tick - p.held;
    c.save();
    c.globalAlpha = age < 0 ? .39 + Math.min(1, s.tick / p.held) * .31 : .94;
    const origin = { x: (a.x + b.x) / 2, y: b.y - 95 };
    hakiBolt(c, match.frame, 77, { x: a.x + a.facing * 26, y: a.y - 92 }, origin, grab.powered ? 6 : 3);
    hakiBurst(c, match.frame, origin, (grab.powered ? 1.35 : 1) * (26 + (age < 0 ? s.tick * 1.15 : p.reach * .72)), age < 0 ? 3 : 7, 107,
      grab.id === "xebecDominion" ? 22 : 0);
    c.restore();
  }
  for (const f of match.fighters) {
    const move = f.move, id = f.moveId, t = f.stateFrame;
    if (!effects || f.state !== "attack" || !move || !f.domination ||
        !(isXebecSpecial(id) || move.rank === 3 || move.super)) continue;
    const age = t - move.startup;
    if (age < -9 || age > move.active + 8) continue;
    const power = f.domination.powered ? 1.3 : 1;
    c.save();
    c.translate(Math.round(f.x), Math.round(f.y));
    c.scale(f.facing, 1);
    const grip = xebecGrapple(id);
    if (grip && t >= grip.blast) {
      const release = t - grip.blast, max = grip.active + 7;
      c.globalAlpha = Math.max(0, 1 - release / max);
      const origin = { x: id === "xebecDominion" ? 27 : 0, y: -52 };
      const reach = Math.min(grip.reach, 25 + release * 12);
      if (id === "xebecDominion") edge(c, 25 + reach * .65, -63, 0, reach * .36, 46);
      else ring(c, 0, -52, reach, .58);
      hakiBurst(c, t, origin, reach * power, Math.min(8, 2 + move.rank * 2), 94);
    } else if (grip) {
      haki(c, t, 19, -93, 38 * power, -8, 3);
    } else if (isXebecSpecial(id) && !grip) {
      const blade = xebecBladeAt(id, t);
      hakiBolt(c, t, 44 + id.length, blade.grip, blade.tip, 3 * power);
      if (f.attackPhase === "active" && (gateGuard(id) || id === "xebecCut")) {
        const rises = blade.tip.y < blade.grip.y - 22;
        c.globalAlpha = .83;
        edge(c, blade.tip.x - 10, blade.tip.y + (rises ? 34 : 0), rises ? -.6 : 1.57,
          (rises ? 42 : 28) * power, (rises ? 65 : 39) * power);
      }
    } else if (f.attackPhase === "active") {
      haki(c, t, 25, -109, 35, -9, 2);
    }
    c.restore();
  }
  for (const p of match.kiProjectiles) {
    const wave = xebecProjectile(p.move);
    if (!wave) continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    if (p.state === "flight") {
      const high = p.move === "xebecHighWave", low = p.move === "xebecLowWave";
      edge(c, 0, 0, high ? -.36 : low ? 1.12 : .14, p.radius * (low ? 1.45 : 1), p.radius * (low ? .7 : 1.45));
      if (effects) {
        c.globalAlpha = p.xebecPowered ? .96 : .74;
        hakiBolt(c, p.age, p.id * 13, { x: 5, y: 0 }, { x: -p.radius * 2.3, y: high ? 18 : low ? -6 : -12 }, p.xebecPowered ? 5 : 3);
      }
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
    const { rank, facing, powered, move } = hit.xebec;
    const age = (hit.total ?? 12) - hit.life;
    c.save();
    c.translate(hit.x, hit.y);
    c.globalAlpha = Math.max(0, 1 - age / (hit.total ?? 12));
    if (!hit.blocked && (rank > 1 || powered || move === "xebecClash"))
      hakiBurst(c, age, { x: 0, y: 0 }, (22 + age * 4) * (powered ? 1.38 : 1), move === "xebecClash" ? 5 : 3, 70 + rank);
    else if (hit.blocked) {
      c.fillStyle = "#b5e1fa";
      c.fillRect(-7, -2, 13, 4);
      c.fillRect(-1, -10, 3, 20);
    }
    shards(c, age, facing, 7 + rank * 3);
    c.restore();
  }
}

export function drawPandemoniumSky(c: CanvasRenderingContext2D, tick: number, scene: ReturnType<typeof pandemoniumScene>) {
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
        c.fillStyle = ["#262035", "#382340", "#502940", "#774052"][layer];
        for (let i = 0; i < 14; i++) {
          const driftX = x + sign * (49 + i * 57);
          const h = 9 + ((i * 29 + layer * 17) % 31);
          c.fillRect(Math.round(driftX) - 24, y + h * .24, 43 + i % 5 * 7, h);
        }
      }
    }
    hakiBolt(c, tick, 51, { x: center - 37, y: 229 }, { x: center - spread * .62, y: -7 }, 8);
    hakiBolt(c, tick, 141, { x: center + 33, y: 197 }, { x: center + spread * .8, y: 22 }, 6);
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
    hakiBurst(c, t, { x: 35, y: -81 - 97 * raised }, 140 + 33 * raised, 6, 121, 20);
  }
  if (age >= 0 && age < 44) {
    c.globalAlpha = Math.min(1, (44 - age) / 22);
    edge(c, 68 + age * 4, -133 - age * 1.2, .4, 83 + age * 3, 108 + age * 2);
    haki(c, t, 63, -78, 185 + 5 * age, -97);
    ring(c, 83, -3, 45 + age * 6, .12);
    hakiBurst(c, t, { x: 83, y: -70 }, Math.min(215, 59 + age * 7), 9, 841, 27);
    c.translate((b.x - a.x) * s.facing, b.y - a.y - 59);
    shards(c, age, 1, 27);
  }
  if (t >= 202 && t < 241) {
    c.globalAlpha = (241 - t) / 60;
    hakiBolt(c, t, 382, { x: -23, y: -125 }, { x: 39, y: -139 }, 3);
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
  if (resource.charge === 100) {
    c.strokeStyle = `rgba(255,82,105,${.54 + .42 * Math.sin(frame * .13)})`;
    c.strokeRect(x, 667, 205, 12);
  }
  if (pulse) {
    c.strokeStyle = `rgba(255,208,157,${1 - (frame - resource.spentFrame!) / 30})`;
    c.strokeRect(x, 667, 205, 12);
  }
  c.font = "11px monospace";
  c.fillStyle = pulse || resource.charge === 100 ? "#ffe1b9" : "#f2acb6";
  c.fillText(pulse ? "HAKI FORTALECIDO" :
    resource.charge === 100 ? "DOMINAÇÃO · ESPECIAL PRONTO" : `DOMINAÇÃO · ${resource.charge}%`, x, 661);
  c.restore();
}
