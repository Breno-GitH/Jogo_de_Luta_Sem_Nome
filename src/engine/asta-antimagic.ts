import type { Fighter, Match } from "./combat";
import type { KiProjectile, KiBeam } from "./goku-specials";
import { beamBox } from "./goku-specials";
import { shapesOverlap, shapeHitsRect } from "./geometry";
import {
  astaSpecialBlade,
  astaSpecialGrip,
  astaWaveVolume,
} from "./asta-specials";
import { causalityBalance, stepAstaCausality } from "./asta-causality";
import type { Capsule, Point } from "./types";
const legacyEnergy: Record<string, readonly string[]> = {
  goku: [
    "ki_light",
    "ki_medium",
    "ki_heavy",
    "kamehameha_light",
    "kamehameha_medium",
    "kamehameha_heavy",
  ],
  sasuke: ["gokakyu", "hosenka"],
};
/** Explicit gameplay classification, independent of visual color. Future producers may opt in through Move.energy. */
export function neutralizableEnergy(owner: Fighter, p: KiProjectile | KiBeam) {
  const source = owner.data.specialMoves?.[p.move];
  if (
    !source ||
    source.super ||
    source.kind === "ultimate" ||
    ("wave" in p && p.wave)
  )
    return false;
  if (source.energy)
    return source.energy.nature === "magic" && source.energy.causalityBreak;
  return legacyEnergy[owner.data.id]?.includes(p.move) ?? false;
}
/** Local-space points. The same deterministic ribbon paths drive interception and pixel rendering. */
export function causalityRibbons(f: Fighter, t = f.stateFrame): Point[][] {
  if (
    f.moveId !== "astaCausalityBreak" ||
    f.state !== "attack" ||
    t < causalityBalance.activeFrom ||
    t >= causalityBalance.activeTo
  )
    return [];
  const grip = astaSpecialGrip("astaCausalityBreak", t),
    a = (grip.angle * Math.PI) / 180;
  const root = { x: grip.x + Math.cos(a) * 63, y: grip.y + Math.sin(a) * 63 };
  const gain = Math.max(0, Math.min(1, (t - 11) / 6, (32 - t) / 6));
  return [
    [-151, 58],
    [-78, 105],
    [-5, 128],
    [48, 108],
    [139, 76],
  ].map(([angle, length], i) => {
    const phase = t * 0.23 + i * 1.73 + (f.asta!.cast % 7) * 0.7;
    const direction = ((angle + Math.sin(phase * 0.4) * 7) * Math.PI) / 180;
    const dx = Math.cos(direction) * length * gain,
      dy = Math.sin(direction) * length * gain;
    const nx = -Math.sin(direction),
      ny = Math.cos(direction);
    const curl =
      (i % 2 ? -1 : 1) * length * gain * (0.35 + Math.sin(phase) * 0.12);
    const first = {
      x: root.x + dx * 0.18 + nx * curl,
      y: root.y + dy * 0.18 + ny * curl,
    };
    const second = {
      x: root.x + dx * 0.84 - nx * curl * 0.8,
      y: root.y + dy * 0.84 - ny * curl * 0.8,
    };
    const tip = { x: root.x + dx, y: root.y + dy };
    // Smooth cubic streams, not a radial set of straight electric spokes.
    return Array.from({ length: 13 }, (_, j) => {
      const u = j / 12,
        v = 1 - u;
      return {
        x:
          v * v * v * root.x +
          3 * v * v * u * first.x +
          3 * v * u * u * second.x +
          u * u * u * tip.x,
        y:
          v * v * v * root.y +
          3 * v * v * u * first.y +
          3 * v * u * u * second.y +
          u * u * u * tip.y,
      };
    });
  });
}
export function causalityVolumes(f: Fighter): Capsule[] {
  return causalityRibbons(f).flatMap((path) =>
    path.slice(1).map((b, i) => ({
      a: { x: f.x + path[i].x * f.facing, y: f.y + path[i].y },
      b: { x: f.x + b.x * f.facing, y: f.y + b.y },
      r: 7,
    })),
  );
}
function dissipate(
  m: Match,
  f: Fighter,
  p?: KiProjectile,
  beam?: KiBeam,
  shape?: Capsule,
) {
  if (p) {
    p.state = "impact";
    p.impactAge = 0;
    p.vx = p.vy = 0;
  }
  if (beam) {
    beam.state = "dissipate";
    beam.age = 0;
    beam.life = 8;
  }
  f.asta!.neutralized++;
  m.events.push({
    kind: "counter",
    x: p?.x ?? shape!.b.x,
    y: p?.y ?? shape!.b.y,
    life: 12,
    total: 12,
    blocked: false,
    asta: { kind: "break", actor: f.id },
  });
}
export function stepAstaAntimagic(m: Match) {
  for (const f of m.fighters) {
    if (!f.asta || m.temporal.isFrozen(f.id)) continue;
    stepAstaCausality(f);
    const restore = f.moveId === "astaCausalityBreak",
      relay =
        f.moveId === "astaDualBreak" &&
        f.asta.relay?.phase === "branch" &&
        f.asta.relay.sword === "destroyer";
    if (f.state !== "attack" || (!restore && !relay)) continue;
    const max = restore ? causalityBalance.neutralizations : 1;
    let shapes: Capsule[] = [];
    if (restore) shapes = causalityVolumes(f);
    else if (f.stateFrame >= 7 && f.stateFrame < 20) {
      const b = astaSpecialBlade("astaDualBreak", f.stateFrame, f.asta.relay);
      shapes = [
        {
          a: { x: f.x + b.a.x * f.facing, y: f.y + b.a.y },
          b: { x: f.x + b.b.x * f.facing, y: f.y + b.b.y },
          r: 18,
        },
      ];
    }
    for (const shape of shapes) {
      if (f.asta.neutralized >= max) break;
      const p = m.kiProjectiles.find(
        (p) =>
          p.owner !== f.id &&
          p.state === "flight" &&
          neutralizableEnergy(m.fighters[p.owner], p) &&
          shapesOverlap(shape, {
            a: { x: p.x, y: p.y },
            b: { x: p.x + p.vx, y: p.y + p.vy },
            r: p.radius,
          }),
      );
      const beam =
        !p &&
        m.beams.find(
          (p) =>
            p.owner !== f.id &&
            p.state === "active" &&
            neutralizableEnergy(m.fighters[p.owner], p) &&
            shapeHitsRect(shape, beamBox(p)),
        );
      if (p || beam) dissipate(m, f, p, beam || undefined, shape);
    }
  }
  // Flying anti-magic cuts collide with explicitly eligible energy, never physical steel or a Super.
  for (const slash of m.kiProjectiles) {
    const owner = m.fighters[slash.owner];
    if (
      !owner.asta ||
      slash.state !== "flight" ||
      !["astaBlackSlash", "astaDualBreak"].includes(slash.move)
    )
      continue;
    const other = m.kiProjectiles.find(
      (p) =>
        p.owner !== slash.owner &&
        p.state === "flight" &&
        neutralizableEnergy(m.fighters[p.owner], p) &&
        shapesOverlap(astaWaveVolume(slash), {
          a: { x: p.x, y: p.y },
          b: { x: p.x + p.vx, y: p.y + p.vy },
          r: p.radius,
        }),
    );
    if (!other) continue;
    for (const p of [slash, other]) {
      p.state = "impact";
      p.impactAge = 0;
      p.vx = p.vy = 0;
    }
    m.events.push({
      kind: "counter",
      x: other.x,
      y: other.y,
      life: 12,
      total: 12,
      blocked: false,
      asta: { kind: "break", actor: owner.id },
    });
  }
}
