import config from "../data/road-roller.json";
export { config as roadConfig };
export interface RoadRollerState {
  attacker: number;
  victim: number;
  tick: number;
  scale: number;
  facing: number;
  originX: number;
  targetX: number;
  targetY?: number;
  rollerX: number;
  landingX: number;
  standOriginX: number;
  standOriginY: number;
}
export type RoadPhase = keyof typeof config.phases;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const progress = (t: number, a: number, b: number) =>
  clamp((t - a) / (b - a), 0, 1);
const ease = (v: number) => v * v * (3 - 2 * v);
const lerp = (a: number, b: number, v: number) => a + (b - a) * v;
export function roadPhase(tick: number): RoadPhase {
  let result: RoadPhase = "activation";
  for (const [name, start] of Object.entries(config.phases))
    if (tick >= start) result = name as RoadPhase;
  return result;
}
/** A pure fixed-tick stage. Actor positions, independent sprite clocks,
 * machine position and camera are derived from one serializable timeline. */
export function roadScene(s: RoadRollerState) {
  const t = s.tick,
    p = config.phases,
    phase = roadPhase(t),
    f = s.facing;
  let ax = s.originX,
    ay = 580,
    ac = "roadUltimateStart",
    at = t;
  let sx = lerp(
      s.standOriginX,
      ax - 30 * f,
      ease(progress(t, 0, p.preparation)),
    ),
    sy = lerp(s.standOriginY, 562, ease(progress(t, 0, p.preparation))),
    sc = "roadUltimateStart",
    st = t,
    depth = 0;
  let oy = 580,
    objectClip = "roadBase",
    objectTick = 0,
    visible = false;
  const perchX = clamp(s.rollerX - 50 * f, 60, 1220),
    perchY = 455;
  if (t >= p.preparation && t < p.ascent) {
    ac = "roadFlyingPreparation";
    at = t - p.preparation;
    sc = "roadFlyingPreparation";
    st = at;
  }
  if (t >= p.ascent && t < p.offscreen) {
    const u = progress(t, p.ascent, p.offscreen);
    ax = lerp(s.originX, perchX, ease(u));
    ay = 580 - 920 * u * u;
    ac = "roadFlyingUp";
    at = t - p.ascent;
    sc = "roadFlyingUp";
    st = at;
    sx = ax - 30 * f;
    sy = ay - 22;
  }
  if (t >= p.offscreen && t < p.descent) {
    ax = perchX;
    ay = -340;
    sx = ax - 30 * f;
    sy = -370;
    ac = "roadFlyingUp";
    sc = "roadFlyingUp";
    at = t - p.ascent;
    st = at;
  }
  if (t >= p.descent && t < p.impact) {
    const u = progress(t, p.descent, p.impact);
    oy = lerp(-220, 580, u * u);
    ax = perchX;
    ay = oy - 64;
    ac = "roadReturning";
    at = t - p.descent;
    sx = s.rollerX - f * 110;
    sy = oy - 75;
    sc = "roadCarrying";
    st = at;
    depth = 20;
    visible = true;
    objectClip = "roadFalling";
    objectTick = at;
  }
  if (t >= p.impact && t < p.explosion) {
    visible = true;
    ax = perchX;
    ay = perchY;
    ac = t < p.barrage ? "roadImpactPose" : "roadRollerPose";
    at = t - (t < p.barrage ? p.impact : p.barrage);
    const grip = ease(progress(t, p.impact, p.barrage));
    sx = lerp(s.rollerX - f * 110, s.rollerX + f * 30, grip);
    sy = lerp(505, 570, grip);
    depth = 20;
    sc =
      t < p.barrage
        ? "roadReposition"
        : t < p.barrage + 12
          ? "roadFirstPunch"
          : t < p.finisher
            ? "roadBarrage"
            : "roadFinalHeavy";
    st =
      t < p.barrage
        ? t - p.impact
        : t < p.finisher
          ? t - p.barrage
          : t - p.finisher;
    objectClip = t < p.barrage ? "roadImpact" : "roadPunched";
    objectTick = t - (t < p.barrage ? p.impact : p.barrage);
  }
  if (t >= p.explosion && t < p.landing) {
    const u = ease(progress(t, p.explosion, p.landing));
    ax = lerp(perchX, s.landingX, u);
    ay = lerp(perchY, 580, u);
    ac = "roadUltimateFinish";
    at = t - p.explosion;
    sx = lerp(s.rollerX + f * 30, s.landingX - 30 * f, u);
    sy = lerp(570, 562, u);
    sc = "roadUltimateRecovery";
    st = t - p.explosion;
    depth = u > 0.6 ? 0 : 20;
    visible = t < p.smoke + 4;
    objectClip = "roadExplosion";
    objectTick = t - p.explosion;
  }
  if (t >= p.landing) {
    ax = s.landingX;
    ay = 580;
    ac = t < p.finish ? "roadUltimateFinish" : "roadReturnIdle";
    at = t - (t < p.finish ? p.explosion : p.finish);
    sx = ax - 30 * f;
    sy = 562;
    sc = "roadReturnBehind";
    st = t - p.landing;
    depth = 0;
  }
  const scale: 1 | 2 =
    t < p.offscreen || (t >= p.descent && t < p.landing) ? 2 : 1;
  const cx = clamp(
    t < p.descent ? (s.originX + s.targetX) / 2 : s.rollerX,
    640 / scale,
    1280 - 640 / scale,
  );
  let cy = 580;
  if (t >= p.ascent && t < p.offscreen)
    cy -= 100 * ease(progress(t, p.ascent, p.offscreen));
  let shake = 0;
  for (const hit of [
    p.impact,
    ...config.punchTicks,
    config.finalPunchTick,
    p.explosion,
  ]) {
    const age = t - hit;
    if (age >= 0 && age < config.shake.length)
      shake +=
        config.shake[age] *
        (hit === p.explosion ? 1.4 : hit === p.impact ? 1 : 0.35);
  }
  return {
    phase,
    attacker: { x: ax, y: ay, clip: ac, tick: at },
    stand: { x: sx, y: sy, clip: sc, tick: st, depth },
    object: {
      x: s.rollerX,
      y: oy,
      clip: objectClip,
      tick: objectTick,
      visible,
    },
    victim: {
      x: s.targetX,
      y: lerp(s.targetY ?? 580, 580, ease(progress(t, 0, p.preparation))),
      clip: t < p.impact ? "damageMedium" : "downed",
      tick: t < p.impact ? t % 12 : t - p.impact,
    },
    camera: {
      scale,
      x: cx,
      y: cy,
      anchorY: scale === 2 ? 660 : 580,
      shakeX: Math.round(clamp(shake, -10, 10)),
      shakeY: Math.round(clamp(-shake * 0.5, -6, 6)),
    },
  };
}
