import type { Point } from "../engine/types";

const mix = (a: number, b: number, n: number) => a + (b - a) * n;

function unit(seed: number) {
  let n = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function stroke(c: CanvasRenderingContext2D, points: readonly Point[], width: number, alpha: number) {
  const first = points[0], last = points.at(-1)!;
  if (first.x === last.x && first.y === last.y) return;
  c.save();
  c.globalAlpha *= alpha;
  c.lineJoin = "bevel";
  const rim = c.createLinearGradient(first.x, first.y, last.x, last.y);
  rim.addColorStop(0, "#ff535f");
  rim.addColorStop(.5, "#be213f");
  rim.addColorStop(1, "#5d122a");
  c.beginPath();
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    if (i) c.lineTo(Math.round(x), Math.round(y));
    else c.moveTo(Math.round(x), Math.round(y));
  }
  c.lineWidth = width + 5;
  c.strokeStyle = "rgba(255,24,61,.15)";
  c.stroke();
  c.lineWidth = width + 2;
  c.strokeStyle = rim;
  c.stroke();
  c.lineWidth = width;
  c.strokeStyle = "#09040a";
  c.stroke();
  c.restore();
}

/** Stable geometry for a single spell of a branch, with a different cadence
 * and silhouette for each origin. Only the renderer consumes the seeds. */
export function hakiBolt(c: CanvasRenderingContext2D, tick: number, seed: number, from: Point, to: Point, width = 3) {
  const interval = 3 + Math.floor(unit(seed + 74) * 5);
  const epoch = Math.floor((tick + seed % 31) / interval);
  const local = epoch * 4111 + seed * 77;
  const age = ((tick + seed % 31) % interval) / interval;
  if (unit(local + 14) < .12 || age > .85 && unit(local + 21) < .55) return;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const count = Math.min(11, Math.max(4, Math.ceil(length / 19)));
  const points = [from];
  for (let i = 1; i <= count; i++) {
    const t = i === count ? 1 : (i - unit(local + i * 8) * .57) / count;
    const jitter = i === count ? .1 : 1;
    const kink = (unit(local + i * 5) - .5) * Math.min(70, length * .33) * jitter;
    const turn = (unit(local + i * 7) - .5) * Math.min(45, length * .18) * jitter;
    points.push({ x: mix(from.x, to.x, t) + turn, y: mix(from.y, to.y, t) + kink });
  }
  const split = 2 + Math.floor(unit(local + 5) * (count - 2));
  stroke(c, points, width, .95 - age * .29);
  const branches = width > 4 ? 3 : 2;
  for (let i = 0; i < branches; i++) {
    const index = 1 + (split + i * 2) % (count - 1);
    const origin = points[index], side = unit(local + i * 123) > .5 ? 1 : -1;
    const drift = (unit(local + i * 6) - .5) * length * .72;
    const rise = side * (9 + unit(local + i * 100) * Math.min(42, length * .53));
    const tail = { x: origin.x + drift, y: origin.y + rise };
    const fork = [
      origin, { x: origin.x + drift * .45, y: origin.y + rise * .21 - side * 4 },
      { x: origin.x + drift * .78, y: origin.y + rise * .76 + side * 5 }, tail,
    ];
    stroke(c, age < .57 ? fork : fork.slice(1), Math.max(1, width * .51), .82 - age * .5);
    if (age < .32) {
      c.fillStyle = i % 2 ? "#d92c48" : "#ff8c83";
      c.fillRect(Math.round(origin.x) - 1, Math.round(origin.y), 3, 2);
    }
  }
}

export function hakiBurst(c: CanvasRenderingContext2D, tick: number, origin: Point, radius: number, count: number, seed: number, lift = 0) {
  for (let i = 0; i < count; i++) {
    const angle = (i + unit(seed + 9 * i) * .85) * Math.PI * 2 / count;
    const spread = radius * (.58 + unit(seed + 17 * i) * .42);
    hakiBolt(c, tick, seed + i * 73, origin, {
      x: origin.x + spread * Math.cos(angle), y: origin.y + spread * Math.sin(angle) - lift,
    }, Math.min(8, 2 + spread / 37));
  }
}
