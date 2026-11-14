import type { Match } from "../engine/combat";
import { justiceBeats, pandemoniumScene, type PandemoniumState } from "../engine/xebec-pandemonium";
import { isXebecSpecial, kingWill, xebecBladeAt, xebecPressure, xebecPressureReach, xebecProjectile, xebecWaveVolume } from "../engine/xebec-specials";
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
  const fold = f.state === "dash" ? 13 : 0;
  const hand = f.state === "attack" && f.attackPhase === "active" && !f.move?.super &&
    !isXebecSpecial(f.moveId) ?
    f.attackShapes().map(shape => "a" in shape ? shape.b : { x: shape.x + (f.facing > 0 ? shape.w : 0), y: shape.y + shape.h / 2 })[0] : undefined;
  const forearm = hand ? { x: (hand.x - f.x) * f.facing, y: hand.y - f.y } : { x: 34 + fold, y: shoulder - 4 };
  c.save();
  c.translate(Math.round(f.x), Math.round(f.y));
  c.scale(f.facing, 1);
  c.globalAlpha = charge.powered ? .92 : .62 + .19 * Math.sin(frame * .13);
  c.fillStyle = "rgba(200,28,61,.16)";
  path(c, [[-26 + fold, shoulder + 2], [-48, shoulder + 24], [-44, shoulder + 50], [-23, shoulder + 18]]);
  c.fill();
  hakiBolt(c, frame, 29, { x: -23 + fold, y: shoulder + 8 }, { x: -51, y: shoulder + 42 }, 3);
  hakiBolt(c, frame, 73, { x: 11 + fold, y: shoulder + 13 }, forearm, 3);
  hakiBolt(c, frame, 162, blade.grip, blade.tip, charge.powered ? 5 : 3);
  hakiBolt(c, frame, 215, { x: -3, y: -47 }, { x: -32, y: -9 }, 2);
  if (!f.airborne) hakiBolt(c, frame, 971, { x: -13, y: -4 }, { x: 40, y: 1 }, 3);
  if (f.state === "dash") hakiBolt(c, frame, 310, { x: -28, y: -65 }, { x: -101, y: -35 }, 3);
  if (charge.powered && f.attackPhase === "startup")
    hakiBolt(c, frame, 377, { x: -36, y: shoulder + 45 }, forearm, 4);
  c.restore();
}

export function drawXebecSpecials(c: CanvasRenderingContext2D, match: Match, effects: boolean, debug: boolean, reducedMotion = false) {
  for (const f of match.fighters) {
    const move = f.move, id = f.moveId, t = f.stateFrame;
    if (!effects || f.state !== "attack" || !move || !f.domination ||
        !(isXebecSpecial(id) || move.rank === 3 || move.super)) continue;
    c.save();
    c.translate(Math.round(f.x), Math.round(f.y));
    c.scale(f.facing, 1);
    const pressure = xebecPressure(id);
    if (pressure) {
      const age = t - pressure.release;
      if (age >= 0 && age < pressure.active + 12) {
        const reach = xebecPressureReach(pressure,t);
        const king = pressure.kind === "conqueror";
        c.globalAlpha = Math.min(reducedMotion ? .48 : .86, (pressure.active + 12 - age) / 17);
        for (let layer = 0; layer < (king ? 4 : 2); layer++) {
          const end = reach * (1 - layer * .13);
          const y = -64 + layer * 17;
          const lift = pressure.height * (.57 - layer * .08);
          for (const direction of [-1, 1]) {
            const x = direction * end;
            const g = c.createLinearGradient(0, y, x, y);
            g.addColorStop(0, "#f5a1a500"); g.addColorStop(.8, "#952c4d23");
            g.addColorStop(1, king ? "#f994a074" : "#ed6a7b56");
            c.beginPath();
            c.moveTo(0,y-lift);
            c.bezierCurveTo(x*.55,y-lift,x*.75,y-lift*.54,x,y);
            c.bezierCurveTo(x*.84,y+lift*.77,x*.32,y+lift,0,y+lift);
            c.bezierCurveTo(x*.54,y+lift*.44,x*.72,y,x*.42,y-lift*.63);
            c.closePath();
            c.fillStyle = g; c.fill();
            hakiBolt(c,t,56+layer*89+direction*13,{x:direction*18,y:y-layer*4},
              {x:x*.94,y:y+direction*layer*7}, king ? 9-layer : 5-layer);
          }
        }
        c.translate(0,-3);
        if (!reducedMotion) shards(c,age,1,king?28:move.rank*7+4);
      } else if (age < 0 && age >= -(id === kingWill ? 33 : 8)) {
        const focus = Math.max(.2, 1 + age / (id === kingWill ? 40 : 12));
        c.globalAlpha = reducedMotion ? focus * .55 : focus;
        hakiBurst(c,t,{x:0,y:-105}, (id === kingWill ? 94 : 41)*focus, id === kingWill ? 6 : 3, 593);
      }
    } else if (isXebecSpecial(id)) {
      const blade = xebecBladeAt(id,t);
      const contact = f.hitWindow;
      const waveHit = move.startup <= t && t < move.startup + move.active;
      if (t < move.startup + move.active + 3) {
        hakiBolt(c,t,44+id.length,blade.grip,blade.tip,contact ? 3+contact.id : 2.5);
      }
      if (contact) {
        const { grip, tip } = blade;
        const ax = tip.x-grip.x, ay = tip.y-grip.y;
        const arc = contact.id === 2 ? 1 : -1;
        c.globalAlpha = .65;
        c.beginPath();
        c.moveTo(grip.x,grip.y);
        c.quadraticCurveTo(tip.x + arc*ay*.6,tip.y - arc*ax*.55,tip.x,tip.y);
        c.quadraticCurveTo(tip.x + arc*ay*.3,tip.y - arc*ax*.26,grip.x,grip.y);
        c.fillStyle = "#170a1b88"; c.fill();
        c.strokeStyle = red; c.lineWidth = 2+contact.id; c.stroke();
      } else if (waveHit && match.kiProjectiles.some(p => p.owner === f.id && p.age <= 3 && xebecProjectile(p.move))) {
        hakiBurst(c,t,blade.tip,33+move.rank*11,move.rank+1,790);
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
      const {a, b} = xebecWaveVolume(wave, 0, 0, 1, p.radius);
      const radius = p.radius;
      const slope = wave.slope;
      const leading = (y: number) => y * slope + radius * (1 - (y / wave.halfLength) ** 2);
      const y0 = a.y, y1 = b.y;
      if (effects) {
        c.fillStyle = wave.rank === 3 ? "#fb294753" : "#d0213e29";
        for (let i = 0; i < 5; i++) {
          const y = y0 + (i + 1) * (y1 - y0) / 6;
          c.fillRect(Math.round(leading(y)) - 44 - i % 3 * 12, Math.round(y), 61, 3 + i % 2 * 3);
        }
      }
      path(c, [[a.x - radius * 2.4, y0 - 5], [a.x + radius * .65, y0 + 7],
        [leading(y0 * .46) + 6, y0 * .46], [radius * 1.15, -4], [radius * .85, 9],
        [leading(y1 * .51) + 5, y1 * .51], [b.x + radius * .15, y1 - 4], [b.x - radius * 2, y1 + 8],
        [leading(y1 * .43) - radius * 1.2, y1 * .43], [-radius * .65, 5],
        [leading(y0 * .43) - radius * .9, y0 * .43], [a.x - radius * .95, y0 + 11]]);
      c.closePath();
      c.fillStyle = "#140f1f";
      c.fill();
      c.strokeStyle = wave.rank === 3 ? "#ff8791" : "#ff3d60";
      c.lineWidth = wave.rank === 3 ? 5 : 3;
      c.stroke();
      if (effects) {
        c.globalAlpha = wave.rank === 3 ? .96 : .77;
        hakiBolt(c, p.age, p.id * 13, { x: a.x, y: y0 + 5 }, { x: radius * .7, y: 1 }, wave.rank === 3 ? 7 : 4);
        hakiBolt(c, p.age, p.id * 31, { x: radius * .6, y: -4 }, { x: b.x, y: y1 - 7 }, 5);
        hakiBolt(c, p.age, p.id * 57, { x: 3, y: 5 }, { x: -radius * 3.4, y: y0 * .62 }, 3);
      }
      if (debug) {
        c.globalAlpha = .35;
        c.strokeStyle = "#91ffe0";
        c.lineCap = "round";
        c.lineWidth = radius * 2;
        path(c, [[a.x, a.y], [b.x, b.y]]);
        c.stroke();
      }
    } else if (effects) {
      c.globalAlpha = Math.max(0, 1 - p.impactAge / 10);
      hakiBurst(c, p.impactAge, { x: 0, y: 0 }, 37 + p.impactAge * 3, wave.rank + 2, p.id * 17);
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
  const t = s.tick;
  const a = scene.attacker;
  c.save();
  c.translate(a.x, a.y);
  c.scale(s.facing, 1);
  if (t >= justiceBeats.rush && t < justiceBeats.rupture) {
    const sprint = t - 533;
    c.globalAlpha = .78;
    hakiBolt(c, t, 918, {x: -29, y: -119}, {x: 70, y: -81}, 6);
    hakiBolt(c, t, 212, {x: 14, y: -81}, {x: 114, y: -102}, 8);
    if (sprint >= 0) {
      for (let i = 0; i < 11; i++) {
        const length = 17 + (i * 23 + sprint * 5) % 106;
        c.fillStyle = i % 3 ? "#bc394c74" : "#fff0b596";
        c.fillRect(-19 - i * 13 - length, -16 - i * 13, length, 2 + i % 4);
      }
    }
  }
  if (t >= justiceBeats.aftermath && t < justiceBeats.return) {
    c.globalAlpha = (1 - (t - justiceBeats.aftermath) / 85) * .72;
    hakiBolt(c, t, 588, {x: -29, y: -120}, {x: 53, y: -123}, 4);
    hakiBolt(c, t, 693, {x: -25, y: -37}, {x: -59, y: -4}, 3);
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
  c.fillText(pulse ? "VONTADE DO REI SUPREMO" :
    resource.charge === 100 ? "DOMINAÇÃO · ↓↓ + FORTE" : `DOMINAÇÃO · ${resource.charge}%`, x, 661);
  c.restore();
}
