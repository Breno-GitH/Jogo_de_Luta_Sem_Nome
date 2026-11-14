import { pandemoniumBeats as beats, pandemoniumEase as ease, type pandemoniumScene } from "../engine/xebec-pandemonium";
import { pandemoniumBladeClips, pandemoniumPrelude } from "../engine/xebec-pandemonium-acts";
import { hakiBolt, hakiBurst } from "./xebec-haki-fx";

type Scene = ReturnType<typeof pandemoniumScene>;
const point = (x: number, y: number) => ({ x, y });
const anchors = {
  pandemoniumOpening: [
    [-34,-72,-100,-36], [57,-84,126,-84], [-9,-128,-73,-161], [31,-52,87,-8],
    [-32,-70,-102,-67], [29,-106,90,-120], [-6,-39,75,-4], [50,-149,112,-186],
  ],
  pandemoniumDescent: [
    [14,-100,14,-153], [23,-102,21,-153], [31,-107,17,-166], [12,-146,-69,-139],
    [5,-143,55,-114], [44,-78,103,-35], [47,-37,87,-5], [27,-83,77,-102],
  ],
} as const;

function bladeAt(p: Scene["attacker"]) {
  const clip = p.clip;
  if (clip !== "pandemoniumOpening" && clip !== "pandemoniumDescent") return;
  let tick = p.tick;
  const durations = pandemoniumBladeClips[clip].durations;
  let cel = 0;
  while (cel < durations.length - 1 && tick >= durations[cel]) tick -= durations[cel++];
  const [x, y, tx, ty] = anchors[clip][cel];
  return { grip: point(x, y), tip: point(tx, ty) };
}

export function drawPandemoniumBlade(c: CanvasRenderingContext2D, t: number, scene: Scene) {
  const actor = scene.attacker;
  const blade = bladeAt(actor);
  const age = t - beats.cut;
  if (age >= 55) return;
  if (blade) {
    const preparation = ease(t, beats.uppercut + 12, beats.cut);
    c.save();
    c.translate(actor.x, actor.y);
    c.scale(actor.facing, 1);
    c.globalAlpha = .58 + .38 * preparation;
    hakiBolt(c, t, 61, blade.grip, blade.tip, 3 + preparation * 3);
    if (t >= beats.apex && t < beats.cut) {
      hakiBolt(c, t, 52, point(-28, -107), blade.grip, 3.5);
      hakiBolt(c, t, 67, point(36, -96), blade.grip, 3);
      hakiBolt(c, t, 85, blade.tip, point(blade.tip.x - 52, blade.tip.y + 16), preparation * 3);
      for (let i = 0; i < 9; i++) {
        const x = (i * 73 + t * (i % 2 ? -3 : 3)) % 135;
        c.fillStyle = i % 3 ? "#a42b3c80" : "#ffe9c9a0";
        c.fillRect(x - 20, -3 + i % 3 * 3, 11 + i % 5 * 3, 1);
      }
    }
    const prelude = pandemoniumPrelude.find(hit => t >= hit.tick && t - hit.tick < 9);
    if (prelude) {
      const arcAge = t - prelude.tick;
      c.globalAlpha = 1 - arcAge / 9;
      const { grip, tip } = blade;
      const swing = prelude.angle === "horizontal" ? [-31,-132,116,-116] :
        prelude.angle === "diagonal" ? [35,-206,131,-57] :
        prelude.angle === "cross" ? [-13,-68,122,-149] : [113,-26,153,-166];
      c.beginPath();
      c.moveTo(grip.x, grip.y);
      c.quadraticCurveTo(swing[0], swing[1], tip.x, tip.y);
      c.quadraticCurveTo(swing[2], swing[3], tip.x + 14, tip.y + 4);
      c.quadraticCurveTo(swing[0] * .65, swing[1] * .82, grip.x, grip.y);
      c.closePath();
      c.fillStyle = "#170a1ce0";
      c.strokeStyle = "#f74b69";
      c.lineWidth = prelude.angle === "rising" ? 4 : 3;
      c.fill();
      c.stroke();
      hakiBolt(c, t, prelude.tick * 13, tip, point(swing[2], swing[3]), 3.5);
    }
    c.restore();
  }
  if (age < 0) return;

  // Anchor the afterimage to the blade at contact, then propagate it through
  // the arena. The artist's blade always keeps its own opaque silver edge.
  const x = scene.victim.x - actor.facing * Math.min(age, 28) * 1.8;
  const y = 483;
  c.save();
  c.globalAlpha = 1 - ease(age, 6, 53);
  if (age < 21) {
    c.globalAlpha *= .72;
    hakiBurst(c, t, point(x, y), 92 + age * 7, 6, 1629, 31);
    c.globalAlpha = 1 - ease(age, 6, 53);
  }
  c.translate(actor.x, actor.y);
  c.scale(actor.facing, 1);
  for (let i = 0; i < 3; i++) {
    const spread = age * (4.7 + i * 1.9);
    const base = 44 + spread;
    c.beginPath();
    c.moveTo(base - 27, -195 - i * 8);
    c.bezierCurveTo(base + 107, -155 - i * 14, base + 138, -68 + i * 7, base + 19, -27 + i * 8);
    c.quadraticCurveTo(base + 152, -16 + i * 4, base + 182 + i * 21, -48 - i * 11);
    c.quadraticCurveTo(base + 154, -126 - i * 6, base - 27, -195 - i * 8);
    c.fillStyle = ["#170915c4", "#74355253", "#aa6d7741"][i];
    c.fill();
    c.strokeStyle = ["#ed4668", "#a71e49", "#fbbda5"][i];
    c.lineWidth = 5 - i * 1.6;
    c.stroke();
  }
  for (let i = 0; i < 29; i++) {
    const px = 77 + i * 5 + age * (2 + i % 8 * .62);
    const py = -16 - (i * 13 % 79) - age * (2 + i % 5) + age * age * .132;
    c.fillStyle = ["#ffe6ae", "#ac2d55", "#502538"][i % 3];
    c.fillRect(Math.round(px), Math.round(py), 2 + i % 5, 1 + i % 3);
  }
  c.restore();
}
