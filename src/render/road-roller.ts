import objectData from "../data/road-roller-object.json";
import fxData from "../data/road-roller-fx.json";
import {
  roadConfig,
  roadScene,
  type RoadRollerState,
} from "../engine/road-roller";
import type { AnimationData } from "./animator";
import worldActions from "../data/the-world-super-actions.json";
import { poseAt } from "../engine/moves";
import type { Move } from "../engine/types";
import { shapeBounds } from "../engine/geometry";
export { objectData, fxData };
type Images = Map<string, HTMLImageElement>;
function draw(
  c: CanvasRenderingContext2D,
  images: Images,
  data: AnimationData,
  key: string,
  tick: number,
  x: number,
  y: number,
  facing = 1,
  scale = 1,
) {
  const clip = data.clips[key];
  if (!clip) return;
  const total = clip.frames.reduce(
    (s, _, i) => s + (clip.durations?.[i] ?? clip.ticks),
    0,
  );
  let time = clip.loop
      ? Math.max(0, tick) % total
      : Math.min(total - 1, Math.max(0, tick)),
    index = 0;
  while (
    index < clip.frames.length - 1 &&
    time >= (clip.durations?.[index] ?? clip.ticks)
  ) {
    time -= clip.durations?.[index] ?? clip.ticks;
    index++;
  }
  const image = images.get(clip.sheet ?? data.sheet);
  if (!image?.complete || !image.naturalWidth) return;
  const w = clip.frameWidth ?? data.frameWidth,
    h = clip.frameHeight ?? data.frameHeight,
    pivot = clip.pivot ?? data.pivot ?? { x: w / 2, y: h };
  const frame = clip.frames[index],
    columns = clip.columns ?? data.columns ?? clip.frames.length;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(facing * scale, scale);
  c.drawImage(
    image,
    (frame % columns) * w,
    Math.floor(frame / columns) * h,
    w,
    h,
    -pivot.x,
    -pivot.y,
    w,
    h,
  );
  c.restore();
}
export function drawRoadObject(
  c: CanvasRenderingContext2D,
  images: Images,
  state: RoadRollerState,
  debug = false,
) {
  const o = roadScene(state).object;
  if (o.visible)
    draw(c, images, objectData, o.clip, o.tick, o.x, o.y, state.facing);
  if (debug && o.visible) {
    c.strokeStyle = "#e4bd6d";
    c.strokeRect(o.x - 164, o.y - 140, 328, 140);
    c.fillStyle = "#e3a5ee";
    c.fillRect(state.targetX - 2, 578, 4, 4);
  }
}
export function drawRoadBackdrop(
  c: CanvasRenderingContext2D,
  images: Images,
  state: RoadRollerState,
) {
  const t = state.tick,
    p = roadConfig.phases,
    scene = roadScene(state);
  c.save();
  c.fillStyle = "#10142570";
  c.fillRect(0, -720, 1280, 1500);
  c.restore();
  if ((t >= p.ascent && t < p.offscreen) || (t >= p.descent && t < p.impact)) {
    draw(
      c,
      images,
      fxData,
      "speedLines",
      t,
      scene.attacker.x,
      scene.attacker.y + 90,
      1,
      2,
    );
  }
}
export function drawRoadEffects(
  c: CanvasRenderingContext2D,
  images: Images,
  state: RoadRollerState,
) {
  const t = state.tick,
    p = roadConfig.phases,
    o = roadScene(state).object;
  const impact = t - p.impact;
  if (impact >= 0 && impact < 24) {
    c.save();
    c.globalAlpha = Math.max(0, 1 - impact / 26);
    draw(c, images, fxData, "dust", impact, o.x - 55, 580, 1, 1);
    draw(c, images, fxData, "dust", impact, o.x + 60, 580, -1, 1);
    c.restore();
    if (impact < 8)
      draw(c, images, fxData, "impactFlash", impact, state.targetX, 565, 1, 2);
  }
  const fist = (tick: number) => {
    const scene = roadScene({ ...state, tick }),
      action = worldActions[scene.stand.clip as keyof typeof worldActions];
    const pose = poseAt(action as unknown as Move, scene.stand.tick),
      shape = pose?.hitboxes?.[0];
    const b = shape ? shapeBounds(shape) : { x: 45, y: -55, w: 16, h: 18 };
    return {
      x: scene.stand.x + (b.x + b.w / 2) * state.facing,
      y: scene.stand.y + b.y + b.h / 2,
    };
  };
  for (let i = 0; i < roadConfig.punchTicks.length; i++) {
    const age = t - roadConfig.punchTicks[i];
    if (age >= 0 && age < 8) {
      const hit = fist(roadConfig.punchTicks[i]);
      draw(c, images, fxData, "impactFlash", age, hit.x, hit.y, 1, 1);
    }
  }
  const final = t - roadConfig.finalPunchTick;
  if (final >= 0 && final < 10) {
    const hit = fist(roadConfig.finalPunchTick);
    draw(c, images, fxData, "finalImpact", final, hit.x, hit.y, 1, 2);
  }
  const explosion = t - p.explosion;
  if (explosion >= 0 && explosion < 24) {
    c.save();
    c.globalAlpha = Math.min(1, (24 - explosion) / 8);
    draw(c, images, fxData, "explosion", explosion, o.x, 510, 1, 2);
    c.restore();
  }
  if (explosion >= 0 && explosion < 3) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#fff1bd70";
    c.fillRect(0, 0, 1280, 720);
    c.restore();
  }
  const smoke = t - p.smoke;
  if (smoke >= 0 && smoke < 40) {
    c.save();
    c.globalAlpha = Math.max(0, 1 - smoke / 40);
    draw(c, images, fxData, "smoke", smoke, o.x - 70, 580, 1, 2);
    draw(c, images, fxData, "smoke", smoke + 4, o.x + 65, 580, -1, 2);
    c.restore();
  }
}
