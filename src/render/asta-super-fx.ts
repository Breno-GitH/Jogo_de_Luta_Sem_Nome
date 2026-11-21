import type { Fighter } from "../engine/combat";
import {
  astaUnionBlade,
  astaUnionConfig,
  astaUnionId,
  astaUnionScene,
  type AstaUnionState,
} from "../engine/asta-super";
import type { Animator, AnimationClip } from "./animator";
import { astaSuperClips } from "./asta-super-animations";
import sockets from "../data/asta-sockets.json";
import weapons from "../data/asta-weapons.json";
import { visibleAstaSword } from "../engine/asta-stances";
export const astaSuperSheets = ["asta/r-liebe.png"];
type Point = readonly [number, number];
const poly = (c: CanvasRenderingContext2D, p: Point[], color: string) => {
  c.fillStyle = color;
  c.beginPath();
  p.forEach(([x, y], i) =>
    i
      ? c.lineTo(Math.round(x), Math.round(y))
      : c.moveTo(Math.round(x), Math.round(y)),
  );
  c.closePath();
  c.fill();
};
function seed(n: number) {
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
/** Rasterize cosmetics at two screen pixels per FX pixel, never blurred glow. */
let raster: HTMLCanvasElement | undefined;
function pixels(
  c: CanvasRenderingContext2D,
  paint: (b: CanvasRenderingContext2D) => void,
) {
  raster ??= document.createElement("canvas");
  raster.width = 640;
  raster.height = 360;
  const b = raster.getContext("2d")!;
  b.scale(0.5, 0.5);
  paint(b);
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(raster, 0, 0, 1280, 720);
  c.restore();
}
export function drawAstaUnionBackdrop(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const t = s.tick;
  pixels(c, (b) => {
    const darkness =
      t < 22
        ? 0.1
        : t < 82
          ? 0.22
          : t < 198
            ? 0.12
            : t < 244
              ? 0.25
              : 0.12 * (1 - (t - 244) / 34);
    b.fillStyle = `rgba(10,8,20,${darkness})`;
    b.fillRect(0, 0, 1280, 720);
    if (t < 22 || (t >= 82 && t < 198)) {
      const rand = seed(17 + Math.floor(t / 3) * 397);
      for (let i = 0; i < 17; i++) {
        const y = 160 + rand() * 420,
          x = rand() * 1280,
          len = 30 + rand() * 110;
        b.fillStyle = i % 3 ? "#11121d99" : "#93858d55";
        b.fillRect(x, y, len, 2);
      }
    }
  });
}
export function drawLiebeManifestation(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
  atlas: CanvasImageSource | undefined,
) {
  if (!atlas || s.tick < 22 || s.tick >= 76) return;
  const scene = astaUnionScene(s),
    age = s.tick - 22;
  const frame = Math.min(5, Math.floor(age / 9));
  const alpha = Math.min(1, age / 6, (54 - age) / 10);
  c.save();
  c.globalAlpha = Math.max(0, alpha);
  c.imageSmoothingEnabled = false;
  c.translate(scene.attacker.x - 74 * s.facing, scene.attacker.y - 12);
  c.scale(s.facing, 1);
  // Liebe has six physical wing/gesture poses, not a zoomed portrait.
  c.drawImage(
    atlas,
    (frame % 3) * 256,
    Math.floor(frame / 3) * 256,
    256,
    256,
    -128,
    -224,
    256,
    256,
  );
  c.restore();
}
/** Local anatomy/weapon sockets are the same authored anchors as the actual blade renderer. */
function ribbon(
  c: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  color: string,
) {
  const left: Point[] = [],
    right: Point[] = [];
  points.forEach(([x, y], i) => {
    const previous = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - previous[0],
      dy = next[1] - previous[1],
      len = Math.hypot(dx, dy) || 1;
    const w = width * Math.sin((Math.PI * (i + 0.25)) / (points.length + 0.5));
    left.push([x - (dy / len) * w, y + (dx / len) * w]);
    right.push([x + (dy / len) * w, y - (dx / len) * w]);
  });
  poly(c, [...left, ...right.reverse()], color);
}
function curve(from: Point, to: Point, bend: number): Point[] {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    len = Math.hypot(dx, dy) || 1;
  return Array.from({ length: 14 }, (_, i) => {
    const p = i / 13,
      w = Math.sin(p * Math.PI) * bend;
    return [
      from[0] + dx * p - (dy / len) * w,
      from[1] + dy * p + (dx / len) * w,
    ] as Point;
  });
}
function celAt(clip: AnimationClip, t: number) {
  for (let i = 0; i < clip.frames.length; i++) {
    const hold = clip.durations?.[i] ?? clip.ticks;
    if (t < hold) return clip.frames[i];
    t -= hold;
  }
  return clip.frames.at(-1)!;
}
/** A short history follows the actual authored hand/blade cels AND the actor's travel.
 * The trail cannot remain floating at the old root when Asta rushes or rises. */
function swordHistory(f: Fighter, a: Animator): { inner: Point; tip: Point }[] {
  const state = f.match?.astaUnion;
  if (!state) return [];
  const points: { inner: Point; tip: Point }[] = [];
  for (let ago = 10; ago >= 0; ago -= 2) {
    if (state.tick < ago) continue;
    const scene = astaUnionScene({ ...state, tick: state.tick - ago });
    if (scene.attacker.clip !== f.actionClip) continue;
    const clip = (astaSuperClips as Record<string, AnimationClip>)[
      scene.attacker.clip
    ];
    if (!clip) continue;
    const frame = celAt(clip, scene.attacker.tick),
      id = clip.sheet!.replace("asta/", "").replace(".png", "");
    const grip = (
      sockets as Record<string, { x: number; y: number; angle: number }[]>
    )[id]?.[frame];
    if (!grip) continue;
    const dx = (scene.attacker.x - f.x) * f.facing,
      dy = scene.attacker.y - f.y;
    const angle = (grip.angle * Math.PI) / 180,
      len = weapons[scene.sword].reach;
    points.push({
      inner: [
        dx + grip.x + Math.cos(angle) * len * 0.2,
        dy + grip.y + Math.sin(angle) * len * 0.2,
      ],
      tip: [
        dx + grip.x + Math.cos(angle) * len,
        dy + grip.y + Math.sin(angle) * len,
      ],
    });
  }
  return points;
}
export function drawAstaUnionLocal(
  c: CanvasRenderingContext2D,
  f: Fighter,
  a: Animator,
  layer: "behind" | "front" = "front",
) {
  const state = f.match?.astaUnion,
    opening = f.state === "attack" && f.moveId === astaUnionId;
  if (!opening && state?.attacker !== f.id) return;
  const t = state?.tick ?? f.stateFrame,
    sprite = a.sprite(),
    frame = a.frame();
  const id = sprite.sheet.replace("asta/", "").replace(".png", "");
  const grip = (
    sockets as Record<string, { x: number; y: number; angle: number }[]>
  )[id]?.[frame];
  if (!grip) return;
  const rand = seed(713 + f.id * 53 + Math.floor(t / 2) * 131);
  const meteor = (opening && t >= 9 && t < 26) || (!!state && t < 22);
  const charge = !!state && t >= 198 && t < 222,
    change = !!state && t >= 48 && t < 82;
  c.save();
  c.lineJoin = "miter";
  c.imageSmoothingEnabled = false;
  if (layer === "behind") {
    if (meteor) {
      for (let i = 0; i < 8; i++) {
        const y = -48 - i * 7,
          len = 100 + rand() * 155;
        const path = curve(
          [-len, y + 18 * (rand() - 0.5)],
          [28, -68 - i * 4],
          (rand() - 0.5) * 32,
        );
        ribbon(c, path, 7 + rand() * 8, i % 3 ? "#080910dd" : "#391c2b99");
        ribbon(c, path, 3 + rand() * 3, "#06070d");
      }
      for (let i = 0; i < 12; i++) {
        const x = -40 - rand() * 190,
          y = -25 - rand() * 95;
        poly(
          c,
          [
            [x, y],
            [x - 18 - rand() * 25, y + 4],
            [x - 9, y + 7],
          ],
          i % 3 ? "#090b12" : "#432337",
        );
      }
    }
    if (change || charge) {
      const amount = change ? (t - 48) / 34 : (t - 198) / 24;
      for (let i = 0; i < 5; i++) {
        const p = i / 5,
          from: Point = [-32 - p * 38, -27 - p * 22],
          to: Point = [grip.x, grip.y - 18 - amount * 35];
        const path = curve(from, to, 16 + rand() * 22);
        ribbon(c, path, 2 + amount * 4, "#241522bb");
        ribbon(c, path, 1 + amount * 2, "#070811");
      }
    }
    const cutting =
      !!state &&
      [
        [94, 109],
        [119, 137],
        [148, 165],
        [178, 195],
        [226, 244],
      ].some(([from, to]) => t >= from && t < to);
    if (cutting && (!f.asta?.draw || f.asta.draw.tick >= f.asta.draw.handAt)) {
      const h = swordHistory(f, a);
      if (h.length > 1) {
        const polygon: Point[] = [
          ...h.map((p) => p.tip),
          ...h.map((p) => p.inner).reverse(),
        ];
        poly(c, polygon, "#4b233a88");
        poly(
          c,
          [
            ...h.map(
              (p) =>
                [
                  p.inner[0] + (p.tip[0] - p.inner[0]) * 0.95,
                  p.inner[1] + (p.tip[1] - p.inner[1]) * 0.95,
                ] as Point,
            ),
            ...h.map((p) => p.inner).reverse(),
          ],
          "#06080feb",
        );
        for (let i = 1; i < h.length; i++) {
          const p = h[i].tip,
            q = h[i - 1].tip;
          ribbon(c, curve(q, p, 4 + rand() * 7), 3, "#100e1b");
        }
      }
    }
  } else {
    const len = weapons[visibleAstaSword(f)].reach,
      angle = (grip.angle * Math.PI) / 180;
    const normal: Point = [-Math.sin(angle), Math.cos(angle)];
    const power = charge ? 1 : change ? 0.7 : meteor ? 0.8 : 0.35;
    // A solid, narrow anti-magic coating sits on the visible blade. The hilt and face remain clear.
    for (let i = 0; i < (charge ? 6 : 3); i++) {
      const p = 0.35 + rand() * 0.65,
        at: Point = [
          grip.x + Math.cos(angle) * len * p,
          grip.y + Math.sin(angle) * len * p,
        ];
      const end: Point = [
        at[0] -
          Math.cos(angle) * (12 + rand() * 20) +
          normal[0] * (rand() - 0.5) * 28,
        at[1] -
          Math.sin(angle) * (12 + rand() * 20) +
          normal[1] * (rand() - 0.5) * 28,
      ];
      const path = curve(at, end, (rand() - 0.5) * 16);
      ribbon(c, path, 2 + power * 2, "#4d223aa0");
      ribbon(c, path, 1 + power, "#06080f");
    }
  }
  c.restore();
}
export function drawAstaUnionImpact(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const t = s.tick,
    scene = astaUnionScene(s),
    hit = astaUnionConfig.hits.filter((h) => h.tick <= t).at(-1);
  if (!hit) return;
  const age = t - hit.tick,
    finish = hit.kind === "explosion",
    life = finish ? 30 : 16;
  if (age > life) return;
  const direction =
    hit.kind === "rise"
      ? -1.05
      : hit.kind === "dive"
        ? 0.85
        : hit.kind === "cross"
          ? -0.25
          : 0;
  const rand = seed(919 + Math.floor(age / 2) * 71);
  c.save();
  const birth = astaUnionScene({ ...s, tick: hit.tick });
  const tip =
    hit.kind === "explosion"
      ? astaUnionBlade("r-equinox", 3, "slasher", 0.72).b
      : undefined;
  c.translate(
    tip ? birth.attacker.x + tip.x * s.facing : birth.victim.x,
    tip ? birth.attacker.y + tip.y : birth.victim.y - 77,
  );
  c.scale(s.facing, 1);
  c.globalAlpha = Math.max(0, 1 - age / life);
  // Thin pressure fronts travel in the slash direction, leaving gaps around the victim silhouette.
  for (let layer = 0; layer < 3; layer++) {
    const q = (age - layer * 3) / (life - layer * 3);
    if (q < 0 || q > 1) continue;
    const radius = (finish ? 75 : 28) + q * (finish ? 255 : 80),
      path: Point[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = -1.2 + (i / 18) * 2.4,
        x = Math.cos(a) * radius * 0.44 + q * 35,
        y = Math.sin(a) * radius;
      path.push([
        x * Math.cos(direction) - y * Math.sin(direction),
        x * Math.sin(direction) + y * Math.cos(direction),
      ]);
    }
    ribbon(c, path, layer === 0 ? 2 : 1, layer % 2 ? "#918b9855" : "#251b32aa");
  }
  for (let i = 0; i < (finish ? 14 : 7); i++) {
    const a = direction + (rand() - 0.5) * 2.4,
      reach = (finish ? 210 : 85) * (0.4 + rand() * 0.6),
      travel = age * 2;
    const from: Point = [
      Math.cos(a) * (8 + travel),
      Math.sin(a) * (8 + travel),
    ];
    const to: Point = [
      Math.cos(a) * (reach + travel),
      Math.sin(a) * (reach + travel),
    ];
    const path = curve(from, to, (rand() - 0.5) * 25);
    ribbon(
      c,
      path,
      (finish ? 4 : 2) * (1 - age / life),
      i % 4 ? "#080a13" : "#53253c",
    );
  }
  if (finish) {
    const p = age / life,
      reach = 200 + p * 520;
    const path = curve([-70, 0], [reach, -12 - p * 25], -12);
    ribbon(c, path, 10 + 5 * (1 - p), "#4a273a88");
    ribbon(c, path, 7 + 4 * (1 - p), "#05070e");
    for (let i = 0; i < 22; i++) {
      const x = rand() * reach,
        y = (rand() - 0.5) * (25 + p * 130);
      poly(
        c,
        [
          [x, y],
          [x + 5 + rand() * 12, y - 3],
          [x + rand() * 5, y + 3],
        ],
        i % 3 ? "#10101c" : "#69445888",
      );
    }
  }
  c.restore();
}
export function drawAstaUnionScreen(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const last = astaUnionConfig.hits.filter((h) => h.tick <= s.tick).at(-1);
  c.save();
  c.fillStyle = "#080b15";
  c.fillRect(0, 135, 1280, 12);
  c.fillRect(0, 590, 1280, 12);
  if (last && s.tick - last.tick < 2) {
    c.fillStyle = last.kind === "explosion" ? "#d2cbd424" : "#b4a8b617";
    c.fillRect(0, 147, 1280, 443);
  }
  c.font = "bold 18px monospace";
  c.textAlign = "center";
  c.fillStyle = "#c9b6c6";
  const title =
    s.tick < 22
      ? "BLACK METEORITE"
      : s.tick >= 48 && s.tick < 89
        ? "DEVIL UNION"
        : s.tick >= 198 && s.tick < 244
          ? "INFINITE SLASH · EQUINOX"
          : "";
  if (title) c.fillText(title, 640, 169);
  c.restore();
}
