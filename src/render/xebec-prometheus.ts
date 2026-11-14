import type { pandemoniumScene } from "../engine/xebec-pandemonium";

type Sun = NonNullable<ReturnType<typeof pandemoniumScene>["prometheus"]>;
export const prometheusSheet = "xebec/prometheus.png";

export function drawPrometheusLight(c: CanvasRenderingContext2D, sun: Sun) {
  const r = sun.size * 1.36;
  const heat = c.createRadialGradient(sun.x, sun.y + 22, 3, sun.x, sun.y + 22, r);
  heat.addColorStop(0, "#ffda715e");
  heat.addColorStop(.48, "#ff9c4933");
  heat.addColorStop(1, "#ed563400");
  c.save();
  c.globalAlpha *= sun.opacity;
  c.fillStyle = heat;
  c.fillRect(sun.x - r, sun.y + 22 - r, r * 2, r * 2);
  c.restore();
}

export function drawPrometheusFire(c: CanvasRenderingContext2D, sun: Sun, tick: number) {
  if (sun.jet <= 0) return;
  const mouthX = sun.x + sun.facing * sun.size * .16, mouthY = sun.y + sun.size * .16;
  const dx = sun.aimX - mouthX, dy = sun.aimY - mouthY;
  const length = Math.hypot(dx, dy);
  c.save();
  c.globalAlpha *= sun.jet * sun.opacity;
  c.translate(mouthX, mouthY);
  c.rotate(Math.atan2(dy, dx));
  for (const [i, color] of ["#8c2b37", "#ed632c", "#ffb74d", "#fff2a0"].entries()) {
    const spread = (4 - i) * 11;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -5 - spread * .1);
    for (let j = 1; j < 11; j++) {
      const p = j / 11;
      const lick = Math.sin(j * 12 + tick * .54 + i * 1.9);
      c.lineTo(length * p, -Math.sin(p * Math.PI) * spread * (.54 + .41 * lick));
    }
    c.lineTo(length + spread / 3, 0);
    for (let j = 10; j > 0; j--) {
      const p = j / 11;
      c.lineTo(length * p, Math.sin(p * Math.PI) * spread * (.68 + .35 * Math.cos(j * 11 + tick * .47)));
    }
    c.lineTo(0, 7 + spread * .085);
    c.fill();
  }
  for (let i = 0; i < 19; i++) {
    const p = ((tick * (3 + i % 5) + i * 13) % 93) / 93;
    const x = length * p, y = Math.sin(i * 21.9) * p * 99;
    c.fillStyle = i % 3 ? "#ff8557" : "#ffe393";
    c.fillRect(Math.round(x), Math.round(y), 3 + i % 6, 2 + i % 3);
  }
  c.restore();
}

export function drawPrometheus(c: CanvasRenderingContext2D, sun: Sun, image: HTMLImageElement, effects: boolean, tick: number) {
  if (effects) drawPrometheusFire(c, sun, tick);
  c.save();
  c.translate(Math.round(sun.x), Math.round(sun.y));
  c.scale(sun.facing, 1);
  c.globalAlpha *= sun.opacity;
  const extent = sun.size * (192 / 155);
  c.drawImage(image, sun.cel % 4 * 192, Math.floor(sun.cel / 4) * 192, 192, 192,
    -extent / 2, -extent / 2, extent, extent);
  c.restore();
}
