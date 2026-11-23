import type { Match, Fighter } from "../engine/combat";
import { entranceAge, entranceProfile, introStage } from "../engine/entrances";
import type { Animator } from "./animator";
import art from "../data/entrance-art.json";
import weapons from "../data/asta-weapons.json";
import { drawAstaGrimoire } from "./asta-grimoire";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const u = (n: number, a: number, z: number) => clamp((n - a) / (z - a));
const active = (f: Fighter) =>
  f.match?.phase === "intro" &&
  f.match.intro.full &&
  !f.match.intro.skipped &&
  f.state === "entrance";
type Point = readonly [number, number];
function polygon(c: CanvasRenderingContext2D, points: Point[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) =>
    i
      ? c.lineTo(Math.round(x), Math.round(y))
      : c.moveTo(Math.round(x), Math.round(y)),
  );
  c.closePath();
  c.fill();
}
export function entranceHidden(m: Match, seat: number) {
  return (
    m.phase === "intro" &&
    m.intro.full &&
    !m.intro.skipped &&
    (m.intro.tick === 0 || entranceAge(m.intro, seat) < 0)
  );
}
/** Cosmetic kagune. It creates no combat entity or attack shape. World coordinates. */
export function drawEntranceBehind(
  c: CanvasRenderingContext2D,
  f: Fighter,
  enabled: boolean,
) {
  if (!enabled || !active(f) || f.data.id !== "kaneki") return;
  const t = f.stateFrame,
    strength = u(t, 66, 94) * (1 - u(t, 137, 165));
  if (!strength) return;
  c.save();
  c.translate(f.x, f.y);
  c.scale(f.facing, 1);
  const tips: Point[] = [
    [-80, -118],
    [-94, -27],
    [-46, 4],
    [65, -110],
  ];
  tips.forEach(([tx, ty], index) => {
    const left: Point[] = [],
      right: Point[] = [];
    for (let i = 0; i <= 18; i++) {
      const p = i / 18,
        x = -7 + tx * p * strength,
        y =
          -65 +
          (ty + 65) * p * strength -
          Math.sin(p * Math.PI) * (25 + index * 5) +
          Math.sin(t * 0.055 + index) * p * 4,
        w = (1 - p) * 6 * strength + 1;
      left.push([x - w, y]);
      right.push([x + w, y + 2]);
    }
    polygon(c, [...left, ...right.reverse()], "#460e26");
    polygon(
      c,
      [
        ...left.map(([x, y]) => [x + 2, y] as Point),
        ...left
          .slice()
          .reverse()
          .map(([x, y]) => [x + 5, y + 2] as Point),
      ],
      "#9b2941",
    );
  });
  c.restore();
}
/** Local native-pixel details; the body remains readable without them. */
export function drawEntranceFront(
  c: CanvasRenderingContext2D,
  f: Fighter,
  enabled: boolean,
) {
  if (!enabled || !active(f)) return;
  const t = f.stateFrame;
  c.save();
  if (f.data.id === "goku" && t >= 64 && t < 110) {
    const p = u(t, 64, 78) * (1 - u(t, 90, 110));
    c.globalAlpha = p * 0.65;
    for (let i = 0; i < 4; i++) {
      const x = -25 + i * 16,
        y = -3 - ((t + i * 9) % 24);
      polygon(
        c,
        [
          [x, y],
          [x - 3, y + 8],
          [x + 1, y + 5],
          [x + 3, y + 12],
        ],
        i % 2 ? "#b7c4a6" : "#537a82",
      );
    }
  }
  if (f.data.id === "ben" && t >= 44 && t < 76) {
    const glow = u(t, 44, 50) * (1 - u(t, 65, 76));
    c.globalAlpha = glow * 0.65;
    c.fillStyle = "#6ede75";
    c.fillRect(3, -83, 6, 5);
    c.fillStyle = "#daf4ae";
    c.fillRect(5, -82, 2, 2);
  }
  if (f.data.id === "xebec" && t >= 34 && t < 66) {
    c.globalAlpha = (1 - u(t, 57, 66)) * 0.7;
    const step = Math.floor(t / 4);
    for (let i = 0; i < 2; i++) {
      const x = i ? 23 : -23,
        y = -110 + i * 16;
      const pts: Point[] = [
        [x, y],
        [x + (i ? 16 : -20), y - 9],
        [x + (i ? 9 : -14), y - 18],
        [x + (i ? 30 : -36), y - 25 - (step % 3) * 4],
      ];
      c.beginPath();
      pts.forEach(([px, py], n) => (n ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.lineJoin = "miter";
      c.lineWidth = 5;
      c.strokeStyle = "#962a40";
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = "#080910";
      c.stroke();
    }
  }
  c.restore();
}
/** Essential prop choreography, deliberately kept visible with cosmetic FX off. */
export function drawAstaEntrance(
  c: CanvasRenderingContext2D,
  f: Fighter,
  a: Animator,
  atlas: CanvasImageSource | undefined,
  body: CanvasImageSource,
) {
  if (!active(f) || f.data.id !== "asta") return false;
  const t = f.stateFrame,
    sprite = a.sprite(),
    grip = art.astaGrips[a.frame()];
  if (t >= 12 && t < 96)
    drawAstaGrimoire(c, f, {
      tick: (t - 12) / 2,
      total: 42,
      x: 37,
      y: -103 + Math.round(Math.sin(t * 0.08) * 2),
    });
  if (!atlas || t < 30 || !grip) return true;
  const emerge = u(t, 30, 52),
    hand = u(t, 40, 46),
    weapon = weapons.slayer;
  const x = 37 + (grip.x - 37) * hand,
    y = -103 + (grip.y + 103) * hand;
  c.save();
  c.translate(x, y);
  c.rotate(((grip.angle + 90) * Math.PI) / 180);
  const scale = 0.08 + emerge * 0.92;
  c.scale(scale, scale);
  c.imageSmoothingEnabled = false;
  c.drawImage(
    atlas,
    weapon.index * 128,
    0,
    128,
    192,
    -weapon.pivot.x,
    -weapon.pivot.y,
    128,
    192,
  );
  c.restore();
  if (t >= 46)
    c.drawImage(
      body,
      sprite.x + sprite.pivot.x + grip.x - 5,
      sprite.y + sprite.pivot.y + grip.y - 5,
      10,
      10,
      grip.x - 5,
      grip.y - 5,
      10,
      10,
    );
  return true;
}
export function drawEntranceTitles(
  c: CanvasRenderingContext2D,
  m: Match,
  localSeat: number,
) {
  if (
    m.phase !== "intro" ||
    !m.intro.full ||
    m.intro.skipped ||
    introStage(m.intro) !== "presentations"
  )
    return;
  c.save();
  m.fighters.forEach((f, seat) => {
    const age = entranceAge(m.intro, seat),
      alpha = u(age, 0, 14) * (1 - u(age, 105, 133));
    if (!alpha) return;
    const x = seat ? 785 : 55;
    c.globalAlpha = alpha;
    c.fillStyle = "#101827c9";
    c.fillRect(x - 8, 174, 448, 48);
    c.fillStyle = seat ? "#9bd5db" : "#e7bb78";
    c.font = "bold 17px monospace";
    c.fillText(f.data.name.toUpperCase(), x, 194);
    c.font = "11px monospace";
    c.fillStyle = "#d4cfc2";
    c.fillText(entranceProfile(f.data.id).name, x, 213);
  });
  c.globalAlpha = 1;
  c.textAlign = "center";
  c.font = "12px monospace";
  c.fillStyle = "#d4cfc2";
  const votes = m.intro.skipVotes.filter(Boolean).length;
  c.fillText(
    m.rules.introSkip === "both"
      ? votes
        ? m.intro.skipVotes[localSeat]
          ? "VOCÊ ACEITOU PULAR · AGUARDANDO O OUTRO JOGADOR (1/2)"
          : "O OUTRO JOGADOR QUER PULAR · ENTER / START PARA ACEITAR (1/2)"
        : "ENTER / START · PULAR SOMENTE COM O ACEITE DOS DOIS (0/2)"
      : "ENTER / START · PULAR APRESENTAÇÕES",
    640,
    700,
  );
  c.restore();
}
