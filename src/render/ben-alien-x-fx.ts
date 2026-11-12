import { alienXId, alienXScene } from "../engine/ben-alien-x";
import type { Fighter } from "../engine/combat";

type Scene = ReturnType<typeof alienXScene>;
const TAU = Math.PI * 2;
const starColors = ["#e6f9ff", "#92c6ff", "#ab8bf0", "#594a96"];

export function drawAlienXSpace(c: CanvasRenderingContext2D, scene: Scene, tick: number) {
  const depth = scene.showSpace;
  c.save();
  c.fillStyle = `rgba(5,9,20,${Math.min(1, .26 + depth * .74)})`;
  c.fillRect(-2000, -1400, 5200, 3600);
  if (depth > 0) {
    c.globalAlpha = depth;
    const nebula = c.createRadialGradient(scene.camera.x - 82, 263, 24, scene.camera.x - 82, 263, 493);
    nebula.addColorStop(0, "#312b72");
    nebula.addColorStop(.48, "#161e52");
    nebula.addColorStop(1, "#07091d00");
    c.fillStyle = nebula;
    c.fillRect(-450, -420, 2170, 1500);
    for (let i = 0; i < 170; i++) {
      const x = (i * 239 + Math.floor(tick * (.3 + i % 3 * .21))) % 2300 - 520;
      const y = (i * 113 + 37 * (i % 11)) % 1050 - 160;
      const w = i % 17 === 0 ? 4 : i % 5 === 0 ? 3 : 2;
      c.fillStyle = starColors[i % 4];
      c.fillRect(x, y, w, w);
      if (w === 4) {
        c.fillRect(x + 1, y - 4, 2, 12);
        c.fillRect(x - 4, y + 1, 12, 2);
      }
    }
    for (let i = 0; i < 7; i++) {
      c.save();
      c.translate(scene.camera.x + 365, 146);
      c.rotate(-.37 + i * .04);
      c.strokeStyle = i % 2 ? "#4966a0" : "#a790d2";
      c.lineWidth = 2;
      c.globalAlpha = depth * (.2 - i * .02);
      c.beginPath();
      c.ellipse(0, 0, 94 + i * 12, 19 + i * 6, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}

export function drawAlienXForces(c: CanvasRenderingContext2D, scene: Scene, tick: number) {
  const { victim, attacker, showSpace } = scene;
  c.save();
  if (tick < 50) {
    const life = Math.sin(Math.PI * Math.min(1, tick / 50));
    c.globalAlpha = life;
    c.strokeStyle = "#baff9a";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(attacker.x + attacker.facing * 22, attacker.y - 80, 12 + life * 18, 8 + life * 19, 0, 0, TAU);
    c.stroke();
  }
  if (showSpace > 0) {
    const contraction = Math.max(.12, Math.min(1, (214 - tick) / 27));
    const expansion = tick >= 214 ? Math.min(1, (tick - 214) / 26) : 0;
    const centerY = victim.y - 78;
    const orbX = victim.x - attacker.facing * 85;
    const orbY = centerY + 30;
    const radius = 16 + 44 * contraction;
    c.globalAlpha = showSpace;
    if (tick >= 120 && tick < 217) {
      const sphere = c.createRadialGradient(orbX - radius / 5, orbY - radius / 4, 2, orbX, orbY, radius);
      sphere.addColorStop(0, "#fcffec");
      sphere.addColorStop(.35, "#bde6ff");
      sphere.addColorStop(.72, "#6e65ce");
      sphere.addColorStop(1, "#4163a900");
      c.fillStyle = sphere;
      c.fillRect(orbX - radius, orbY - radius, 2 * radius, 2 * radius);
    }
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12 + tick * .035;
      const x = victim.x + Math.cos(angle) * (74 + (i % 3) * 26) * (contraction + expansion * 3);
      const y = centerY + Math.sin(angle) * (29 + (i % 3) * 18) * (contraction + expansion * 2);
      const w = 8 + i % 4 * 3;
      c.fillStyle = i % 3 ? "#6c72c7" : "#d6f3ff";
      c.beginPath();
      c.moveTo(Math.round(x), Math.round(y - w));
      c.lineTo(Math.round(x + w), Math.round(y - 2));
      c.lineTo(Math.round(x + w / 3), Math.round(y + w));
      c.lineTo(Math.round(x - w), Math.round(y + w / 2));
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = starColors[i];
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(victim.x, centerY, Math.max(1, (91 + i * 21) * (contraction + expansion * 3)),
        Math.max(1, (28 + i * 12) * (contraction + expansion * 2)), Math.sin(tick * .03 + i) * .53, 0, TAU);
      c.stroke();
    }
  }
  c.restore();
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
  c.globalAlpha = active ? Math.max(.1, 1 - (tick - 23) / 12) : .45;
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = ["#edffe0", "#a2f4b3", "#62be92"][i];
    c.lineWidth = 3 - i * .5;
    c.beginPath();
    c.ellipse(x - f.facing * i * 12, y, radius * (.51 + i * .19), radius * (.56 + i * .11), 0, 0, TAU);
    c.stroke();
  }
  c.restore();
}

