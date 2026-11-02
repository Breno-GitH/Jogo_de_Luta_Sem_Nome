import fxData from "../data/fx.json";
import type { HitEvent } from "../engine/combat";

export function drawEffects(
  context: CanvasRenderingContext2D,
  events: HitEvent[],
  image: HTMLImageElement,
) {
  if (!image.complete || !image.naturalWidth) return;
  for (const event of events) {
    if (event.audioOnly) continue;
    const kind = event.kind ?? (event.blocked ? "guard" : "hit"),
      data = fxData[kind as keyof typeof fxData];
    if (!data) continue;
    const frame = Math.min(
      data.frames - 1,
      Math.floor(((event.total ?? 16) - event.life) / data.ticks),
    );
    context.drawImage(
      image,
      frame * 64,
      data.row * 64,
      64,
      64,
      Math.round(event.x) - 64,
      Math.round(event.y) - 64,
      128,
      128,
    );
  }
}
