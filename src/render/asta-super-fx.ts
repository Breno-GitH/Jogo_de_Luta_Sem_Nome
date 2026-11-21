import {
  unionBeats as beats,
  unionContacts,
  unionPose,
} from "../engine/asta-super-acts";
import { drawUnionSky, drawRemoteEquinox } from "./asta-equinox-fx";
import type { Fighter } from "../engine/combat";
import {
  astaUnionBlade,
  astaUnionId,
  astaUnionScene,
  type AstaUnionState,
} from "../engine/asta-super";
import type { Animator, AnimationClip } from "./animator";
import { astaSuperClips } from "./asta-super-animations";
import sockets from "../data/asta-sockets.json";
import weapons from "../data/asta-weapons.json";
import { visibleAstaSword } from "../engine/asta-stances";
export const astaSuperSheets = [
  "asta/r-liebe.png",
  "asta/r41-liebe-partner.png",
  "asta/r41-liebe-return.png",
];
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
export function drawAstaUnionBackdrop(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const t = s.tick;
  c.save();
  c.fillStyle = `rgba(10,8,20,${t >= beats.liebe && t < beats.slayer ? 0.18 : 0.08})`;
  c.fillRect(-400, -500, 2080, 1220);
  c.restore();
  drawUnionSky(c, s);
}
export function drawLiebeManifestation(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
  atlases: ReadonlyMap<string, CanvasImageSource>,
) {
  const outro = s.tick >= beats.outro,
    from = outro ? beats.outro : 78,
    to = outro ? 1094 : 194;
  if (s.tick < from || s.tick >= to) return;
  const age = s.tick - from,
    scene = astaUnionScene(s);
  const name = outro
    ? "r41-liebe-return"
    : age < 12
      ? "r-liebe"
      : "r41-liebe-partner";
  const atlas = atlases.get("asta/" + name + ".png");
  if (!atlas) return;
  const frame = outro
    ? Math.min(5, Math.floor(age / 15))
    : age < 12
      ? Math.floor(age / 6)
      : s.tick < 158
        ? unionPose(s.tick, s.openingTick).frame
        : 5;
  const merge = outro ? 0 : Math.max(0, (s.tick - 158) / 36);
  c.save();
  c.globalAlpha = Math.max(0, Math.min(1, age / 8, (to - s.tick) / 12));
  c.imageSmoothingEnabled = false;
  c.translate(
    scene.attacker.x + (118 - merge * 114) * s.facing,
    scene.attacker.y + 4 - (outro && age > 72 ? (age - 72) * 1.5 : 0),
  );
  c.scale(-s.facing, 1);
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
    const flip = scene.attacker.facing * f.facing;
    const dx = (scene.attacker.x - f.x) * f.facing,
      dy = scene.attacker.y - f.y;
    const angle = (grip.angle * Math.PI) / 180,
      len = weapons[scene.sword].reach;
    points.push({
      inner: [
        dx + (grip.x + Math.cos(angle) * len * 0.2) * flip,
        dy + grip.y + Math.sin(angle) * len * 0.2,
      ],
      tip: [
        dx + (grip.x + Math.cos(angle) * len) * flip,
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
  body?: CanvasImageSource,
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
  const charge = !!state && t >= beats.charge && t < beats.release,
    change = !!state && t >= beats.union && t < beats.slayer;
  c.save();
  c.lineJoin = "miter";
  c.imageSmoothingEnabled = false;
  if (layer === "behind") {
    if (
      body &&
      state &&
      (state.tick < 22 ||
        (state.tick >= beats.slasher && state.tick < beats.retreat))
    ) {
      for (const ago of [8, 4]) {
        const past = astaUnionScene({ ...state, tick: Math.max(0, t - ago) }),
          pose = unionPose(Math.max(0, t - ago), state.openingTick);
        if (
          past.attacker.clip !== f.actionClip ||
          past.attacker.facing !== f.facing
        )
          continue;
        c.save();
        c.globalAlpha = 0.11;
        c.drawImage(
          body,
          (pose.frame % 3) * 256,
          Math.floor(pose.frame / 3) * 256,
          256,
          256,
          -128 + (past.attacker.x - f.x) * f.facing,
          -224 + past.attacker.y - f.y,
          256,
          256,
        );
        c.restore();
      }
    }
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
      const amount = change
        ? (t - beats.union) / (beats.slayer - beats.union)
        : (t - beats.charge) / (beats.release - beats.charge);
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
      (unionContacts.some(
        (h) => h.kind !== "explosion" && t >= h.tick - 8 && t < h.tick + 9,
      ) ||
        (t >= beats.equinox && t < beats.release + 5));
    if (cutting && (!f.asta?.draw || f.asta.draw.tick >= f.asta.draw.handAt)) {
      const h = swordHistory(f, a);
      if (h.length > 1) {
        const polygon: Point[] = [
          ...h.map((p) => p.tip),
          ...h.map((p) => p.inner).reverse(),
        ];
        poly(c, polygon, t >= beats.equinox ? "#4b233a22" : "#4b233a55");
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
          t >= beats.equinox ? "#06080f33" : "#06080f88",
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
/** Super-only flying slash and offensive Causality extensions, purely visual subactions. */
function drawUnionTechniques(c: CanvasRenderingContext2D, s: AstaUnionState) {
  const t = s.tick;
  if (t >= beats.charge && t < beats.release) {
    const scene = astaUnionScene(s),
      pose = unionPose(t, s.openingTick),
      blade = astaUnionBlade(pose.sheet, pose.frame, "slasher").b;
    const tip: Point = [
      scene.attacker.x + blade.x * scene.attacker.facing,
      scene.attacker.y + blade.y,
    ];
    c.save();
    for (let i = 0; i < 14; i++) {
      const p = ((t - beats.charge + i * 7) % 43) / 43;
      const from: Point = [
        tip[0] + Math.cos(i * 2.41) * (110 + (i % 4) * 25),
        tip[1] + Math.sin(i * 2.41) * (65 + (i % 3) * 25),
      ];
      const at: Point = [
        from[0] + (tip[0] - from[0]) * p,
        from[1] + (tip[1] - from[1]) * p,
      ];
      ribbon(
        c,
        curve(
          at,
          [at[0] + (tip[0] - at[0]) * 0.12, at[1] + (tip[1] - at[1]) * 0.12],
          4,
        ),
        2,
        i % 4 ? "#0a0912" : "#583147",
      );
    }
    c.restore();
  }
  if (t >= beats.blackSlash && t <= beats.slashContact) {
    const birth = astaUnionScene({ ...s, tick: beats.blackSlash }),
      pose = unionPose(beats.blackSlash, s.openingTick);
    const blade = astaUnionBlade(pose.sheet, pose.frame, "dweller").b;
    const from: Point = [
      birth.attacker.x + blade.x * s.facing,
      birth.attacker.y + blade.y,
    ];
    const end = astaUnionScene({ ...s, tick: beats.slashContact }).victim,
      p = (t - beats.blackSlash) / (beats.slashContact - beats.blackSlash);
    const px = from[0] + (end.x - from[0]) * p,
      py = from[1] + (end.y - 75 - from[1]) * p;
    c.save();
    c.translate(px, py);
    c.scale(s.facing, 1);
    const slash = curve([-9, -55], [10, 55], 27);
    ribbon(c, slash, 6, "#69405b");
    ribbon(c, slash, 4, "#050710");
    c.restore();
  }
  if (t >= beats.rupture - 9 && t < beats.rupture + 26) {
    const age = t - (beats.rupture - 9),
      scene = astaUnionScene(s),
      pose = unionPose(t, s.openingTick);
    const tip = astaUnionBlade(pose.sheet, pose.frame, "destroyer", 0.8).b;
    c.save();
    c.translate(
      scene.attacker.x + tip.x * scene.attacker.facing,
      scene.attacker.y + tip.y,
    );
    c.scale(s.facing, 1);
    c.globalAlpha = Math.max(0, Math.min(1, age / 6, (35 - age) / 12));
    for (let i = 0; i < 6; i++) {
      const angle = i * 1.17 - 2.7,
        reach = 25 + Math.min(age, 22) * (2 + (i % 3));
      const path = curve(
        [0, 0],
        [Math.cos(angle) * reach, Math.sin(angle) * reach],
        Math.sin(age * 0.2 + i) * 24,
      );
      ribbon(c, path, 4, "#372335aa");
      ribbon(c, path, 2.5, "#080910");
    }
    c.restore();
  }
}
export function drawAstaUnionImpact(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const t = s.tick,
    scene = astaUnionScene(s),
    hit = [...unionContacts].reverse().find((h) => h.tick <= t);
  drawUnionTechniques(c, s);
  drawRemoteEquinox(c, s);
  if (!hit || hit.kind === "explosion") return;
  const age = t - hit.tick,
    life = 16;
  if (age > life) return;
  const direction = hit.angle;
  const rand = seed(919 + Math.floor(age / 2) * 71);
  c.save();
  const birth = astaUnionScene({ ...s, tick: hit.tick });
  c.translate(birth.victim.x, birth.victim.y - 77);
  c.scale(s.facing, 1);
  c.globalAlpha = Math.max(0, 1 - age / life);
  // Thin pressure fronts travel in the slash direction, leaving gaps around the victim silhouette.
  for (let layer = 0; layer < 3; layer++) {
    const q = (age - layer * 3) / (life - layer * 3);
    if (q < 0 || q > 1) continue;
    const radius = 28 + q * 80,
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
  for (let i = 0; i < 7; i++) {
    const a = direction + (rand() - 0.5) * 2.4,
      reach = 85 * (0.4 + rand() * 0.6),
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
    ribbon(c, path, 2 * (1 - age / life), i % 4 ? "#080a13" : "#53253c");
  }
  c.restore();
}
export function drawAstaUnionScreen(
  c: CanvasRenderingContext2D,
  s: AstaUnionState,
) {
  const last = [...unionContacts].reverse().find((h) => h.tick <= s.tick);
  c.save();
  c.fillStyle = "#080b15";
  c.fillRect(0, 135, 1280, 12);
  c.fillRect(
    0,
    s.tick >= beats.release && s.tick < beats.outro + 28 ? 602 : 590,
    1280,
    s.tick >= beats.release && s.tick < beats.outro + 28 ? 4 : 12,
  );
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
      : s.tick >= beats.union && s.tick < beats.slayer
        ? "DEVIL UNION"
        : s.tick >= beats.charge && s.tick < beats.outro
          ? "INFINITE SLASH · EQUINOX"
          : "";
  if (title) c.fillText(title, 640, 169);
  c.restore();
}
