import type { Rect } from "./types";
import { shapeHitsRect } from "./geometry";

export interface KnifeProjectile {
  id: number;
  owner: number;
  move: string;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  facing: number;
  age: number;
  life: number;
  sprite: number;
  damage: number;
  stun: number;
  blockstun: number;
}
export function projectileBox(p: KnifeProjectile): Rect {
  return { x: p.x - 14, y: p.y - 3, w: 29, h: 6 };
}
/** Swept volume prevents a fast knife tunnelling through a narrow hurtbox. */
export function projectileHits(p: KnifeProjectile, boxes: Rect[]) {
  const tip = p.facing * 14;
  return boxes.some((box) =>
    shapeHitsRect(
      {
        a: { x: p.previousX - tip, y: p.previousY },
        b: { x: p.x + tip, y: p.y },
        r: 2,
      },
      box,
    ),
  );
}
