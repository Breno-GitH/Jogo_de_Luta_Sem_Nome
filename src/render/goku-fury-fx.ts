import type { Match } from "../engine/combat";
import { furyConfig, furyScene, furyRelease } from "../engine/goku-fury";
import data from "../data/goku-fury-fx.json";
export const furyFxSheets = Object.values(data.clips).map((c) => c.sheet);
type Key = keyof typeof data.clips;
export function drawFury(
  c: CanvasRenderingContext2D,
  m: Match,
  images: Map<string, HTMLImageElement>,
  layer: "behind" | "front",
) {
  const fx = (
    key: Key,
    t: number,
    x: number,
    y: number,
    w: number,
    h: number,
    opacity = 1,
  ) => {
    const meta = data.clips[key],
      im = images.get(meta.sheet);
    if (!im?.complete || !im.naturalWidth || opacity <= 0) return;
    const n = Math.max(0, Math.floor(t)) % meta.frames,
      b = meta.bounds[n],
      cell = "cell" in meta ? meta.cell : 128;
    c.save();
    c.globalAlpha = opacity;
    c.drawImage(
      im,
      n * cell + b[0],
      b[1],
      b[2] - b[0],
      b[3] - b[1],
      Math.round(x - w / 2),
      Math.round(y - h / 2),
      Math.round(w),
      Math.round(h),
    );
    c.restore();
  };
  const s = m.fury,
    scene = s ? furyScene(s) : undefined;
  const actors = s
    ? [m.fighters[s.attacker]]
    : m.fighters.filter(
        (f) =>
          f.data.id === "goku" &&
          f.state === "attack" &&
          f.moveId === "ssj1_fury",
      );
  for (const f of actors) {
    const t = s ? s.tick : f.stateFrame,
      active = !!s;
    if (layer === "behind") {
      const strength = active
        ? t < 398
          ? 1
          : Math.max(0, (430 - t) / 32)
        : t < 24
          ? 0
          : t < 70
            ? (t - 24) / 46
            : t < 111
              ? 1
              : Math.max(0, (159 - t) / 48);
      if (strength > 0) {
        fx(
          "goldenAura",
          t / 4,
          f.x,
          f.y - 79,
          104 + Math.round(strength * 35),
          140 + Math.round(strength * 32),
          0.7 * strength,
        );
        if (t % 6 < 4)
          fx(
            "energyParticles",
            0,
            f.x + ((t * 7) % 47) - 23,
            f.y - 90,
            90,
            130,
            0.55 * strength,
          );
      }
      c.fillStyle = active && t >= 278 && t < 344 ? "#6ecfff22" : "#ffcf6110";
      if (strength > 0) c.fillRect(-640, -720, 2560, 1600);
    } else {
      if (!active && t >= 66 && t < 74)
        fx(
          "transformationFlash",
          Math.floor((t - 66) / 4),
          f.x,
          f.y - 82,
          155,
          155,
          (74 - t) / 8,
        );
      if (!active && t >= 88 && t < 105) {
        for (let i = 0; i < 5; i++) {
          c.fillStyle = i % 2 ? "#ffe780" : "#ad811e";
          c.fillRect(
            Math.round(f.x - f.facing * (26 + i * 12)),
            Math.round(f.y - 98 + i * 13),
            f.facing * 18,
            2,
          );
        }
      }
    }
  }
  if (!s || !scene || layer === "behind") return;
  const a = scene.attacker,
    b = scene.victim,
    t = s.tick;
  if (t >= 104 && t < 224) {
    const q = (t - 104) % 24;
    if (q < 12) fx("teleport", q / 3, a.x, a.y - 75, 52, 150, 0.9);
  }
  if (t >= 224 && t < 233)
    fx("teleport", (t - 224) / 3, a.x, a.y - 75, 52, 150, 0.9);
  if (t >= 233 && t < 278) {
    const size = 8 + Math.round(((t - 233) / 45) * 32),
      hand = furyRelease(a.clip, a.tick);
    fx(
      "kamehamehaCharge",
      Math.floor((t - 233) / 8),
      a.x + hand.x * a.facing,
      a.y + hand.y,
      size,
      size,
    );
  }
  if (scene.beam.active) {
    const age = scene.beam.age,
      growth = Math.min(1, age / 8),
      fade = t >= 344 ? Math.max(0, (350 - t) / 6) : 1;
    const from = scene.beam.from,
      to = scene.beam.to,
      dx = (to.x - from.x) * growth,
      dy = (to.y - from.y) * growth;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))),
      width = Math.max(2, Math.round((18 + (age % 6)) * growth * fade));
    // A bounded staircase raster gives the diagonal beam hard native pixel
    // edges. Independent animated textures add the origin, core and impact.
    for (const [color, k] of [
      ["#1268c4", 1.4],
      ["#68ddff", 1],
      ["#e4ffff", 0.55],
    ] as const) {
      c.fillStyle = color;
      const w = Math.max(1, Math.round(width * k));
      for (let i = 0; i <= steps; i += 2) {
        const v = i / Math.max(1, steps);
        c.fillRect(
          Math.round(from.x + dx * v - w / 2),
          Math.round(from.y + dy * v - w / 2),
          w,
          w,
        );
      }
    }
    for (let i = 1; i < 7; i++) {
      const v = i / 7;
      fx(
        "beamBody",
        age / 3,
        from.x + dx * v,
        from.y + dy * v,
        24 * fade,
        38 * fade,
        0.65,
      );
    }
    fx(
      "beamOrigin",
      age / 3,
      from.x,
      from.y,
      44 * growth * fade,
      44 * growth * fade,
    );
    fx(
      "beamTip",
      age / 3,
      from.x + dx,
      from.y + dy,
      50 * growth * fade,
      65 * growth * fade,
    );
    if (age > 8) fx("groundImpact", age / 3, b.x, b.y - 55, 60, 75);
  }
  const recent = furyConfig.hits
    .filter((h) => h.tick <= t && t - h.tick < 8)
    .at(-1);
  if (recent && recent.kind !== "beam" && recent.kind !== "explosion")
    fx(
      recent.kind === "kick" ? "kickImpact" : "punchImpact",
      (t - recent.tick) / 2,
      b.x,
      b.y - 78,
      36,
      36,
    );
  if (t >= 330 && t < 356)
    fx(
      "energyExplosion",
      Math.min(3, (t - 330) / 6),
      b.x,
      520,
      Math.min(250, 100 + (t - 330) * 9),
      Math.min(220, 80 + (t - 330) * 9),
    );
  if (t >= 346 && t < 390)
    fx(
      "smoke",
      Math.min(3, (t - 346) / 10),
      b.x,
      551,
      180,
      100,
      (390 - t) / 44,
    );
  if (t >= 410 && t < 430)
    fx(
      "auraDisappearance",
      (t - 410) / 4,
      a.x,
      a.y - 76,
      110,
      150,
      (430 - t) / 25,
    );
}
