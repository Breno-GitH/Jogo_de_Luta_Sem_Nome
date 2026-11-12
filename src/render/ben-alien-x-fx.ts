import { alienXConfig, alienXId, alienXScene } from "../engine/ben-alien-x";
import type { Fighter } from "../engine/combat";

type Scene = ReturnType<typeof alienXScene>;
export const alienXBackdrop = "fx/alien-x-dimension.png";
const tau = Math.PI * 2;
const impact = alienXConfig.hits[0].tick;
const { reveal, grasp } = alienXConfig.phases;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => unit(n) ** 2 * (3 - 2 * unit(n));
const ease = (t: number, from: number, to: number) =>
  smooth((t - from) / (to - from));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function alienXCamera(scene: Scene, tick: number) {
  const { attacker, victim, showSpace } = scene;
  const watch = ease(tick, 0, 17) * (1 - ease(tick, reveal, 57));
  const orbit = ease(tick, 103, 166) * (1 - ease(tick, impact, 249));
  const still = ease(tick, 192, 206) * (1 - ease(tick, impact, 229));
  const midpoint = (attacker.x + victim.x) / 2;
  const scale =
    1 + watch * 0.83 + showSpace * 0.17 + orbit * 0.14 + still * 0.09;
  const watchX = attacker.x + 37 * attacker.facing;
  const focus = mix(
    mix(640, midpoint + (victim.x - midpoint) * orbit * 0.22, showSpace),
    watchX,
    watch,
  );
  const margin = (640 / scale) * (1 - 0.32 * showSpace);
  const recoil =
    tick >= impact && tick < impact + 13 ? 1 - (tick - impact) / 13 : 0;
  return {
    x: Math.max(margin, Math.min(1280 - margin, focus)),
    y: mix(mix(360, 366 - orbit * 14, showSpace), attacker.y - 145, watch),
    scale,
    angle: showSpace * (0.025 + orbit * 0.035) * attacker.facing,
    shakeX: Math.cos((tick - impact) * 2.4) * 9 * recoil,
    shakeY: Math.sin((tick - impact) * 1.8) * 5 * recoil,
  };
}

function ring(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rotation, 0, tau);
  c.stroke();
}

export function drawAlienXSpace(
  c: CanvasRenderingContext2D,
  scene: Scene,
  tick: number,
  art?: HTMLImageElement,
) {
  const depth = scene.showSpace;
  const green = ease(tick, 0, 14) * (1 - ease(tick, reveal, 60));
  if (!depth && !green) return;
  c.save();
  c.fillStyle =
    green > 0 ? `rgba(3,17,18,${green * 0.57})` : `rgba(5,7,23,${depth})`;
  c.fillRect(-1300, -950, 3900, 2600);
  if (depth > 0) {
    const center = (scene.attacker.x + scene.victim.x) / 2;
    c.globalAlpha = depth;
    if (art?.naturalWidth) {
      const width = 1800;
      const height = (width * art.height) / art.width;
      c.drawImage(
        art,
        Math.round(center * 0.31 - 488 - (tick - 69) * 0.46),
        -Math.round(height * 0.24),
        width,
        Math.round(height),
      );
    }

    // Three planes travel at different rates as the frame moves through the dimension.
    for (let plane = 0; plane < 3; plane++) {
      c.fillStyle = ["#a2b4df", "#8cacf3", "#c9f0ff"][plane];
      c.globalAlpha = depth * [0.34, 0.55, 0.7][plane];
      for (let i = 0; i < [90, 45, 15][plane]; i++) {
        const x =
          ((i * 173 +
            plane * 389 +
            1400 -
            Math.floor(tick * (plane + 1) * 0.84 + center * plane * 0.13)) %
            2040) -
          385;
        const y =
          ((i * 157 + plane * 91) % 990) -
          110 +
          Math.round(plane * Math.sin(tick * 0.019) * 16);
        const size = plane + 1;
        c.fillRect(x, y, size, size);
        if (plane === 2 && i % 3 === 0) {
          c.fillRect(x + 1, y - 4, 1, 11);
          c.fillRect(x - 4, y + 1, 11, 1);
        }
      }
    }

    const seam = depth * (1 - depth) * 4;
    c.globalAlpha = seam * 0.65;
    c.strokeStyle = "#9d80e5";
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const x = Math.round(
        center + (i - 3) * 215 + Math.cos(i * 19) * depth * 110,
      );
      c.beginPath();
      c.moveTo(x - 70, -160);
      c.lineTo(x + 38, 93);
      c.lineTo(x - 23, 268);
      c.lineTo(x + 96, 590);
      c.lineTo(x + 41, 895);
      c.stroke();
    }
  }
  c.restore();
}

function shard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  near: boolean,
) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.rotate(angle);
  c.fillStyle = near ? "#373464" : "#171d47";
  c.strokeStyle = near ? "#ad9de5" : "#6477ae";
  c.lineWidth = near ? 2 : 1;
  c.beginPath();
  c.moveTo(-size, size * 0.46);
  c.lineTo(size * 0.1, -size);
  c.lineTo(size * 0.92, -size * 0.24);
  c.lineTo(size * 0.56, size * 0.7);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = near ? "#6f87bb" : "#434c89";
  c.beginPath();
  c.moveTo(size * 0.1, -size);
  c.lineTo(size * 0.05, size * 0.33);
  c.lineTo(size * 0.56, size * 0.7);
  c.stroke();
  c.restore();
}

export function drawAlienXForces(
  c: CanvasRenderingContext2D,
  scene: Scene,
  tick: number,
) {
  const { attacker, victim, showSpace } = scene;
  c.save();
  const green = ease(tick, 7, 20) * (1 - ease(tick, reveal + 4, 62));
  if (green > 0) {
    const t = ease(tick, reveal - 5, 54);
    c.globalAlpha = green * 0.8;
    c.strokeStyle = "#a8f881";
    c.lineWidth = 2;
    ring(c, attacker.x, attacker.y - 80, 15 + t * 93, 11 + t * 105, -0.2);
    ring(c, attacker.x, attacker.y - 13, 23 + t * 107, 6 + t * 22, 0);
    c.fillStyle = "#d7ffb9";
    for (let i = 0; i < 20; i++) {
      const angle = i * 2.399 + tick * 0.02;
      const x = attacker.x + Math.cos(angle) * (11 + t * (33 + (i % 7) * 9));
      const y = attacker.y - 71 + Math.sin(angle) * (14 + t * 97);
      c.fillRect(Math.round(x), Math.round(y), 2, 4 + (i % 4));
    }
  }
  if (tick >= grasp && showSpace > 0) {
    const gather = ease(tick, grasp, 171);
    const seal = ease(tick, 178, impact - 3);
    const burst = ease(tick, impact, 244);
    const death = 1 - ease(tick, impact + 6, 251);
    const x = victim.x,
      y = victim.y - 72;
    c.globalAlpha = showSpace * death * gather;

    for (let i = 0; i < 20; i++) {
      const near = i % 3 === 0;
      const angle = i * 2.399 + (tick - grasp) * (0.009 + 0.003 * (i % 4));
      const orbit =
        ((i % 3) * 31 + mix(238, 115, gather)) * (1 - 0.76 * seal) +
        burst * (200 + (i % 5) * 28);
      shard(
        c,
        x + Math.cos(angle) * orbit,
        y + Math.sin(angle) * orbit * 0.65,
        (near ? 13 : 6) + (i % 5),
        angle * 0.8 + i,
        near,
      );
    }

    if (tick < impact) {
      const width = mix(170, 32, seal),
        height = mix(107, 20, seal);
      c.fillStyle = "#6d7be228";
      c.strokeStyle = seal > 0.85 ? "#ebf6ff" : "#b6d7ff";
      c.lineWidth = 2 + seal * 2;
      c.beginPath();
      c.ellipse(x, y, width, height, 0, 0, tau);
      c.fill();
      c.stroke();
      c.strokeStyle = "#9c79d6";
      ring(
        c,
        x,
        y,
        width,
        Math.max(8, height * 0.54),
        -0.43 + Math.sin(tick * 0.035) * 0.2,
      );
      ring(c, x, y, width, Math.max(8, height * 0.58), 0.51);
      const ray = 20 + 22 * seal;
      c.strokeStyle = "#adc4fa";
      c.lineWidth = 2;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + side * width * 0.7, y - height * 0.71);
        c.lineTo(x + side * (width + ray), y - height * 0.32);
        c.lineTo(x + side * (width + ray), y + height * 0.32);
        c.lineTo(x + side * width * 0.7, y + height * 0.71);
        c.stroke();
      }
    } else {
      c.strokeStyle = "#c7ddff";
      c.lineWidth = 4 * (1 - burst) + 1;
      ring(c, x, y, 30 + burst * 335, 14 + burst * 146, -0.28);
      c.strokeStyle = "#a990e6";
      ring(c, x, y, 12 + burst * 280, 10 + burst * 125, 0.17);
      c.fillStyle = "#cde6ff";
      for (let i = 0; i < 26; i++) {
        const angle = (i * tau) / 26;
        c.fillRect(
          Math.round(x + Math.cos(angle) * (17 + burst * 355)),
          Math.round(y + Math.sin(angle) * (12 + burst * 164)),
          2 + (i % 3),
          2,
        );
      }
    }
  }
  c.restore();
}

export function drawAlienXScreen(
  c: CanvasRenderingContext2D,
  scene: Scene,
  tick: number,
  portrait?: HTMLImageElement,
) {
  const charge = ease(tick, 2, 12) * (1 - ease(tick, reveal - 3, reveal + 5));
  const flash =
    Math.max(0, 1 - Math.abs(tick - reveal) / 8) * 0.4 +
    Math.max(0, 1 - Math.abs(tick - impact) / 7) * 0.55;
  const dark =
    ease(tick, 188, 204) * (1 - ease(tick, impact - 1, impact + 5)) * 0.48;
  c.save();
  if (scene.showSpace || dark) {
    const vignette = c.createRadialGradient(640, 364, 200, 640, 364, 790);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(
      1,
      `rgba(6,3,25,${Math.max(dark, scene.showSpace * 0.65)})`,
    );
    c.fillStyle = vignette;
    c.fillRect(0, 0, 1280, 720);
  }
  if (charge > 0) {
    const camera = alienXCamera(scene, tick);
    const wrist =
      640 +
      (scene.attacker.x + scene.attacker.facing * 28 - camera.x) * camera.scale;
    const yWrist = 360 + (scene.attacker.y - 83 - camera.y) * camera.scale;
    const x = wrist < 640 ? 887 : 393;
    const y = 330,
      side = Math.sign(x - wrist);
    c.globalAlpha = charge;
    c.strokeStyle = "#9deb84";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(wrist, yWrist);
    c.lineTo(x - side * 134, y + 40);
    c.lineTo(x - side * 92, y + 40);
    c.stroke();
    c.fillStyle = "#09251cef";
    c.beginPath();
    c.arc(x, y, 92, 0, tau);
    c.fill();
    ring(c, x, y, 91, 91, 0);
    ring(c, x, y, 79, 79, 0);
    c.strokeStyle = "#2d714d";
    c.lineWidth = 4;
    ring(c, x, y, 86, 86, 0);
    c.fillStyle = "#659961";
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12 - tick * 0.012;
      c.fillRect(
        Math.round(x + Math.cos(a) * 85) - 2,
        Math.round(y + Math.sin(a) * 85) - 2,
        4,
        4,
      );
    }
    if (portrait?.naturalWidth) c.drawImage(portrait, x - 56, y - 66, 112, 112);
    c.fillStyle = "#d8ffbf";
    c.textAlign = "center";
    c.font = "bold 12px monospace";
    c.fillText("ALIEN X", x, y + 65);
  }
  if (flash > 0) {
    c.globalAlpha = flash;
    c.fillStyle = tick < 60 ? "#c9ffb2" : "#dbeaff";
    c.fillRect(0, 0, 1280, 720);
  }
  c.restore();
}

export function alienXOpenerCamera(f: Fighter) {
  if (f.state !== "attack" || f.moveId !== alienXId) return;
  const weight = ease(f.stateFrame, 2, 13) * (1 - ease(f.stateFrame, 20, 26));
  if (!weight) return;
  const scale = 1 + weight * 0.09;
  const margin = 640 / scale;
  return {
    x: Math.max(margin, Math.min(1280 - margin, mix(640, f.x, weight))),
    y: 360 + weight * 23,
    scale,
    angle: 0,
    shakeX: 0,
    shakeY: 0,
  };
}

export function drawAlienXOpener(c: CanvasRenderingContext2D, f: Fighter) {
  if (f.state !== "attack" || f.moveId !== alienXId) return;
  const tick = f.stateFrame;
  if (tick < 7 || tick > 33) return;
  const active = tick >= 23;
  const radius = active ? Math.min(73, (tick - 20) * 10) : 7 + (tick - 7) * 1.4;
  const x = f.x + f.facing * (active ? 100 : 26);
  const y = f.y - (active ? 81 : 83);
  c.save();
  c.globalAlpha = active ? Math.max(0.1, 1 - (tick - 23) / 12) : 0.45;
  for (const [i, color] of ["#edffe0", "#a2f4b3", "#62be92"].entries()) {
    c.strokeStyle = color;
    c.lineWidth = 3 - i * 0.5;
    ring(
      c,
      x - f.facing * i * 12,
      y,
      radius * (0.51 + i * 0.19),
      radius * (0.56 + i * 0.11),
      0,
    );
  }
  c.restore();
}
