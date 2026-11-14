import { pandemoniumBeats as beats, pandemoniumEase as ease, type PandemoniumState, type pandemoniumScene } from "../engine/xebec-pandemonium";
import { hakiBolt, hakiBurst } from "./xebec-haki-fx";

type Scene = ReturnType<typeof pandemoniumScene>;
type Assets = ReadonlyMap<string, HTMLImageElement>;

const captain = "xebec/captain-close.png";
const cleave = "xebec/pandemonium-cleave.png";
const ready = { newgate: "xebec/rocks-newgate.png", kaido: "xebec/rocks-kaido.png", linlin: "xebec/rocks-linlin.png" };
const crew = {
  newgate: { sheet: "xebec/newgate-intervention.png", scale: 1.06 },
  kaido: { sheet: "xebec/kaido-intervention.png", scale: 1 },
  linlin: { sheet: "xebec/linlin-intervention.png", scale: 1.045 },
};
export const pandemoniumActSheets = [captain, ...Object.values(crew).map(p => p.sheet)];

const point = (x: number, y: number) => ({ x, y });
const clamp = (a: number) => Math.max(0, Math.min(1, a));

export function drawRocksInterventions(c: CanvasRenderingContext2D, t: number, scene: Scene, assets: Assets) {
  for (const actor of scene.rocks) {
    if (actor.opacity <= 0) continue;
    const { sheet, scale } = crew[actor.member];
    const group = t >= beats.regroup;
    const image = assets.get(group ? ready[actor.member] : sheet);
    if (!image) continue;
    c.save();
    c.globalAlpha *= actor.opacity;
    c.fillStyle = "#0007";
    c.beginPath();
    c.ellipse(actor.x, 584, actor.y >= 570 ? 49 : 28, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(Math.round(actor.x), Math.round(actor.y));
    c.scale(actor.facing * scale, scale);
    const cel = group ? 3 : actor.cel;
    c.drawImage(image, cel % 4 * 320, Math.floor(cel / 4) * 320, 320, 320, -160, -288, 320, 320);
    c.restore();
  }
}

const blade = [
  [-20, -61, 62, -59], [11, -88, 76, -122], [-2, -101, 53, -153], [-26, -139, -79, -129],
  [41, -86, 91, -40], [61, -83, 122, -67], [2, -43, 101, -6], [6, -96, 86, -136],
];
function bladeAt(t: number) {
  const cel = t < 19 ? 0 : t < 64 ? 1 : t < 96 ? 2 : t < 148 ? 3 :
    t < beats.cut ? 5 : t < 167 ? 4 : t < 189 ? 6 : 7;
  return blade[cel];
}

function pressure(c: CanvasRenderingContext2D, x: number, y: number, facing: number, age: number, palette: readonly string[]) {
  for (let i = 0; i < palette.length; i++) {
    const spread = 25 + age * (7 + i * 2.9);
    const lift = 35 + (i + 1) * age * 2;
    c.strokeStyle = palette[i];
    c.lineWidth = 2 + i;
    c.beginPath();
    c.moveTo(x + facing * (spread * .47), y - lift);
    c.bezierCurveTo(x + facing * spread * 1.4, y - lift * .78,
      x + facing * spread * 1.27, y + lift * .39, x + facing * spread * .8, y + lift * .73);
    c.stroke();
  }
}

function drawCleave(c: CanvasRenderingContext2D, s: PandemoniumState, scene: Scene) {
  const t = s.tick, a = scene.attacker, age = t - beats.cut;
  if (t < 25 || age >= 55) return;
  c.save();
  c.translate(a.x, a.y);
  c.scale(a.facing, 1);
  const [gx, gy, tx, ty] = bladeAt(t);
  if (age < 14) {
    const charge = ease(t, 38, 136);
    c.globalAlpha = .38 + charge * .62;
    hakiBolt(c, t, 361, point(gx, gy), point(tx, ty), 3 + charge * 4);
    if (t > 82) {
      hakiBolt(c, t, 52, point(-28, -119), point(gx, gy), 5);
      hakiBolt(c, t, 67, point(36, -95), point(gx, gy), 4);
      if (t > 122) hakiBurst(c, t, point(tx, ty), 68 + charge * 39, 5, 802);
    }
  }
  if (age >= -6 && age < 22) {
    c.globalAlpha = clamp((22 - age) / 18);
    const extension = 57 + Math.max(0, age) * 5;
    c.beginPath();
    c.moveTo(gx, gy);
    c.quadraticCurveTo(102, -236, 155 + extension, -181 + age * 4);
    c.quadraticCurveTo(213 + extension, -106, 112 + extension * .68, -40 + age * 1.4);
    c.lineTo(72 + extension * .32, -11 + age * .66);
    c.quadraticCurveTo(171 + extension, -117, gx, gy);
    c.fillStyle = "#11091643";
    c.strokeStyle = "#ff375e";
    c.lineWidth = 4;
    c.fill();
    c.stroke();
    hakiBolt(c, t, 541, point(tx, ty), point(124 + extension, -116 + age * 3), 8);
    hakiBolt(c, t, 574, point(tx, ty), point(70 + extension, -18 + age), 6);
  }
  if (age >= 0) {
    c.globalAlpha = (1 - ease(age, 11, 55)) * .75;
    pressure(c, 109, -86, 1, age, ["#f4dabc99", "#b5486885", "#d9a2af70"]);
    for (let i = 0; i < 21; i++) {
      const x = 79 + i * 4 + age * (1.5 + i % 7 * .72);
      const y = -12 - (i * 13 % 68) - age * (1.9 + i % 5) + age * age * .13;
      c.fillStyle = ["#ffa28b", "#982948", "#4e354b"][i % 3];
      c.fillRect(Math.round(x), Math.round(y), 2 + i % 4, 1 + i % 3);
    }
  }
  c.restore();
}

function drawRedirection(c: CanvasRenderingContext2D, s: PandemoniumState, scene: Scene) {
  const t = s.tick, f = s.facing, v = scene.victim;
  const quake = t - beats.quake, club = t - beats.club, soul = t - beats.soul;
  const linlin = scene.rocks.find(p => p.member === "linlin");
  c.save();
  if (quake >= -3 && quake < 25) {
    c.globalAlpha = 1 - ease(quake, 4, 25);
    const newgate = scene.rocks.find(actor => actor.member === "newgate");
    const height = v.y - 91, x = newgate ? newgate.x + f * 100 : v.x - f * 22;
    for (let i = 0; i < 6; i++) {
      const s = f * (i % 2 === 0 ? 1 : -1);
      c.beginPath();
      c.moveTo(x, height);
      c.lineTo(x + s * (30 + i * 7), height - 54 + i * 19);
      c.lineTo(x + s * (48 + i * 7), height - 32 + i * 24);
      c.lineTo(x + s * (89 + i * 6), height - 65 + i * 30);
      c.strokeStyle = i % 2 ? "#b0e8fc" : "#f3fcff";
      c.lineWidth = i % 3 ? 2 : 4;
      c.stroke();
    }
    pressure(c, x, height + 13, f, Math.max(quake, 0), ["#cff4ff", "#9ac1e9ab", "#e0f6ff75"]);
  }
  if (club >= -7 && club < 21) {
    c.globalAlpha = 1 - ease(club, 3, 21);
    const x = v.x + f * 28, y = v.y - 105;
    for (let i = 0; i < 8; i++) {
      const shift = i * 11;
      c.fillStyle = ["#2d354b", "#e9e5e6", "#b2bac7"][i % 3];
      c.beginPath();
      c.moveTo(x + f * (64 + shift), y - 130 - shift);
      c.lineTo(x - f * (57 + shift), y + 40 - shift);
      c.lineTo(x - f * (86 + shift), y + 48 - shift);
      c.closePath();
      c.fill();
    }
    pressure(c, x, y, -f, Math.max(0, club), ["#e8d9bca0", "#a7b3c689"]);
  }
  if (linlin && soul >= -22 && soul < 35) {
    const progress = ease(soul, -22, 4);
    c.globalAlpha = clamp((35 - soul) / 20);
    const hand = linlin.cel === 3 ? [68, -167] : linlin.cel === 4 ? [39, -126] : linlin.cel === 6 ? [104, -137] : [94, -146];
    const pivot = point(linlin.x + f * hand[0], linlin.y + hand[1]);
    const x = pivot.x + (v.x - pivot.x) * progress, y = pivot.y + (v.y - 101 - pivot.y) * progress;
    const orb = 16 + progress * 24;
    const light = c.createRadialGradient(x, y, 1, x, y, 3 * orb);
    light.addColorStop(0, "#fff7aa8c");
    light.addColorStop(.44, "#ff9d4473");
    light.addColorStop(1, "#e74c1100");
    c.fillStyle = light;
    c.fillRect(x - orb * 3, y - orb * 3, orb * 6, orb * 6);
    c.strokeStyle = "#f9b354";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(pivot.x, pivot.y);
    c.quadraticCurveTo((pivot.x + x) / 2, y - 72, x, y);
    c.stroke();
    c.fillStyle = "#ffc153";
    c.beginPath();
    c.moveTo(x - orb, y + orb * .15);
    c.quadraticCurveTo(x - orb, y - orb * .6, x - orb * .17, y - orb);
    c.lineTo(x + orb * .17, y - orb * .43);
    c.lineTo(x + orb * .73, y - orb * .84);
    c.quadraticCurveTo(x + orb * 1.09, y - orb * .2, x + orb * .88, y + orb * .46);
    c.quadraticCurveTo(x, y + orb * .88, x - orb, y + orb * .15);
    c.fill();
    c.fillStyle = "#441f36";
    c.fillRect(x - orb * .48, y - orb * .37, 6, 5);
    c.fillRect(x + orb * .17, y - orb * .37, 6, 5);
    c.fillRect(x - orb * .2, y, orb * .42, 5);
    if (soul >= 0) pressure(c, x, y, f, soul, ["#fff6bc", "#c45c9bbb", "#ff9a5185"]);
  }
  c.restore();
}

export function drawPandemoniumActsFx(c: CanvasRenderingContext2D, s: PandemoniumState, scene: Scene) {
  drawCleave(c, s, scene);
  drawRedirection(c, s, scene);
}

export function drawPandemoniumActsScreen(c: CanvasRenderingContext2D, s: PandemoniumState, assets: Assets) {
  const t = s.tick, f = s.facing;
  const face = ease(t, 11, 23) * (1 - ease(t, 52, 68));
  const weapon = ease(t, 53, 70) * (1 - ease(t, 90, 106));
  const source = face >= weapon ? assets.get(captain) : assets.get(cleave);
  const alpha = Math.max(face, weapon);
  if (source && alpha) {
    c.save();
    c.globalAlpha *= alpha;
    const light = c.createLinearGradient(150, 30, 1130, 680);
    light.addColorStop(0, "#191221");
    light.addColorStop(.55, "#583041");
    light.addColorStop(1, "#191220");
    c.fillStyle = light;
    c.fillRect(0, 0, 1280, 720);
    c.translate(640, 0);
    c.scale(f, 1);
    if (face >= weapon) {
      const cel = t >= 41 ? 2 : t >= 31 ? 1 : 0;
      const dolly = ease(t, 11, 58) * 66;
      c.drawImage(source, cel * 384, 0, 384, 384, -330 - dolly * .63, 66 - dolly, 640 + dolly, 640 + dolly);
    } else {
      const cel = t < 79 ? 1 : 2;
      c.drawImage(source, cel * 256 + 105, 23, 132, 119, -358, 104, 756, 574);
      hakiBolt(c, t, 115, point(-100, 477), point(340, 141), 7);
    }
    c.restore();
  }
  const passage = ease(t, beats.passage + 3, beats.gates);
  if (passage) {
    c.save();
    c.globalAlpha *= passage * .28;
    const fog = c.createLinearGradient(s.facing > 0 ? 690 : 590, 0, s.facing > 0 ? 1280 : 0, 0);
    fog.addColorStop(0, "#8da2c400");
    fog.addColorStop(1, "#8da2c4");
    c.fillStyle = fog;
    c.fillRect(0, 0, 1280, 720);
    c.restore();
  }
  const bars = ease(t, 5, 22);
  c.fillStyle = "#08070d";
  c.fillRect(0, 0, 1280, 41 * bars);
  c.fillRect(0, 720 - 50 * bars, 1280, 50 * bars);
}
