import type { Fighter, Match } from "./combat";
import type { KiProjectile, KiBeam } from "./goku-specials";
import { beamBox } from "./goku-specials";
import { shapesOverlap, shapeHitsRect } from "./geometry";
import { astaSpecialBlade } from "./asta-specials";
/** Explicit adaptation policy: regular Ki and small Katon are eligible energy.
 * Physical steel, rocks, Haki, anti-magic, dragon waves and Supers are excluded. */
export function neutralizableEnergy(owner: Fighter, p: KiProjectile | KiBeam) {
  const source = owner.data.specialMoves?.[p.move];
  if (
    !source ||
    source.super ||
    source.kind === "ultimate" ||
    ("wave" in p && p.wave)
  )
    return false;
  return (
    (owner.data.id === "goku" &&
      (source.special === "ki" || source.special === "kamehameha")) ||
    (owner.data.id === "sasuke" && ["gokakyu", "hosenka"].includes(p.move))
  );
}
export function stepAstaAntimagic(m: Match) {
  for (const f of m.fighters) {
    if (
      !f.asta ||
      f.asta.neutralized ||
      f.state !== "attack" ||
      f.moveId !== "astaCausalityBreak" ||
      f.stateFrame < 7 ||
      f.stateFrame >= 12 ||
      m.temporal.isFrozen(f.id)
    )
      continue;
    const b = astaSpecialBlade("astaCausalityBreak", f.stateFrame);
    const shape = {
      a: { x: f.x + b.a.x * f.facing, y: f.y + b.a.y },
      b: { x: f.x + b.b.x * f.facing, y: f.y + b.b.y },
      r: 18,
    };
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
    if (!p && !beam) continue;
    const hit = p || beam;
    if (!hit) continue;
    if (p) {
      p.state = "impact";
      p.impactAge = 0;
      p.vx = p.vy = 0;
    } else if (beam) {
      beam.state = "dissipate";
      beam.age = 0;
      beam.life = 8;
    }
    f.asta.neutralized = 1;
    m.events.push({
      kind: "counter",
      x: p ? hit.x : shape.a.x,
      y: p ? hit.y : shape.a.y,
      life: 12,
      total: 12,
      blocked: false,
      asta: { kind: "break", actor: f.id },
    });
  }
}
