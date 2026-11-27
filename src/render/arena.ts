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
export function drawArena(c: CanvasRenderingContext2D, arena: ArenaState, image?: HTMLImageElement, padding = 0, damaged?: HTMLImageElement) {
  if (!image?.complete || !image.naturalWidth) { drawTestArena(c, padding); return; }
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(image, 0, 0, 1280, 720);
  if (arena.phase && damaged?.complete && damaged.naturalWidth) {
    c.globalAlpha = Math.min(1, Math.max(0, (arena.tick - arena.phaseStart) / 24));
    c.drawImage(damaged, 0, 0, 1280, 720);
    c.globalAlpha = 1;
  }
  if (padding) {
    c.drawImage(image, 0, 0, 2, image.naturalHeight, -padding, 0, padding, 720);
    c.drawImage(image, image.naturalWidth - 2, 0, 2, image.naturalHeight, 1280, 0, padding, 720);
  }
  c.restore();
}
