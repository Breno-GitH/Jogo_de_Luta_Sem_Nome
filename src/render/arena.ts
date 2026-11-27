import { FLOOR } from "../engine/combat";
import type { ArenaState } from "../engine/arenas";

/** Shared original test stage; no fighter sprites or game-state side effects. */
export function drawTestArena(c: CanvasRenderingContext2D, padding = 0) {
  const left = -padding, width = 1280 + 2 * padding;
  const bg = c.createLinearGradient(0, 0, 0, 720);
  bg.addColorStop(0, "#101b2b");
  bg.addColorStop(1, "#283a43");
  c.fillStyle = bg;
  c.fillRect(left, 0, width, 720);
  c.fillStyle = "#c5c0a3";
  c.beginPath();
  c.arc(990, 195, 53, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#162737";
  for (let i = 0; i < 12; i++) {
    const x = i * 125;
    c.fillRect(x, 315 - (i % 3) * 38, 95, 260);
  }
  c.fillStyle = "#1e333f";
  c.fillRect(left, 450, width, 130);
  c.fillStyle = "#627577";
  c.fillRect(left, FLOOR, width, 4);
  c.fillStyle = "#182731";
  c.fillRect(left, FLOOR + 4, width, 136);
  c.strokeStyle = "#30434b";
  c.lineWidth = 1;
  for (let x = -600; x < 1900; x += 100) {
    c.beginPath();
    c.moveTo(640 + (x - 640) * 0.6, FLOOR + 4);
    c.lineTo(x, 720);
    c.stroke();
  }
  for (const y of [609, 650, 708]) {
    c.beginPath();
    c.moveTo(left, y);
    c.lineTo(1280 + padding, y);
    c.stroke();
  }
  c.font = "12px monospace";
  c.fillStyle = "#6d858c";
  c.fillText("ARENA 01 / PÁTIO DE TESTES", 42, 676);
  c.fillText("PROTÓTIPO • 60 Hz", 1060, 676);
}

/** Image is only the architecture layer; ambient and reactive layers are drawn separately. */
export interface WorldBounds { left: number; top: number; right: number; bottom: number }

/** The inverse of the complete camera transform also handles shake and rotated cinematics. */
export function visibleWorldBounds(c: CanvasRenderingContext2D): WorldBounds {
  const m = c.getTransform().inverse();
  const corners = [[0, 0], [c.canvas.width, 0], [0, c.canvas.height], [c.canvas.width, c.canvas.height]];
  const xs = corners.map(([x, y]) => m.a * x + m.c * y + m.e);
  const ys = corners.map(([x, y]) => m.b * x + m.d * y + m.f);
  return { left: Math.floor(Math.min(...xs)) - 2, top: Math.floor(Math.min(...ys)) - 2,
    right: Math.ceil(Math.max(...xs)) + 2, bottom: Math.ceil(Math.max(...ys)) + 2 };
}

interface Band { at: number; size: number; source: number; reverse: boolean }
function bands(start: number, end: number, limit: number, edge: number): Band[] {
  const result: Band[] = [{ at: 0, size: limit, source: 0, reverse: false }];
  for (let at = -edge, n = 0; at + edge > start; at -= edge, n++)
    result.push({ at, size: edge, source: 0, reverse: n % 2 === 0 });
  for (let at = limit, n = 0; at < end; at += edge, n++)
    result.push({ at, size: edge, source: limit - edge, reverse: n % 2 === 0 });
  return result;
}

const skyColors: Partial<Record<ArenaState["id"], [string, string, string]>> = {
  budokai: ["#226cd4", "#248cec", "#f1f8ff"],
  cairo: ["#031d2d", "#06444c", "#168f87"],
  enies: ["#256cc5", "#238bec", "#edf7ff"],
  anteiku: ["#121b3e", "#28345e", "#606b97"],
  godvalley: ["#2459b2", "#347bd8", "#e3f4ff"],
  clover: ["#1370d2", "#2396ee", "#eaf7ff"],
};

/** Decorative sky is world anchored and never repeats a moon, roof or landmark. */
function drawSky(c: CanvasRenderingContext2D, bounds: WorldBounds, colors: [string, string, string], arena: ArenaState) {
  const grad = c.createLinearGradient(0, Math.min(bounds.top, -600), 0, 0);
  grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]);
  c.fillStyle = grad;
  c.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, -bounds.top + 1);
  const first = Math.floor(bounds.left / 137) - 1, last = Math.ceil(bounds.right / 137) + 1;
  for (let i = first; i <= last; i++) {
    const seed = Math.abs(Math.sin((i + 1) * 83.173 + arena.id.length * 21.31));
    const x = i * 137 + Math.floor(seed * 49);
    const y = -43 - Math.floor(Math.abs(Math.sin(i * 31.7)) * 235);
    if (y < bounds.top - 30 || y > 0) continue;
    if (arena.id === "anteiku") {
      c.fillStyle = colors[2];
      for (let n = 0; n < 5; n++) c.fillRect(x + n * 19, y + n % 3 * 27, 2, 15);
      continue;
    }
    c.fillStyle = colors[2];
    const width = 24 + Math.floor(seed * 32);
    c.fillRect(x, y, width, 3);
    c.fillRect(x + 8, y - 5, width - 13, 5);
    c.fillRect(x + width - 10, y + 3, 18, 2);
    if (arena.id === "cairo") {
      c.fillStyle = "#0d6d70";
      c.fillRect(x + 6, y + 5, width + 13, 2);
    }
  }
}

/** Reflect a substantial edge region, including sky and floor, without stretching pixels or repeating the full scene. */
function drawExtended(c: CanvasRenderingContext2D, image: HTMLImageElement, bounds: WorldBounds, arena: ArenaState) {
  // Narrow modules keep landmarks, moons, gates and entire buildings from repeating in overscan.
  const horizontal = bands(bounds.left, bounds.right, 1280, 96);
  const above = bands(bounds.top, 720, 720, 48);
  const below = bands(0, bounds.bottom, 720, 64).filter(band => band.at >= 720);
  const vertical = [...above.filter(band => band.at >= 0 && band.at < 720), ...below];
  const sx = image.naturalWidth / 1280, sy = image.naturalHeight / 720;
  for (const y of vertical) for (const x of horizontal) {
    if (x.at >= bounds.right || x.at + x.size <= bounds.left || y.at >= bounds.bottom || y.at + y.size <= bounds.top) continue;
    c.save();
    c.translate(x.at + (x.reverse ? x.size : 0), y.at + (y.reverse ? y.size : 0));
    c.scale(x.reverse ? -1 : 1, y.reverse ? -1 : 1);
    // Slight tile overlap prevents subpixel raster gaps when a cinematic rotates the camera.
    c.drawImage(image, x.source * sx, y.source * sy, x.size * sx, y.size * sy, -1, -1, x.size + 2, y.size + 2);
    c.restore();
  }
  const sky = skyColors[arena.id];
  if (bounds.top >= 0) return;
  if (sky === undefined) {
    for (const y of above.filter(band => band.at < 0)) for (const x of horizontal) {
      c.save();
      c.translate(x.at + (x.reverse ? x.size : 0), y.at + (y.reverse ? y.size : 0));
      c.scale(x.reverse ? -1 : 1, y.reverse ? -1 : 1);
      c.drawImage(image, x.source * sx, 0, x.size * sx, 48 * sy, -1, -1, x.size + 2, 50);
      c.restore();
    }
    return;
  }
  drawSky(c, bounds, sky, arena);
}

export function drawArena(c: CanvasRenderingContext2D, arena: ArenaState, image?: HTMLImageElement, _padding = 0, damaged?: HTMLImageElement) {
  const bounds = visibleWorldBounds(c);
  if (!image?.complete || !image.naturalWidth) { drawTestArena(c, Math.ceil(Math.max(0, -bounds.left, bounds.right - 1280))); return; }
  c.save();
  c.imageSmoothingEnabled = false;
  drawExtended(c, image, bounds, arena);
  if (arena.phase && damaged?.complete && damaged.naturalWidth) {
    c.globalAlpha = Math.min(1, Math.max(0, (arena.tick - arena.phaseStart) / 24));
    drawExtended(c, damaged, bounds, arena);
  }
  c.restore();
}
