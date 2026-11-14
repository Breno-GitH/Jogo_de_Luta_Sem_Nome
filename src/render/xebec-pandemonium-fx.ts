import { pandemoniumBeats as beats, pandemoniumEase as ease, type PandemoniumState, type pandemoniumScene } from "../engine/xebec-pandemonium";
import { drawPandemoniumBlade } from "./xebec-pandemonium-blade";
import { drawPrometheus, drawPrometheusLight, prometheusSheet } from "./xebec-prometheus";

type Scene = ReturnType<typeof pandemoniumScene>;
type Assets = ReadonlyMap<string, HTMLImageElement>;

const ready = { newgate: "xebec/rocks-newgate.png", kaido: "xebec/rocks-kaido.png", linlin: "xebec/rocks-linlin.png" };
const crew = {
  newgate: { sheet: "xebec/newgate-intervention.png", scale: 1.06 },
  kaido: { sheet: "xebec/kaido-intervention.png", scale: 1 },
  linlin: { sheet: "xebec/linlin-command.png", scale: 1.045 },
};
export const pandemoniumActSheets = [prometheusSheet, ...Object.values(crew).map(p => p.sheet)];

export function drawRocksInterventions(c: CanvasRenderingContext2D, t: number, scene: Scene, assets: Assets, effects: boolean) {
  if (effects && scene.prometheus) drawPrometheusLight(c, scene.prometheus);
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
  const image = assets.get(prometheusSheet);
  if (scene.prometheus && image) drawPrometheus(c, scene.prometheus, image, effects, t);
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

function drawRedirection(c: CanvasRenderingContext2D, s: PandemoniumState, scene: Scene) {
  const t = s.tick, f = s.facing, v = scene.victim;
  const quake = t - beats.quake, club = t - beats.club;
  c.save();
  if (quake >= -3 && quake < 25) {
    c.globalAlpha = 1 - ease(quake, 4, 25);
    const newgate = scene.rocks.find(actor => actor.member === "newgate");
    const height = 380, x = newgate ? newgate.x + f * 130 : v.x - f * 22;
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
    if (quake >= 0) {
      c.strokeStyle = "#99e5f895";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(x, height, 11 + quake * 6.7, 19 + quake * 3.2, -.53 * f, 0, Math.PI * 2);
      c.stroke();
    }
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
  c.restore();
}

export function drawPandemoniumActsFx(c: CanvasRenderingContext2D, s: PandemoniumState, scene: Scene) {
  drawPandemoniumBlade(c, s.tick, scene);
  drawRedirection(c, s, scene);
}

export function drawPandemoniumActsScreen(c: CanvasRenderingContext2D, s: PandemoniumState) {
  const t = s.tick;
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
