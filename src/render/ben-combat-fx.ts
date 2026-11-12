import { FLOOR, type Fighter, type Match } from "../engine/combat";
import { benGrabFor } from "../engine/ben-forms";
import { feedbackConductorContact, feedbackConductorPaths, feedbackGripPaths } from "../engine/feedback-conductor";
import { benBoltLength, feedbackCablePaths, benObjectHeight, benObjectMove, benObjectShape, spectralPaths } from "../engine/ben-moves";
import { shapeBounds } from "../engine/geometry";
import type { Point } from "../engine/types";
import reform from "../data/ben-reform-art.json";
import feedbackAntennae from "../data/feedback-antennae.json";
import { benGhostDepth } from "../engine/ben-rework";
import { echoCloneHurtbox, gravityStoneLaunch } from "../engine/ben-stage7";
import { Animator } from "./animator";
import { benAnimation } from "./ben-animations";
import stage7 from "../data/ben-stage7-art.json";

export const benReformSheets = Object.values(reform.props).map(prop => prop.sheet);
type BenTextures = ReadonlyMap<string, HTMLImageElement>;

const hot = ["#fff9b5", "#ffcd58", "#ff733b", "#d63d38"];
const cold = ["#edfaff", "#b9effb", "#64cee4", "#388dac"];
const dust = ["#ffebc4", "#dfc49c", "#ad886b", "#776054"];
const crystal = ["#dbfff0", "#9cf2d6", "#4dc2aa", "#1f625e"];
const specter = ["#f6e9ff", "#c7a9db", "#88749e", "#564366"];
const electric = ["#fffbd1", "#ffe37a", "#ffc646", "#7ed963"];
const gravity = ["#ffe6cc", "#ff8c65", "#b95076", "#6f345f"];
const sonic = ["#f6fff3", "#c8f6b8", "#68dbb2", "#2d867b"];
const cloneAnimator = new Animator(benAnimation("echoEcho"));

function polygon(c: CanvasRenderingContext2D, fill: string, points: [number, number][]) {
  c.beginPath();
  c.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (const [x, y] of points.slice(1)) c.lineTo(Math.round(x), Math.round(y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

function facet(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, tilt: number) {
  const l = x - width / 2, r = x + width / 2, peak = x + tilt, top = y - height;
  polygon(c, "#1d4b55", [[l, y], [l - 2, y - height * .39], [peak, top], [r + 2, y - height * .45], [r, y]]);
  polygon(c, crystal[2], [[l + 2, y - 2], [l + 1, y - height * .39], [peak, top + 2], [x, y - 2]]);
  polygon(c, crystal[1], [[x, y - 2], [peak, top + 2], [r - 1, y - height * .42], [r - 2, y - 2]]);
  polygon(c, crystal[0], [[peak, top + 2], [x, y - 2], [x + Math.max(2, width * .13), y - height * .53]]);
}

function pixelLine(c: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  c.fillStyle = color;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2) || 1;
    for (let j = 0; j <= steps; j++)
      c.fillRect(Math.round(a.x + (b.x - a.x) * j / steps - width / 2),
        Math.round(a.y + (b.y - a.y) * j / steps - width / 2), width, width);
  }
}

function cable(c: CanvasRenderingContext2D, points: Point[], clock: number, live: boolean) {
  pixelLine(c, points, "#090e17", 5);
  pixelLine(c, points.map(p => ({ x: p.x, y: p.y - 1 })), "#526080", 2);
  const tip = points.at(-1)!, back = points.at(-3)!;
  const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
  const brass = (color: string, vertices: [number, number][]) => polygon(c, color,
    vertices.map(([x, y]) => [tip.x + .76 * (Math.cos(angle) * x - Math.sin(angle) * y),
      tip.y + .76 * (Math.sin(angle) * x + Math.cos(angle) * y)]));
  brass("#53361e", [[-10, -6], [1, -6], [7, -3], [7, 4], [-10, 5]]);
  brass("#d29e42", [[-9, -5], [2, -5], [4, -1], [4, 4], [-9, 4]]);
  brass("#ffe283", [[-8, -5], [2, -5], [2, -2], [-8, -2]]);
  for (const offset of [-3, 3]) brass("#ffdc71", [[4, offset - 1], [12, offset - 1], [12, offset + 1], [4, offset + 1]]);
  if (live) {
    const offset = clock % 5 - 2;
    pixelLine(c, [back, { x: tip.x - 9, y: tip.y + 8 }, tip,
      { x: tip.x + 12, y: tip.y - 5 + offset }], "#fff1a2", 2);
  }
}

function pulse(c: CanvasRenderingContext2D, x: number, y: number, length: number, radius: number, facing: number, age: number, power: number) {
  const point = (a: number, b: number): [number, number] => [x + a * facing, y + b];
  const core = radius * .43;
  polygon(c, power ? "#f1a526" : "#b86516", [
    point(-length, 0), point(-length * .7, -radius * .47), point(-length * .3, -radius * .8),
    point(-3, -radius), point(radius * .85, -radius * .42), point(radius, 0),
    point(radius * .54, radius * .63), point(-length * .15, radius),
    point(-length * .57, radius * .49),
  ]);
  polygon(c, power ? "#ffed7f" : "#ffcc50", [
    point(-length * .92, 0), point(-length * .42, -core), point(-5, -radius * .76),
    point(radius * .75, -core), point(radius * .7, core), point(-length * .12, radius * .64),
  ]);
  polygon(c, "#fffbe0", [
    point(-length * .73, 0), point(-length * .2, -core), point(radius * .58, -core * .6),
    point(radius * .7, 0), point(-length * .15, core),
  ]);
  for (let i = 0; i < (power ? 5 : 3); i++) {
    const dx = -length * (.14 + i * .14);
    const sign = (age + i) % 2 ? 1 : -1;
    const branch = radius * (.8 + ((age + i * 5) % 6) / 6);
    pixelLine(c, [point(dx + 11, sign * 4), point(dx + 3, sign * branch * .55),
      point(dx - 5, sign * branch * .45), point(dx - 16, sign * branch)]
      .map(([x, y]) => ({ x, y })), i % 2 ? "#ffe274" : "#fff8b7", 2);
  }
}

function chargedSphere(c: CanvasRenderingContext2D, x: number, y: number, radius: number, facing: number, age: number, powered: boolean) {
  for (let row = -radius; row <= radius; row += 2) {
    const edge = Math.sqrt(radius * radius - row * row);
    c.fillStyle = powered ? "#fff076" : "#ca8b27";
    c.fillRect(Math.round(x - edge), Math.round(y + row), Math.ceil(edge * 2), 2);
    if (Math.abs(row) > radius * .65) continue;
    c.fillStyle = Math.abs(row + 3) < radius * .35 ? "#fffde3" : "#ffe077";
    c.fillRect(Math.round(x - edge * .63), Math.round(y + row), Math.ceil(edge * 1.32), 2);
  }
  for (let i = 0; i < 4; i++) {
    const angle = (age * 3 + i * 8) * Math.PI / 16;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const edge = { x: x + dx * radius * .77, y: y + dy * radius * .77 };
    const tip = { x: x + dx * (radius + 9) - facing * 5, y: y + dy * (radius + 9) };
    pixelLine(c, [edge, { x: tip.x + 4 * facing, y: (edge.y + tip.y) / 2 }, tip], "#fff4b0", 2);
  }
}

function shards(c: CanvasRenderingContext2D, x: number, y: number, tick: number, colors: string[], scale = 1) {
  for (let i = 0; i < 9; i++) {
    const a = i * .73;
    const r = (8 + tick * (i % 3 + 1) * 2) * scale;
    c.fillStyle = colors[i % colors.length];
    c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 3 + i % 4, 2 + i % 3);
  }
}

function fire(c: CanvasRenderingContext2D, x: number, y: number, r: number, facing: number, clock: number) {
  for (let row = -r; row <= r; row += 3) {
    const width = Math.floor(Math.sqrt(r * r - row * row));
    const tail = width + (Math.abs(row) < r * .73 ? (clock + row + r) % 9 : 0);
    const left = x - (facing === 1 ? tail : width);
    c.fillStyle = Math.abs(row) < r * .47 ? hot[1] : hot[3];
    c.fillRect(Math.round(left), Math.round(y + row), tail + width + 1, 3);
    c.fillStyle = Math.abs(row) < r * .4 ? hot[0] : hot[2];
    c.fillRect(Math.round(x - width * .58), Math.round(y + row), Math.floor(width * 1.1), 2);
  }
}

function restingFeedbackCable(anchor: Point, clock: number, side: number) {
  const nodes = feedbackAntennae.rest[side].map(([x, y], i) => ({
    x: anchor.x + x,
    y: anchor.y + y + Math.sin(clock * .09 + side * 1.6 + i * .35) * i * .45,
  }));
  return nodes.slice(0, -1).flatMap((b, i) => {
    const a = nodes[Math.max(0, i - 1)], next = nodes[i + 1], d = nodes[Math.min(i + 2, nodes.length - 1)];
    return Array.from({ length: 6 }, (_, j) => {
      const t = j / 6;
      const point = (k: keyof Point) => .5 * (2*b[k] + (-a[k]+next[k])*t +
        (2*a[k]-5*b[k]+4*next[k]-d[k])*t*t + (-a[k]+3*b[k]-3*next[k]+d[k])*t*t*t);
      return { x: point("x"), y: point("y") };
    });
  }).concat(nodes.at(-1)!);
}

export function drawFeedbackCables(c: CanvasRenderingContext2D, f: Fighter, clock: number, anchor: Point | undefined, effects: boolean) {
  const m = f.state === "attack" ? f.move : undefined;
  const kind = m?.ben?.cable;
  if (!anchor || (f.state === "grabbing" && f.actionClip.startsWith("conductorHold"))) return;
  if (!m || !kind) {
    for (const side of [0, 1]) cable(c, restingFeedbackCable(anchor, clock, side), clock, false);
    return;
  }
  const phase = f.stateFrame - m.startup;
  const live = effects && phase >= 0 && phase < m.active;
  const paths = feedbackCablePaths(kind, f.stateFrame, m);
  if (kind === "horizontal") cable(c, restingFeedbackCable(anchor, clock, 1), clock, false);
  for (const [i, path] of paths.entries()) {
    // Fit the root to this drawing's head. Keep the striking portion in
    // the same coordinates as the authoritative collision geometry.
    const dx = anchor.x - path[0].x + i * 4, dy = anchor.y - path[0].y + i * 3;
    const fitted = path.map((point, j) => {
      const weight = Math.max(0, 1 - j / 8);
      return { x: point.x + dx * weight, y: point.y + dy * weight };
    });
    cable(c, fitted, clock, live);
  }
}

export function drawSpectralArms(c: CanvasRenderingContext2D, f: Fighter, match: Match) {
  const move = f.state === "attack" ? f.move : undefined;
  const held = match.capture?.attacker === f.id &&
    match.capture.ben?.moveId.startsWith("spectralArms_") ? match.capture : undefined;
  let paths: Point[][];
  if (held) {
    const victim = match.fighters[held.victim];
    const style = benGrabFor(f.benForm, held.ben!.moveId)!;
    const dx = (victim.x - f.x) * f.facing;
    const dy = victim.y - f.y;
    const grip = Math.min(1, (style.duration - held.tick) / (style.duration - style.hitTick));
    paths = [0, 1].map(i => Array.from({ length: 13 }, (_, step) => {
      const t = step / 12 * grip;
      return {
        x: 19 + (dx - 25 + i * 10) * t,
        y: -95 + i * 14 + (dy + 18) * t + Math.sin(t * Math.PI) * (i ? 22 : -26),
      };
    }));
  } else {
    if (!move?.ben?.spectralReach || f.stateFrame < move.startup - 5 ||
        f.stateFrame >= move.startup + move.active + 8) return;
    paths = spectralPaths(move, f.stateFrame);
  }
  for (const path of paths) {
    pixelLine(c, path, "#302437", 14);
    pixelLine(c, path.map(p => ({ x: p.x, y: p.y - 2 })), "#9a8da7", 8);
    pixelLine(c, path.map(p => ({ x: p.x, y: p.y - 4 })), "#ddcfe3", 3);
    const tip = path.at(-1)!;
    polygon(c, "#eadcf1", [[tip.x - 8, tip.y - 6], [tip.x + 9, tip.y - 2], [tip.x - 3, tip.y + 6]]);
  }
}

export function drawBenChill(c: CanvasRenderingContext2D, f: Fighter) {
  if (!f.chill?.build && !f.chill?.freeze) return;
  const x = Math.round(f.x), y = Math.round(f.y);
  c.save();
  if (f.chill.freeze) {
    c.globalAlpha = .56;
    for (const [offset, height, tilt] of [[-20, 41, -7], [17, 57, 11], [-4, 26, 2]])
      facet(c, x + offset, y - 3, 22, height, tilt);
    shards(c, x, y - 58, 16 - f.chill.freeze, cold, .6);
  } else {
    c.fillStyle = "#162e42";
    c.fillRect(x - 18, y + 15, 36, 4);
    c.fillStyle = cold[2];
    c.fillRect(x - 18, y + 15, Math.ceil(f.chill.build * .36), 4);
  }
  c.restore();
}

export function drawBenAttackFx(c: CanvasRenderingContext2D, f: Fighter, clock: number, stormTips: Point[] = []) {
  if (f.omnitrix?.active === "nrg" && !f.omnitrix.nrgReleased && f.state === "landing" && f.stateFrame < 8)
    shards(c, 0, -3, f.stateFrame, dust, f.actionClip === "nrgDropLanding" ? .72 : .36);
  if (f.omnitrix?.active === "feedback" && f.state === "dash" && Math.abs(f.vx) > 5) {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i % 2 ? "#627e9a" : "#516077";
      const dir = Math.sign(f.facing * f.vx);
      c.fillRect(-dir * (39 + (clock * 5 + i * 13) % 28), -18 - i * 19, 13 + i * 2, 2);
    }
  }
  const m = f.state === "attack" ? f.move : undefined;
  const spec = m?.ben;
  if (f.omnitrix?.absorbFlash && f.omnitrix.active === "feedback") {
    const age = 18 - f.omnitrix.absorbFlash;
    const travel = Math.max(0, 1 - age / 15);
    for (const [x, y] of [[52, -114], [-19, -132], [33, -79]]) {
      const end = { x: Math.round(x * travel + 12 * (1 - travel)), y: Math.round(y * travel - 103 * (1 - travel)) };
      pixelLine(c, [end, { x: end.x - 6, y: end.y + 8 }, { x: 13, y: -103 }], "#ffd764", 2);
      c.fillStyle = "#fffbe2";
      c.fillRect(end.x - 3, end.y - 3, 6, 6);
    }
  }
  if (f.omnitrix?.flightTicks && f.omnitrix.nrgReleased)
    for (let i = 0; i < 5; i++) fire(c, -10 - i * f.vx * f.facing * .28, 4 + i * 6, 7 - i, 1, clock + i);
  if (!m || !spec) return;
  const phase = f.stateFrame - m.startup;
  if (f.moveId === "armorImpact_light" && Math.abs(f.vx) > 4 && !f.airborne) {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = dust[i % dust.length];
      c.fillRect(-42 - (clock * 3 + i * 11) % 36, -3 - i * 2, 9 + i * 2, 2);
    }
  }
  if (f.moveId === "armorImpact_medium" && phase >= -6 && phase < 3) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? hot[1] : hot[2];
      c.fillRect(11 + i * 6, -143 + i, 2, 4 + (clock + i) % 3);
    }
  }
  if (f.moveId === "nrgCounterShove" && phase >= 0 && phase < m.active) {
    for (let i = 0; i < 3; i++) {
      const reach = 64 + phase * 8 + i * 3;
      pixelLine(c, [{ x: reach - 19, y: -99 + i * 11 }, { x: reach, y: -103 + i * 11 }], cold[i], 2);
    }
  }
  if (spec.burrow && phase >= -3 && phase < m.active) {
    const lift = Math.max(0, phase + 3);
    const x = 24 + lift * 5;
    const y = -22 - lift * 13;
    polygon(c, "#766087", [[13, -27], [x, y], [x + 27, y - 21], [x + 24, y + 18]]);
    shards(c, x, y, lift, specter, .43);
  }
  if (spec.leap && f.airborne && f.vy > 3) {
    for (let i = 0; i < 7; i++) {
      c.fillStyle = dust[i % dust.length];
      c.fillRect(-44 + i * 15, -135 - (clock * 7 + i * 17) % 70, 2, 18 + i);
    }
  }
  if (spec.leap && f.omnitrix?.landingStrike && phase <= 14)
    groundPulse(c, 0, 0, phase, m.box.w / 2, dust);
  if (spec.effect === "storm" && phase >= -6 && phase < 11) {
    const origins = stormTips.length ? stormTips : [{ x: 21, y: -127 }];
    for (const [i, tip] of origins.entries()) {
      if (phase < 0) chargedSphere(c, tip.x, tip.y, 3 + Math.floor((phase + 6) / 2), 1, clock, false);
      else {
        const meet = { x: 21, y: -234 };
        arc(c, tip, meet, clock + i, 3, electric);
        if (i === 0) arc(c, meet, { x: 48, y: -620 }, clock, f.moveId.endsWith("medium") ? 5 : 3, electric);
      }
    }
    if (phase >= 3) for (const side of [-1, 1])
      arc(c, { x: 40, y: -416 }, { x: 90 + side * 115, y: -600 }, clock + side, 3, electric);
  }
  if (phase > m.active + 5 && !spec.cable) return;
  c.save();
  if (spec.effect === "ice" && phase >= -4 && (spec.cold || spec.aerialMotion)) {
    const at = spec.field?.offset ?? (m.box.w ? m.box.x + m.box.w * .65 : -30);
    const y = spec.field ? -spec.field.height : m.box.w ? m.box.y + m.box.h * .65 : -28;
    shards(c, at, y, Math.max(0, phase) % 8, cold, .5);
  }
  if (spec.effect === "thermal" && spec.technique && phase >= -6) {
    const field = spec.field;
    const x = field?.offset ?? (m.box.w ? m.box.x + m.box.w * .55 : 15);
    const y = field ? -field.height : -94;
    if (phase < 0 || !field) shards(c, x, y, Math.max(0, phase) % 8, hot, .72);
    if (!field && phase >= 0 && m.box.w && spec.technique !== "thermal") {
      const spread = Math.min(m.box.w * .47, 20 + phase * 8);
      for (const direction of [-1, 1]) {
        polygon(c, "#ee784c", [[x, y], [x + spread * direction, y - 16],
          [x + spread * direction, y + 15], [x, y + 5]]);
        pixelLine(c, [{ x, y: y + 4 }, { x: x + spread * direction, y }], "#fff6b2", 3);
      }
    }
  }
  if (spec.effect === "spectral" && f.benPhase) {
    shards(c, -18, -83, clock % 8, specter, .68);
  }
  if (spec.effect === "speed" || spec.effect === "step") {
    const moving = Math.abs(f.vx) > 4;
    for (let i = 0; moving && i < 5; i++) {
      c.fillStyle = cold[1 + i % 3];
      c.fillRect(-48 - ((clock + i * 13) % 53) * Math.sign(f.vx * f.facing), -20 - i * 18, 17 + i * 8, 2);
    }
  }
  if ((spec.effect === "tail" || spec.effect === "wind") && phase >= -2) {
    const spin = spec.effect === "wind";
    const cycles = spin && f.moveId.endsWith("medium") ? 3 : spin ? 2 : 1;
    const trail = f.omnitrix?.active === "humungousaur" ? dust : cold;
    for (let i = 0; i < cycles; i++) {
      const height = spin ? -29 - i * 30 : m.box.y + 13;
      const r = spin ? 49 + 12 * i : Math.round(m.box.w * .56);
      for (let j = 0; j < 14; j++) {
        const a = (clock * .22 + j * .16 + i * 2) % (Math.PI * 2);
        c.fillStyle = trail[(i + j) % trail.length];
        c.fillRect((Math.cos(a) * r + (spin ? 8 : 49)) | 0, (height + Math.sin(a) * (14 + i * 3)) | 0, 8, 3);
      }
    }
    if (spin) shards(c, 17, -4, Math.max(0, phase), dust, .75);
  }
  if ((spec.effect === "power" || spec.effect === "colossus") && m.drive && Math.abs(f.vx) > 1)
    shards(c, -29, -8, Math.max(0, phase), dust, .75);
  if (spec.effect === "fireball" && phase <= 0)
    fire(c, spec.field!.offset - 12, -spec.field!.height, Math.min(spec.field!.width, 4 + Math.floor(f.stateFrame * 1.1)), 1, clock);
  if (spec.effect === "flame" && phase >= -1 && phase < m.active)
    fire(c, m.box.x + m.box.w - 10, m.box.y + m.box.h * .6, 8, 1, clock);
  if (spec.effect === "boost" && phase >= -2)
    for (let i = 0; i < 4; i++) fire(c, -28 - i * 15, -9 - i * 6 + (f.vy < 0 ? i * 14 : 0), 9 - i, 1, clock + i * 2);
  if (spec.grow && phase < 0 && phase >= -9)
    shards(c, 0, -13, 9 + phase, dust, 1.2);

  if (spec.technique === "conductor" && phase >= 0 && phase < m.active)
    for (const { a, b } of feedbackConductorContact(m, f.stateFrame))
      arc(c, a, { x: b.x + 3, y: b.y - 3 }, clock, 4, electric);
  if (f.moveId === "feedback_counter" && phase < 6)
    pulse(c, 66, -102, 51, 12 + phase, 1, clock, 0);
  if (spec.field?.type === "bolt" && phase >= -8 && phase < 0) {
    const charged = (f.omnitrix?.charge ?? 0) >= (spec.field.energy === 2 ? 50 : 25);
    chargedSphere(c, spec.field.offset - 8, -spec.field.height, 3 + (8 + phase) * .9, 1, clock, charged);
  }
  if (spec.absorb && phase >= 0 && phase < m.active) {
    const radius = spec.absorb === 2 ? 28 : 17;
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI / 5 + clock * .19;
      c.fillStyle = electric[i % electric.length];
      c.fillRect(Math.round(34 + Math.cos(a) * radius), Math.round(-100 + Math.sin(a) * radius), 4, 3);
    }
  }
  if (spec.effect === "electric" && !spec.absorb && !spec.cable && phase >= -5 && phase < m.active)
    shards(c, spec.field?.offset ?? m.box.x + m.box.w - 13, -(spec.field?.height ?? -m.box.y) + 8, Math.max(0, phase + 1), electric, .45);
  if (spec.effect === "crystal" && !spec.field && phase >= 0 && phase < m.active)
    shards(c, m.box.x + m.box.w - 12, m.box.y + 12, phase, crystal, .35);
  c.restore();
}

function arc(c: CanvasRenderingContext2D, from: Point, to: Point, tick: number, width: number, palette: string[]) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const points = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const bend = i === 0 || i === 12 ? 0 : ((i * 29 + tick * 17) % 37 - 18);
    return { x: from.x + dx * t - dy * bend / length, y: from.y + dy * t + dx * bend / length };
  });
  pixelLine(c, points, palette[2], width + 6);
  pixelLine(c, points, palette[1], width + 2);
  pixelLine(c, points, palette[0], width);
  for (const i of [3, 6, 9]) {
    const at = points[i];
    const end = { x: at.x + (i % 2 ? 32 : -41), y: at.y + (i % 2 ? -28 : 27) };
    pixelLine(c, [at, { x: (at.x + end.x) / 2, y: at.y + 8 }, end], palette[1], 2);
  }
}

function groundPulse(c: CanvasRenderingContext2D, x: number, y: number, age: number, range: number, colors: string[]) {
  const width = Math.max(5, Math.min(range, (age + 1) * 12));
  for (const d of [-1, 1]) {
    polygon(c, colors[2], [[x, y], [x + d * width * .75, y - 10], [x + d * width, y - 3], [x, y + 3]]);
    pixelLine(c, [{ x, y: y - 1 }, { x: x + d * width * .87, y: y - 6 }], colors[0], 2);
  }
  shards(c, x, y - 5, age, colors, .67);
}

function prop(c: CanvasRenderingContext2D, textures: BenTextures, name: keyof typeof reform.props,
  frame: number, x: number, y: number, scaleX = 1, scaleY = scaleX, tilt = 0) {
  const { sheet, w, h } = reform.props[name];
  const image = textures.get(sheet);
  if (!image?.naturalWidth) return;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(scaleX, scaleY);
  if (tilt) c.rotate(tilt);
  c.drawImage(image, frame * w, 0, w, h, -Math.round(w / 2), -Math.round(h / 2), w, h);
  c.restore();
}

export function drawHeldBenCar(c: CanvasRenderingContext2D, f: Fighter, textures: BenTextures) {
  if (f.state !== "attack" || f.move?.ben?.technique !== "car") return;
  const move = f.move;
  const slam = !!move.ben?.carSlam;
  const t = f.stateFrame;
  const end = move.startup;
  if (t >= end) {
    if (slam && t < end + 15) {
      prop(c, textures, "car", t < end + 6 ? 2 : 3, 97, -24);
      groundPulse(c, 97, 0, t - end, 77, dust);
    }
    return;
  }
  let x = 148 - 8 * t, y = -27, tilt = 0;
  if (t >= 5) {
    const lift = Math.min(1, (t - 5) / 6);
    x = 108 - 86 * lift;
    y = -27 - 167 * lift;
    tilt = -.28 * Math.sin(lift * Math.PI);
  }
  if (t >= end - (slam ? 4 : 5)) {
    const u = (t - (end - (slam ? 4 : 5))) / (slam ? 4 : 5);
    x = 22 + u * (slam ? 75 : 58);
    y = -194 + u * (slam ? 168 : 71);
    tilt = (slam ? .55 : -.21) * u;
  }
  prop(c, textures, "car", t < 5 ? 1 : 0, x, y, 1, 1, tilt);
}

export function drawBenGhostGround(c: CanvasRenderingContext2D, f: Fighter, tick: number) {
  const depth = benGhostDepth(f);
  if (!depth) return;
  c.save();
  c.globalAlpha = Math.min(.7, depth / 166);
  for (let i = 0; i < 4; i++) {
    const shift = (tick + i * 7) % 15;
    pixelLine(c, [{ x: -58 + shift, y: -4 - i }, { x: 43 - shift, y: -4 - i }],
      specter[i], i < 2 ? 2 : 3);
  }
  c.restore();
}

export function drawFeedbackGrip(c: CanvasRenderingContext2D, f: Fighter, match: Match, head: Point | undefined, effects: boolean) {
  const held = match.capture;
  const id = held?.ben?.moveId;
  if (!head || held?.attacker !== f.id || !id?.startsWith("conductor_")) return;
  const target = match.fighters[held.victim];
  const style = benGrabFor(f.benForm, id)!;
  const heavy = id.endsWith("medium");
  const relative = { x: (target.x - f.x) * f.facing, y: target.y - f.y };
  const hold = feedbackGripPaths(head, relative, held.tick, style.duration, heavy);
  const opener = benObjectMove(id);
  const from = held.ben?.contactFrame;
  const latch = Math.min(held.tick / (heavy ? 5 : 3), 1);
  const opening = opener && from !== undefined && latch < 1
    ? feedbackConductorPaths(opener, from, head) : undefined;
  const paths = opening ? hold.map((path, side) => path.map((p, i) => {
    const source = opening[side][i];
    return { x: source.x + (p.x - source.x) * latch, y: source.y + (p.y - source.y) * latch };
  })) : hold;
  const strikes = style.impacts ?? [style.hitTick];
  for (const [side, path] of paths.entries()) {
    const active = heavy || side === 1;
    const strike = heavy ? strikes[side] : strikes[0];
    const age = held.tick - strike;
    cable(c, path, match.frame, effects && active && age >= -1 && age <= 2);
    if (!effects || !active) continue;
    const chargeTime = heavy ? 8 : 6;
    if (age >= -chargeTime && age <= 2) {
      const end = Math.round((path.length - 1) * Math.min(1, (age + chargeTime) / chargeTime));
      const light = path.slice(Math.max(0, end - (heavy ? 14 : 9)), end + 1);
      pixelLine(c, light, "#d98731", heavy ? 6 : 4);
      pixelLine(c, light.map(p => ({ x: p.x, y: p.y - 1 })), "#fff7af", 2);
      if (light.length > 3) arc(c, light[0], light.at(-1)!, match.frame, heavy ? 11 : 6, electric);
    }
    const tip = path.at(-1)!;
    if (age >= 0 && age <= 3) {
      shards(c, tip.x + 6, tip.y, age + 1, electric, heavy ? .88 : .59);
      arc(c, tip, { x: relative.x + (side ? 12 : 17), y: tip.y + (side ? -15 : 17) },
        match.frame, heavy ? 15 : 8, electric);
    } else if (held.tick < 3) {
      shards(c, tip.x + 4, tip.y, held.tick, electric, .46);
    }
  }
}

const gravCore: Partial<Record<number, Point>> = stage7.gravattack.core;

export function drawStage7Core(c: CanvasRenderingContext2D, f: Fighter, frame: number, clock: number) {
  const core = f.omnitrix?.active === "gravattack" ? gravCore[frame] : undefined;
  if (!core) return;
  const cast = f.state === "attack" && f.moveId.startsWith("gravity");
  const size = cast ? 10 + Math.round(3 * Math.sin(clock * .31)) : 4;
  c.save();
  c.globalAlpha = cast ? .34 : .16 + Math.sin(clock * .12) * .08;
  c.fillStyle = "#ff544a";
  c.fillRect(core.x - size, core.y - 2, size * 2, 4);
  c.fillRect(core.x - 2, core.y - size, 4, size * 2);
  c.fillStyle = "#fff0bb";
  c.fillRect(core.x - 1, core.y - 1, 2, 2);
  c.restore();
}

export function drawEchoClones(c: CanvasRenderingContext2D, match: Match, textures: BenTextures, debug: boolean, effects: boolean) {
  for (const f of match.fighters) for (const clone of f.omnitrix?.echoClones ?? []) {
    const action = clone.action;
    const clip = clone.fading ? "cloneFade" : clone.age < 8 ? "cloneArrival" :
      action?.kind === "jab" ? "cloneJab" : action ? "cloneWave" : clone.moving ?
        (Math.sign(f.x + (clone.slot === 0 ? -65 : 76) * f.facing - clone.x) === clone.facing ? "walkForward" : "walkBack") : "idle";
    cloneAnimator.update(clip);
    cloneAnimator.seekTick(clone.fading ? 9 - clone.fading : action ? action.tick + 1 : clone.age + clone.slot * 5);
    const sprite = cloneAnimator.sprite();
    const image = textures.get(sprite.sheet);
    if (!image) continue;
    c.save();
    c.translate(Math.round(clone.x), FLOOR);
    c.scale(clone.facing * sprite.scale, sprite.scale);
    c.globalAlpha = .86 * Math.min(1, (clone.age + 2) / 8, clone.fading ? clone.fading / 9 : 1);
    c.drawImage(image, sprite.x, sprite.y, sprite.width, sprite.height,
      -sprite.pivot.x, -sprite.pivot.y, sprite.width, sprite.height);
    c.restore();
    if (effects && (clone.fading || clone.age < 8)) {
      c.save();
      const age = clone.fading ? 9 - clone.fading : clone.age;
      c.globalAlpha = .7 * (1 - age / 10);
      c.strokeStyle = sonic[1];
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(Math.round(clone.x), FLOOR - 49, 10 + age * 3, 19 + age * 3, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (debug) {
      const box = echoCloneHurtbox(clone, FLOOR);
      c.save();
      c.strokeStyle = sonic[2];
      c.strokeRect(box.x, box.y, box.w, box.h);
      c.restore();
    }
  }
}

function drawGravityRock(c: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.rotate(angle);
  const r = radius;
  polygon(c, "#382331", [[-r, 1], [-r * .55, -r * .78], [r * .44, -r], [r, -r * .11], [r * .56, r * .77], [-r * .4, r]]);
  polygon(c, "#ad634b", [[-r * .67, -.5], [-r * .4, -r * .63], [r * .38, -r * .78],
    [r * .68, -r * .23], [r * .15, r * .34]]);
  polygon(c, "#6e3942", [[-r * .69, r * .13], [r * .12, r * .35], [r * .69, -r * .19],
    [r * .41, r * .66], [-r * .32, r * .74]]);
  c.restore();
}

export function drawBenFields(c: CanvasRenderingContext2D, match: Match, debug: boolean, textures: BenTextures) {
  c.save();
  for (const f of match.fighters) for (const obj of f.omnitrix?.objects ?? []) {
    const field = benObjectMove(obj.id)?.ben?.field;
    if (!field || obj.age <= 0) continue;
    const { x, y, age } = obj;
    if (field.type === "car") {
      const scale = obj.scale ?? 1;
      const impact = obj.impactAge;
      prop(c, textures, "car", impact === undefined ? 0 : impact < 6 ? 2 : 3,
        x, y, obj.direction * scale, scale, impact === undefined ? Math.max(-.28, Math.min(.36, (obj.vy ?? 0) / 22)) : 0);
      if (impact !== undefined) groundPulse(c, x, y + 20, impact, 86, dust);
    }
    if (field.type === "lightning" && field.activeAge) {
      const [start, end] = field.activeAge;
      if (age < start) {
        c.save();
        c.globalAlpha = .25 + age / start * .65;
        groundPulse(c, x, y, age, field.width / 2, electric);
        c.restore();
      } else if (age < end + 5) {
        c.save();
        c.globalAlpha = Math.max(.12, Math.min(1, (end + 5 - age) / 5));
        arc(c, { x: x - 16, y: 0 }, { x, y }, age, field.width * .24, electric);
        groundPulse(c, x, y, age - start, field.width * .62, electric);
        c.restore();
      }
    }
    if (field.type === "spectralHand" && field.activeAge) {
      const [start, end] = field.activeAge;
      const airborne = !!obj.vy;
      c.save();
      if (!airborne) {
        groundPulse(c, x, y - 2, age, field.width * .52, specter);
        c.beginPath(); c.rect(x - 73, y - 154, 146, 154); c.clip();
      }
      const scale = airborne ? .84 : Math.min(1, field.height / 90);
      const height = airborne ? 0 : Math.min(field.height * .5, age / start * field.height * .5);
      c.globalAlpha = Math.max(.16, Math.min(1, age / start + .15, (field.life - age) / (field.life - end)));
      prop(c, textures, "hands", airborne ? (obj.direction > 0 ? 2 : 3) : (field.width < 54 ? 0 : 1),
        x, y - height + (airborne ? 0 : age < start ? 18 : 0), (airborne ? 1 : obj.direction) * scale, scale);
      c.restore();
    }
    if (field.type === "gravityStone") {
      const radius = field.width;
      const launched = age >= gravityStoneLaunch(obj);
      if (age < 11) {
        c.strokeStyle = "#442c39";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 22, FLOOR);
        c.lineTo(x - 8, FLOOR - 3);
        c.lineTo(x + 3, FLOOR + 2);
        c.lineTo(x + 15, FLOOR - 4);
        c.lineTo(x + 25, FLOOR);
        c.stroke();
      }
      if (launched) {
        const tail = x - obj.direction * radius * 2.9;
        polygon(c, gravity[3], [[tail, y + 2], [x, y - radius * .48], [x, y + radius * .52]]);
      }
      drawGravityRock(c, x, y, radius, age * .17 * obj.direction);
    }
    if (field.type === "gravityWell" || field.type === "gravityPulse") {
      const well = field.type === "gravityWell";
      const progress = well ? Math.min(1, age / 11) : Math.min(1, age / 4);
      c.save();
      c.globalAlpha = well ? Math.min(.74, (field.life - age) / 15) : Math.max(.12, (field.life - age) / field.life);
      groundPulse(c, x, y, age % 19, field.width * .5 * progress, gravity);
      const stroke = (index: number) => {
        const phase = (age * .09 + index * .38) % 1;
        const p = well || field.gravityMode === "pull" ? 1 - phase : phase;
        const span = field.width * (.16 + .31 * p) * progress;
        const altitude = field.height * (.12 + .75 * index / 4);
        c.strokeStyle = gravity[index % gravity.length];
        c.lineWidth = index === 0 ? 3 : 1;
        c.beginPath();
        c.ellipse(Math.round(x), Math.round(y - altitude), Math.max(1, span), 3 + span * .1, 0, index * .8, index * .8 + Math.PI * 1.6);
        c.stroke();
        if (well) {
          const angle = age * (.07 + index * .012) + index * 2.2;
          c.fillStyle = gravity[index % 2];
          c.fillRect(Math.round(x + Math.cos(angle) * span), Math.round(y - altitude + Math.sin(angle) * 9), 3, 3);
        }
      };
      for (let i = 0; i < (well ? 5 : 3); i++) stroke(i);
      if (well || field.gravityMode === "pull") {
        const heavy = !well && field.height > 150;
        const centerX = !well && !heavy ? f.x + 36 * f.facing : x;
        const centerY = y - (heavy ? 89 : 58);
        for (let i = 0; i < (heavy || well ? 5 : 3); i++) {
          const orbit = age * (well ? .13 : .51) + i * 1.72;
          const lift = Math.min(1, Math.max(0, (age - i * .6) / (well ? 22 : 5)));
          const collapse = heavy ? Math.min(1, (field.life - age) / 6) : 1;
          const span = (well ? 97 : heavy ? 74 : 59) * collapse;
          drawGravityRock(c, centerX + Math.cos(orbit) * span * (.7 + i * .08),
            y + (centerY - y) * lift + Math.sin(orbit) * (well ? 22 : 17) * lift,
            4 + i % 3, orbit);
        }
      }
      c.restore();
    }
    if ((field.type === "sonic" || field.type === "sonicAssist") && !obj.spent) {
      const radius = field.width;
      const length = benBoltLength(obj, field);
      c.save();
      for (let i = 2; i >= 0; i--) {
        c.strokeStyle = sonic[i];
        c.globalAlpha = 1 - i * .23;
        c.lineWidth = i === 0 ? 2 : 3;
        c.beginPath();
        c.ellipse(Math.round(x - obj.direction * i * length / 3), Math.round(y),
          Math.max(2, radius * (.32 - i * .06)), radius * (1 - i * .22), 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
    if (field.type === "fireball") fire(c, x, y, field.width, obj.direction, age);
    if (field.type === "pillar") {
      for (let h = 0; h < field.height; h += 5) {
        const width = Math.max(3, field.width * (1 - h / field.height * .56));
        const offset = Math.sin(age * .7 + h * .09) * width * .18;
        c.fillStyle = hot[2 + ((h + age) % 3 === 0 ? 1 : 0)];
        c.fillRect(Math.round(x + offset - width / 2), y - h - 5, Math.round(width), 5);
        c.fillStyle = h % 15 ? hot[1] : hot[0];
        c.fillRect(Math.round(x + offset - width / 4), y - h - 5, Math.round(width / 2), 4);
      }
      shards(c, x, y - 9, age, hot, .8);
    }
    if (field.type === "quake") {
      for (let i = 0; i < 6; i++) {
        const px = Math.round(x - field.width / 2 + i * field.width / 6);
        const h = Math.round(field.height * (.36 + ((age * 3 + i * 7) % 11) / 19));
        c.fillStyle = dust[i % dust.length];
        c.fillRect(px, y - h, 4 + i % 2, h);
        c.fillRect(px - 3, y - 5, 12, 2);
      }
      shards(c, x, y - 16, age, dust, .63);
    }
    if (field.type === "spikes" || field.type === "wall") {
      const height = benObjectHeight(obj, field);
      const crumbling = field.type === "wall" ? obj.spent || age >= field.life - 7 : age >= field.life - 6;
      if (crumbling) shards(c, x, y - height * .45, 8 - Math.max(0, field.life - age), crystal, .86);
      else {
        facet(c, x - field.width * .29, y, field.width * .42, height * .62, -field.width * .06);
        facet(c, x + field.width * .27, y, field.width * .44, height * .79, field.width * .08);
        facet(c, x, y, field.width * .53, height, field.width * .12 * obj.direction);
      }
    }
    if (field.type === "shard" && !obj.spent) {
      const tip = x + obj.direction * field.width;
      polygon(c, crystal[3], [[tip, y], [x, y - 6], [x - obj.direction * 11, y - 3], [x - obj.direction * 9, y + 5], [x, y + 6]]);
      polygon(c, crystal[1], [[tip - obj.direction, y], [x, y - 5], [x - obj.direction * 10, y - 2], [x, y + 2]]);
    }
    if (field.type === "heat")
      pulse(c, x, y, benBoltLength(obj, field), field.width, obj.direction, age, 0);
    if (field.type === "frost") {
      const length = benBoltLength(obj, field);
      const back = x - obj.direction * length, width = field.width;
      polygon(c, "#559fbd", [[back, y], [x, y - width], [x + obj.direction * width, y],
        [x, y + width], [back, y + 4]]);
      polygon(c, cold[0], [[back, y + 2], [x, y - width * .52], [x + obj.direction * width * .66, y], [x, y + width * .4]]);
      for (let i = 0; i < 7; i++)
        facet(c, x - obj.direction * (i * length / 7), y + ((age + i * 9) % 21 - 10), 5 + i % 3, 7 + i % 5, 2);
    }
    if (field.type === "beam") {
      const beam = benObjectShape(obj, field);
      if ("a" in beam) {
        const { a, b, r } = beam;
        const palette = f.omnitrix?.active === "feedback" ? electric : hot;
        polygon(c, palette[3], [[a.x, a.y - r], [b.x, b.y - r * .72],
          [b.x, b.y + r], [a.x, a.y + r * .72]]);
        polygon(c, palette[1], [[a.x, a.y - r * .52], [b.x, b.y - r * .5],
          [b.x, b.y + r * .47], [a.x, a.y + r * .43]]);
        arc(c, a, b, age, obj.power ? 5 : 3, palette);
        if (palette === hot && b.y >= 579) {
          groundPulse(c, b.x, b.y, age % 6, r * 2.5, hot);
          shards(c, b.x, b.y - 7, age % 5, dust, .48);
        }
      }
    }
    if (field.type === "bolt") {
      const radius = field.width + Math.floor((obj.power ?? 0) / 10);
      if (obj.id === "discharge_light") chargedSphere(c, x, y, radius, obj.direction, age, !!obj.power);
      else pulse(c, x, y, benBoltLength(obj, field), radius, obj.direction, age, obj.power ?? 0);
    }
    if (debug && !obj.spent) {
      const b = shapeBounds(benObjectShape(obj, field));
      c.strokeStyle = "#f57550";
      c.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
  c.restore();
}

export function drawBenContact(c: CanvasRenderingContext2D, match: Match) {
  c.save();
  for (const e of match.events) {
    if (!e.ben) continue;
    const palette = ["speed", "tail", "wind", "step", "ice"].includes(e.ben) ? cold :
      e.ben === "spectral" || e.ben === "nightmare" ? specter :
      e.ben === "metal" ? ["#fff5d4", "#ffc86b", "#becfce", "#596a72"] :
      e.ben === "gravity" ? gravity : e.ben === "sonic" ? sonic :
      e.ben === "crystal" ? crystal : e.ben === "electric" || e.ben === "storm" ? electric :
      e.ben === "power" || e.ben === "quake" || e.ben === "colossus" ? dust : hot;
    const age = (e.total ?? 16) - e.life;
    if (age > 10) continue;
    c.globalAlpha = Math.max(0, 1 - age / 12);
    shards(c, e.x, e.y, age, palette);
  }
  c.restore();
}

