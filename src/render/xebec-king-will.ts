import type { Fighter } from "../engine/combat";
import { kingWill, xebecPressure, xebecPressureReach } from "../engine/xebec-specials";
import { hakiBolt } from "./xebec-haki-fx";

const pressure = xebecPressure(kingWill)!;
const ease = (from: number, to: number, t: number) => {
  const p = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return p * p * (3 - 2 * p);
};

const pulses = [
  { delay: 0, spread: 1, aspect: .56, strength: .81 },
  { delay: 8, spread: .91, aspect: .62, strength: 1 },
  { delay: 17, spread: 1.03, aspect: .55, strength: 1.17 },
] as const;

export function kingWillFronts(tick: number) {
  return pulses.flatMap((pulse, index) => {
    const age = tick - pressure.release - pulse.delay;
    if (age < 0 || age >= 42) return [];
    const reach = index === 0
      ? xebecPressureReach(pressure, tick)
      : 32 + (pressure.radius * pulse.spread - 32) * (1 - Math.max(0, 1 - age / 25) ** 1.73);
    return [{ index, age, rx: reach, ry: reach * pulse.aspect,
      alpha: pulse.strength * (1 - ease(19, 42, age)) }];
  });
}
type Front = ReturnType<typeof kingWillFronts>[number];
export type KingWillSource = { x: number; y: number; facing: number; tick: number };
const point = (x: number, y: number) => ({ x, y });

function outline(c: CanvasRenderingContext2D, front: Front, cx: number, cy: number, first = 0, last = Math.PI * 2, inset = 0) {
  const count = Math.ceil((last - first) * 14);
  c.beginPath();
  for (let i = 0; i <= count; i++) {
    const theta = first + (last - first) * i / count;
    const ripple = 1 + .019 * Math.sin(theta * 5 + front.index + front.age * .12)
      + .014 * Math.cos(theta * 9 - front.age * .2);
    const x = cx + (front.rx - inset) * ripple * Math.cos(theta);
    const y = cy + (front.ry - inset) * ripple * Math.sin(theta);
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
}

export function drawKingWillArena(c: CanvasRenderingContext2D, sources: KingWillSource[], copy: HTMLCanvasElement, reducedMotion: boolean) {
  if (!sources.length) return;
  let shade = 0;
  for (const fighter of sources) {
    const t = fighter.tick;
    shade = Math.max(shade, ease(4, 31, t) * (1 - ease(57, 96, t)));
  }
  c.save();
  c.fillStyle = `rgba(71,79,88,${shade * .19})`;
  c.fillRect(-90, -70, 1460, 860);

  const ready = sources.flatMap(f => kingWillFronts(f.tick).map(front => ({ f, front })));
  const transform = c.getTransform();
  if (ready.length && !reducedMotion) {
    if (copy.width !== c.canvas.width || copy.height !== c.canvas.height) {
      copy.width = c.canvas.width;
      copy.height = c.canvas.height;
    }
    const buffer = copy.getContext("2d")!;
    buffer.globalCompositeOperation = "copy";
    buffer.drawImage(c.canvas, 0, 0);
  }
  for (const { f, front } of ready) {
    const cy = f.y - 75;
    if (!reducedMotion) {
      // Sample only a narrow annulus from the stage layer before drawing actors.
      // The slight zoom inside that annulus bends scenery under each wave front.
      c.save();
      outline(c, front, f.x, cy);
      c.closePath();
      const outer = Array.from({ length: 64 }, (_, i) => i / 64 * Math.PI * 2);
      for (const [i, angle] of outer.entries()) {
        const x = f.x + Math.max(1, front.rx - 13) * Math.cos(angle);
        const y = cy + Math.max(1, front.ry - 11) * Math.sin(angle);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
      c.clip("evenodd");
      c.globalAlpha = front.alpha * .69;
      c.setTransform(1, 0, 0, 1, 0, 0);
      const x = f.x * transform.a + transform.e, y = cy * transform.d + transform.f;
      c.translate(x, y);
      c.scale(1.021, 1.021);
      c.drawImage(copy, -x, -y);
      c.restore();
    }
    const sheen = c.createLinearGradient(f.x, cy - front.ry, f.x, cy + front.ry);
    sheen.addColorStop(0, "#dfebf268");
    sheen.addColorStop(.49, "#c7d8e72e");
    sheen.addColorStop(1, "#b1c6df43");
    c.globalAlpha = front.alpha * (reducedMotion ? .8 : 1);
    outline(c, front, f.x, cy);
    c.strokeStyle = sheen;
    c.lineWidth = 3.5 - front.index * .48;
    c.stroke();
    outline(c, front, f.x, cy, .24 + front.index * .18, 2.78 + front.index * .18, 7);
    c.strokeStyle = "#d6e6f120";
    c.lineWidth = 7;
    c.stroke();
  }
  c.restore();
}

export function drawKingWillHaki(c: CanvasRenderingContext2D, f: KingWillSource, reduced: boolean) {
  const t = f.tick, intensity = reduced ? .54 : 1;
  c.save();
  c.translate(Math.round(f.x), Math.round(f.y));
  c.scale(f.facing, 1);
  if (t < pressure.release) {
    const focus = ease(0, pressure.release, t);
    c.globalAlpha = (.62 + .31 * focus) * intensity;
    hakiBolt(c, t, 331, point(-51 + 26 * focus, -131), point(1, -88), 4 + focus);
    hakiBolt(c, t, 703, point(48 - 6 * focus, -120), point(10, -100), 3 + focus);
    hakiBolt(c, t, 901, point(45, -44), point(-21, -83), 3);
    if (!reduced) hakiBolt(c, t, 801, point(-31, -9), point(-67, -22), 2.7);
  } else {
    for (const front of kingWillFronts(t)) {
      const { index, age, rx, ry, alpha } = front;
      c.globalAlpha = alpha * intensity * (.48 + index * .14);
      const direction = index % 2 === 0 ? 1 : -1;
      const root = point(-11 + index * 14, -93 + index * 6);
      const rim = point(direction * rx * .57, -75 - ry * (.63 - .21 * index));
      hakiBolt(c, t, 557 + index * 243, root, rim, 5.5 + index * 2);
      hakiBolt(c, t, 211 + index * 173, point(-direction * rx * .3,-77 + ry * .27),
        point(-direction * rx * .87, -67 + ry * .55), 4 + index);
      if (!reduced && index > 0 && age > 5) {
        hakiBolt(c, t, 73 + index * 137, rim,
          point(direction * rx * 1.09, -94 - ry * .78), 6 + index);
        hakiBolt(c, t, 301 + index * 179, point(direction * rx * .78, -42 + ry * .42),
          point(direction * rx * 1.13, -34 + ry * .83), 4 + index);
      }
    }
    if (!reduced) {
      const dust = t - pressure.release;
      c.globalAlpha = (1 - ease(29, 58, dust)) * .47;
      for (let i = 0; i < 23; i++) {
        const sign = i % 2 ? 1 : -1;
        const x = sign * (21 + i * 7 + dust * (3 + i % 3));
        const y = -2 - Math.max(0, Math.sin(dust * .12 + i) * (8 + i % 7));
        c.fillStyle = i % 3 ? "#aeb7be" : "#ddd5c2";
        c.fillRect(x, y, 4 + i % 6, 1 + i % 2);
      }
    }
  }
  c.restore();
}

export function drawKingWillReaction(c: CanvasRenderingContext2D, f: Fighter) {
  const t = f.stateFrame;
  const fade = f.hakiReaction === "collapse" ? 1 - ease(8, 25, t) : 1 - ease(4, 20, t);
  if (fade <= 0) return;
  c.save();
  c.globalAlpha *= fade;
  const cy = f.y - (f.airborne ? 61 : 68);
  for (const direction of [-1, 1]) {
    c.beginPath();
    c.moveTo(f.x + direction * 14, cy - 72);
    c.bezierCurveTo(f.x + direction * 69, cy - 35, f.x + direction * 59, cy + 35, f.x + direction * 31, cy + 63);
    c.strokeStyle = "#bfdbeb5d";
    c.lineWidth = 2;
    c.stroke();
  }
  c.restore();
}
