import { FLOOR } from "../engine/combat";
import type { ArenaState } from "../engine/arenas";
import { lowerLevelOffset, openStage } from "../engine/arena-layouts";

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
function drawExtended(c: CanvasRenderingContext2D, image: HTMLImageElement, bounds: WorldBounds, arena: ArenaState, enclosed = false, edge = 96) {
  if (openStage(arena)) { drawOpenStage(c, image, bounds, arena); return; }
  // Narrow modules keep landmarks, moons, gates and entire buildings from repeating in overscan.
  const horizontal = bands(bounds.left, bounds.right, 1280, edge);
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
  const sky = enclosed ? undefined : skyColors[arena.id];
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

/** Abyss continuation has no repeated buildings, machinery or reflected ground. */
function drawOpenStage(c: CanvasRenderingContext2D, image: HTMLImageElement, b: WorldBounds, a: ArenaState) {
  const sx = image.naturalWidth / 1280, sy = image.naturalHeight / 720;
  // Edge texels extend the authored surface, never a repeated island, cliff root or roof.
  // The 3x3 grid preserves the center's exact collision alignment under any camera zoom.
  const xs = [{ at: b.left, size: -b.left, source: 0, sample: sx },
    { at: 0, size: 1280, source: 0, sample: image.naturalWidth },
    { at: 1280, size: b.right - 1280, source: image.naturalWidth - sx, sample: sx }];
  const ys = [{ at: b.top, size: -b.top, source: 0, sample: sy },
    { at: 0, size: 720, source: 0, sample: image.naturalHeight },
    { at: 720, size: b.bottom - 720, source: image.naturalHeight - sy, sample: sy }];
  for (const y of ys) for (const x of xs) {
    if (x.size <= 0 || y.size <= 0) continue;
    c.drawImage(image, x.source, y.source, x.sample, y.sample, x.at - 1, y.at - 1, x.size + 2, y.size + 2);
  }
  if (b.bottom > 720) {
    // A deep chasm darkens gradually instead of exposing a repeated horizontal image seam.
    const fog = c.createLinearGradient(0, 720, 0, Math.max(1300, b.bottom));
    fog.addColorStop(0, "#07152100"); fog.addColorStop(1, a.id === "clover" ? "#172431ee" : "#070e20f5");
    c.fillStyle = fog; c.fillRect(b.left, 720, b.right - b.left, b.bottom - 720);
    for (let i = 0; i < 90; i++) {
      const x = b.left + ((i * 239) % Math.ceil(b.right - b.left)), y = 740 + i * 53 % Math.max(1, b.bottom - 740);
      c.fillStyle = a.id === "clover" ? "#65715b30" : "#364c7130";
      c.fillRect(Math.round(x), Math.round(y), 3 + i % 5 * 3, 2);
    }
  }
}

/** Keep the approved upper arena intact; the larger painting only continues the abyss.
 * Both pictures keep their aspect ratio; the join lies below the combat floor. */
function drawOpenWorld(c: CanvasRenderingContext2D, upper: HTMLImageElement, lower: HTMLImageElement, b: WorldBounds, arena: ArenaState) {
  const clover = arena.id === "clover";
  const width = clover ? 2160 : 2240, height = width * lower.naturalHeight / lower.naturalWidth;
  const top = clover ? -188 : -304;
  c.fillStyle = clover ? "#293e58" : "#080e21";
  c.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  c.save();
  c.beginPath(); c.rect(b.left, 720, b.right - b.left, Math.max(0, b.bottom - 720)); c.clip();
  c.drawImage(lower, 640 - width / 2, top, width, height);
  c.restore();
  // Existing overscan modules are sampled at their original proportions, never stretched.
  c.save(); c.beginPath(); c.rect(b.left, b.top, b.right - b.left, Math.max(0, 720 - b.top)); c.clip();
  // These margins exclude the main island, so overscan cannot invent extra platforms.
  const edge = clover ? 128 : 180;
  drawExtended(c, upper, b, { ...arena, mode: "classico" }, false, edge);
  c.drawImage(upper, 0, 0, 1280, 720); c.restore();
  // Match boundary colors below the original picture without overlapping either platform.
  const sx = upper.naturalWidth / 1280;
  for (let y = 720; y < 784; y += 4) {
    c.globalAlpha = (784 - y) / 64;
    for (const x of bands(b.left, b.right, 1280, edge)) {
      c.save(); c.translate(x.at + (x.reverse ? x.size : 0), y); c.scale(x.reverse ? -1 : 1, 1);
      c.drawImage(upper, x.source * sx, upper.naturalHeight - 1, x.size * sx, 1, 0, 0, x.size, 4); c.restore();
    }
  }
  c.globalAlpha = 1;
}

export function drawArena(c: CanvasRenderingContext2D, arena: ArenaState, image?: HTMLImageElement, _padding = 0, damaged?: HTMLImageElement, lower?: HTMLImageElement, world?: HTMLImageElement) {
  const bounds = visibleWorldBounds(c);
  c.save();
  c.imageSmoothingEnabled = false;
  // Opaque safety coverage is also required before a texture finishes decoding.
  c.fillStyle = "#1b2934";
  c.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  if (!image?.complete || !image.naturalWidth) {
    drawTestArena(c, Math.ceil(Math.max(0, -bounds.left, bounds.right - 1280)));
    c.restore(); return;
  }
  if (openStage(arena) && world?.complete && world.naturalWidth) {
    drawOpenWorld(c, image, world, bounds, arena);
    c.restore(); return;
  }
  if (arena.level && lower?.complete && lower.naturalWidth) {
    drawExtended(c, lower, bounds, arena, true);
    c.restore(); return;
  }
  drawExtended(c, image, bounds, arena);
  if (arena.phase && damaged?.complete && damaged.naturalWidth) {
    c.globalAlpha = Math.min(1, Math.max(0, (arena.tick - arena.phaseStart) / 24));
    drawExtended(c, damaged, bounds, arena);
  }
  c.globalAlpha = 1;
  if (arena.transition && lower?.complete && lower.naturalWidth) {
    c.save();
    c.beginPath(); c.rect(bounds.left, 720, bounds.right - bounds.left, Math.max(0, bounds.bottom - 720)); c.clip();
    c.fillStyle = arena.id === "enies" ? "#45546a" : "#68543d";
    c.fillRect(bounds.left, 720, bounds.right - bounds.left, 40);
    c.translate(0, lowerLevelOffset);
    c.beginPath(); c.rect(bounds.left, 0, bounds.right - bounds.left, Math.max(0, bounds.bottom - lowerLevelOffset)); c.clip();
    drawExtended(c, lower, visibleWorldBounds(c), arena, true);
    c.restore();
  }
  c.restore();
}
