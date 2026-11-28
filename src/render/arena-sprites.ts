export type EventImages = ReadonlyMap<string, HTMLImageElement>;
type Crop = { x: number; y: number; w: number; h: number };
const cache = new WeakMap<HTMLImageElement, Crop[]>();
function crops(image: HTMLImageElement): Crop[] {
  let frames = cache.get(image); if (frames) return frames;
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const c = canvas.getContext("2d", { willReadFrequently: true })!; c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
  frames = Array.from({ length: 8 }, (_, f) => {
    const left = Math.round(f % 4 * canvas.width / 4), top = Math.round(Math.floor(f / 4) * canvas.height / 2);
    const right = Math.round((f % 4 + 1) * canvas.width / 4), bottom = Math.round((Math.floor(f / 4) + 1) * canvas.height / 2);
    let x0 = right, y0 = bottom, x1 = left, y1 = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 40) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return x1 >= x0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: left, y: top, w: right - left, h: bottom - top };
  });
  cache.set(image, frames); return frames;
}
export function drawArenaSprite(c: CanvasRenderingContext2D, images: EventImages | undefined, id: string, frame: number, x: number, y: number,
  width: number, height = width, flip = false, rotation = 0, anchor = 1) {
  const image = images?.get(`arenas/events/${id}.png`); if (!image?.complete || !image.naturalWidth) return;
  const box = crops(image)[Math.max(0, Math.min(7, Math.floor(frame)))], scale = Math.min(width / box.w, height / box.h);
  const w = Math.round(box.w * scale), h = Math.round(box.h * scale);
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(rotation); c.scale(flip ? -1 : 1, 1); c.imageSmoothingEnabled = false;
  c.drawImage(image, box.x, box.y, box.w, box.h, -Math.round(w / 2), -Math.round(h * anchor), w, h); c.restore();
}
