import type { Animator } from "./animator";

export interface SpriteEntity {
  id: string;
  x: number;
  y: number;
  facing: number;
  depth: number;
  animator: Animator;
}
export function depthOrder(entities: SpriteEntity[]) {
  return entities
    .map((entity, index) => ({ entity, index }))
    .sort((a, b) => a.entity.depth - b.entity.depth || a.index - b.index)
    .map((v) => v.entity);
}

/** All actors have their own animator/atlas. Integer placement, shared pivot
 * semantics and stable depth order work for owners, companions and projectiles. */
export function drawSpriteScene(
  c: CanvasRenderingContext2D,
  entities: SpriteEntity[],
  images: Map<string, HTMLImageElement>,
) {
  const ordered = depthOrder(entities);
  c.imageSmoothingEnabled = false;
  for (const entity of ordered) {
    const sprite = entity.animator.sprite(),
      image = images.get(sprite.sheet);
    if (!image?.complete || !image.naturalWidth)
      throw new Error(`Missing sprite: ${sprite.sheet}`);
    c.save();
    c.translate(Math.round(entity.x), Math.round(entity.y));
    c.scale(entity.facing * sprite.scale, sprite.scale);
    c.drawImage(
      image,
      sprite.x,
      sprite.y,
      sprite.width,
      sprite.height,
      -sprite.pivot.x,
      -sprite.pivot.y,
      sprite.width,
      sprite.height,
    );
    c.restore();
  }
  return ordered.map((entity) => entity.id);
}
