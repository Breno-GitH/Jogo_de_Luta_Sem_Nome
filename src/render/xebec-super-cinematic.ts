import { pandemoniumBeats as beats, pandemoniumEase as ease, pandemoniumConfig, type pandemoniumScene } from "../engine/xebec-pandemonium";
import { hakiBolt, hakiBurst } from "./xebec-haki-fx";

type Scene = ReturnType<typeof pandemoniumScene>;
const close = "xebec/captain-close.png";
const gates = "xebec/justice-gates.webp";
const actorSheet = "xebec/justice-cel.png";
const crew = [
  { sheet: "xebec/rocks-newgate.png", x: -230, delay: 0, scale: 1.03 },
  { sheet: "xebec/rocks-kaido.png", x: 115, delay: 22, scale: .97 },
  { sheet: "xebec/rocks-linlin.png", x: 305, delay: 42, scale: 1.06 },
];
export const pandemoniumSheets = [close, gates, ...crew.map(member => member.sheet)];

function polygon(c: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
}

export function drawJusticeGates(c: CanvasRenderingContext2D, t: number, scene: Scene, assets: Map<string, HTMLImageElement>) {
  const image = assets.get(gates);
  if (!image || !scene.ocean) return;
  c.save();
  c.globalAlpha *= scene.ocean;
  c.drawImage(image, 0, -96, 1280, 776);
  if (scene.fracture) {
    const opening = 13 + 125 * scene.fracture;
    const lip = [[640, -45], [625, 37], [650, 123], [624, 208], [651, 287], [631, 384], [649, 468], [635, 572]] as const;
    const depth = ease(t, beats.rupture, beats.rupture + 42);
    const split = (direction: number) => lip.map(([x, y], i) =>
      [x + direction * opening * Math.max(0, Math.min(1, depth * 1.8 - (lip.length - 1 - i) * .115)), y] as const);
    const left = split(-1), right = split(1);
    polygon(c, [...left, ...[...right].reverse()]);
    const gap = c.createLinearGradient(550, 80, 650, 590);
    gap.addColorStop(0, "#181b54");
    gap.addColorStop(.56, "#b17f98");
    gap.addColorStop(.66, "#587d9e");
    gap.addColorStop(1, "#102a4f");
    c.fillStyle = gap;
    c.fill();
    for (const [sign, border] of [[-1, left], [1, right]] as const) {
      c.save();
      const hinge = sign < 0 ? 320 : 960;
      polygon(c, [...border, [hinge, 572], [hinge, -45]]);
      c.clip();
      c.translate(hinge, 410);
      c.rotate(sign * scene.fracture * -.105);
      c.translate(-hinge + sign * opening * .75, -410 + scene.fracture * 16);
      c.drawImage(image, 0, -96, 1280, 776);
      c.restore();
      c.beginPath();
      border.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.strokeStyle = "#111124";
      c.lineWidth = 9;
      c.stroke();
      c.strokeStyle = "#fba593a2";
      c.lineWidth = 2;
      c.stroke();
    }
    c.fillStyle = "#53536b";
    const age = t - beats.rupture;
    for (let i = 0; i < 29; i++) {
      const y = 80 + i * 17 - age * (1 + i % 9) + age * age * .136;
      const x = 640 + (i % 2 ? 1 : -1) * (13 + (i % 11) * age * .51);
      const size = 4 + i % 7;
      polygon(c, [[x, y], [x + size * 1.2, y - size], [x + size * 2.4, y], [x + size, y + size * 1.3]]);
      c.fill();
    }
  }
  const quay = c.createLinearGradient(0, 575, 0, 643);
  quay.addColorStop(0, "#4f5f76");
  quay.addColorStop(.19, "#313a4e");
  quay.addColorStop(1, "#142338");
  c.fillStyle = quay;
  polygon(c, [[-20, 578], [1298, 578], [1230, 629], [-30, 642]]);
  c.fill();
  for (let i = 0; i < 26; i++) {
    const x = i * 54;
    c.fillStyle = i % 5 === 0 ? "#73849b" : "#596c86";
    c.fillRect(x, 578 + i % 2, 32 + (i * 7) % 18, 2);
    if (i < 24) {
      c.fillStyle = "#132036";
      c.fillRect(x - 7, 596 + i % 4, 34 + (i * 15) % 32, 2);
      c.fillRect(x + (i * 17) % 45, 611 + i % 5, 21 + (i * 7) % 23, 3);
    }
  }
  c.fillStyle = "#7c9fbd70";
  for (let i = 0; i < 20; i++)
    c.fillRect(((i * 151 + t * (1 + i % 3)) % 1450) - 85, 653 + (i * 17) % 35, 16 + i % 5 * 9, 2);
  c.restore();
}

export function drawRocksCrew(c: CanvasRenderingContext2D, t: number, facing: number, scene: Scene, assets: Map<string, HTMLImageElement>) {
  const assembly = t >= beats.crew && t < beats.gates + 22;
  const finale = t >= beats.aftermath && t < beats.return + 11;
  if (!assembly && !finale) return;
  const leader = assembly ? Math.min(895, Math.max(385, scene.attacker.x)) : 640;
  crew.forEach(({ sheet, x, delay, scale }, i) => {
    const image = assets.get(sheet);
    if (!image) return;
    const age = t - beats.crew - delay;
    const entry = assembly ? ease(age, 0, 17) : ease(t, 648 + i * 4, 676 + i * 5);
    const leave = 1 - ease(t, assembly ? 416 : 722, assembly ? 446 : 743);
    if (!entry || !leave) return;
    const cel = finale || age >= 59 ? 3 : age >= 37 ? 2 : age >= 21 ? 1 : 0;
    const worldX = leader + facing * (x + Math.sign(x) * (1 - entry) * 116);
    const y = 579 - (i === 1 && cel < 2 ? Math.sin(Math.min(1, age / 38) * Math.PI) * 55 : 0);
    c.save();
    c.globalAlpha *= entry * leave;
    c.translate(Math.round(worldX), Math.round(y));
    c.scale(facing * scale, scale);
    c.drawImage(image, cel * 320, 0, 320, 320, -160, -288, 320, 320);
    if (assembly && age >= 37 && age < 54) {
      c.globalAlpha *= 1 - Math.max(0, age - 43) / 12;
      if (i === 0) {
        c.strokeStyle = "#e5eff7";
        for (const row of [0, 13, 24]) {
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(69, -60 + row);
          c.lineTo(100, -40 + row);
          c.lineTo(91, -23 + row);
          c.lineTo(136, -9 + row);
          c.stroke();
        }
      } else if (i === 1) {
        hakiBolt(c, t, 85, { x: 28, y: -65 }, { x: 133, y: -29 }, 6);
      } else {
        for (let j = 0; j < 11; j++) {
          c.fillStyle = ["#f46b47", "#ffb14c", "#ffe1a0"][j % 3];
          const q = (j * 19 + age * 3) % 65;
          c.fillRect(60 + (j * 9) % 33 + q * .8, -110 - q * .57, 3 + j % 6, 3 + j % 4);
        }
      }
    }
    c.restore();
  });
}

export function drawGateRupture(c: CanvasRenderingContext2D, t: number, scene: Scene) {
  const age = t - beats.rupture, a = scene.attacker;
  if (age < 0 || age >= 47) return;
  const fade = 1 - ease(age, 15, 47);
  c.save();
  c.globalAlpha *= fade;
  const height = ease(age, -4, 31);
  const bottom = { x: a.x + a.facing * 49, y: 565 };
  const top = { x: 640 + a.facing * (30 + height * 110), y: 535 - height * 647 };
  const width = 31 * fade;
  polygon(c, [[bottom.x - 15, bottom.y], [top.x - width, top.y + 44], [top.x, top.y],
    [top.x + width, top.y + 101], [bottom.x + 38, bottom.y - 4]]);
  c.fillStyle = "#120a1a";
  c.strokeStyle = "#ff4563";
  c.lineWidth = 4;
  c.fill();
  c.stroke();
  hakiBolt(c, t, 71, bottom, top, 13);
  hakiBurst(c, t, { x: 640, y: 575 - height * 296 }, 97 + age * 4, 8, 372, 48);
  c.restore();
}

export function drawPandemoniumClose(c: CanvasRenderingContext2D, t: number, assets: Map<string, HTMLImageElement>) {
  const image = assets.get(close);
  const opacity = ease(t, 16, 31) * (1 - ease(t, 78, 96));
  if (image && opacity) {
    const cel = t >= 57 ? 2 : t >= 36 ? 1 : 0;
    c.save();
    c.globalAlpha *= opacity;
    const backdrop = c.createLinearGradient(0, 0, 1280, 620);
    backdrop.addColorStop(0, "#140e1c");
    backdrop.addColorStop(.57, "#502233");
    backdrop.addColorStop(1, "#160e1d");
    c.fillStyle = backdrop;
    c.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 19; i++) {
      c.fillStyle = i % 3 ? "#dd526522" : "#ff989b46";
      const x = ((i * 173 - t * (i % 4 + 1) + 1600) % 1400) - 50;
      c.fillRect(x, 155 + i * 19, 45 + i % 6 * 23, 2);
    }
    const zoom = ease(t, 22, 83);
    c.drawImage(image, cel * 384, 0, 384, 384, 324 - zoom * 52, 69 - zoom * 36, 630 + zoom * 132, 630 + zoom * 132);
    c.restore();
  }
  const blade = assets.get(actorSheet);
  const focus = ease(t, 501, 512) * (1 - ease(t, 524, 533));
  if (blade && focus) {
    c.save();
    c.globalAlpha *= focus;
    const dusk = c.createLinearGradient(0, 120, 1280, 540);
    dusk.addColorStop(0, "#122037");
    dusk.addColorStop(.55, "#382534");
    dusk.addColorStop(1, "#111321");
    c.fillStyle = dusk;
    c.fillRect(0, 0, 1280, 720);
    c.translate(850, 360);
    const frame = Math.round(ease(t, 500, 531) * 38);
    c.drawImage(blade, 261, 63, 182, 146, -630 + frame, -255, 756, 606);
    hakiBolt(c, t, 109, { x: -218 + frame, y: -32 }, { x: -565 + frame, y: 218 }, 8);
    c.restore();
  }
  const letterbox = ease(t, 5, 22) * (1 - ease(t, beats.return, pandemoniumConfig.duration));
  c.fillStyle = "#08070d";
  c.fillRect(0, 0, 1280, 41 * letterbox);
  c.fillRect(0, 720 - 50 * letterbox, 1280, 50 * letterbox);
}
