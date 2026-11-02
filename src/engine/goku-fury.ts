import config from "../data/goku-fury.json";
import type { Fighter } from "./combat";
import contacts from "../data/goku-fury-contacts.json";
import releases from "../data/goku-fury-release.json";
export { config as furyConfig };
export interface FuryState {
  attacker: number;
  victim: number;
  tick: number;
  scale: number;
  facing: number;
  originX: number;
  targetX: number;
  targetY: number;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const u = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
export function canStartFury(f: Fighter) {
  return (
    f.data.id === "goku" &&
    !!f.data.superMoves?.ssj1_fury &&
    f.meter >= config.cost &&
    !f.airborne &&
    !!f.match &&
    !f.match.fury &&
    !f.match.roadRoller &&
    !f.match.capture &&
    (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
      f.state,
    ) ||
      f.canSuperCancel())
  );
}
/** Contact points are authored in native sprite coordinates, relative to the
 * shared pivot. They also drive cinematic staging; no invisible remote hit. */
export const furyContacts: Record<string, { x: number; y: number }> = contacts;
export function furyRelease(clip: string, tick: number) {
  const entries = (
    releases as Record<string, { ticks: number; x: number; y: number }[]>
  )[clip];
  if (!entries) return { x: -12, y: -76 };
  const total = entries.reduce((s, e) => s + e.ticks, 0);
  let t =
    clip === "furyKamehamehaMaintain"
      ? tick % total
      : Math.min(tick, total - 1);
  for (const entry of entries) {
    if (t < entry.ticks) return entry;
    t -= entry.ticks;
  }
  return entries.at(-1)!;
}
type Key = [number, number, number];
function track(t: number, keys: Key[]) {
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i],
        v = smooth(u(t, a[0], b[0]));
      return { x: mix(a[1], b[1], v), y: mix(a[2], b[2], v) };
    }
  const k = keys.at(-1)!;
  return { x: k[1], y: k[2] };
}
/** Pure, serializable 60 Hz choreography. Victim motion remains continuous;
 * only explicit, hidden teleport intervals move Goku discontinuously. */
export function furyScene(s: FuryState) {
  const t = s.tick,
    f = s.facing,
    p = config.phases;
  const stage = clamp(s.targetX, 310, 970),
    endX = clamp(stage + 60 * f, 180, 1100);
  const keys: Key[] = [
    [0, s.targetX, s.targetY],
    [16, clamp(s.targetX + 8 * f, 50, 1230), 580],
    [24, clamp(s.targetX + 10 * f, 50, 1230), 580],
    [34, clamp(s.targetX + 14 * f, 50, 1230), 520],
    [60, stage - 25 * f, 370],
    [65, stage - 20 * f, 345],
    [78, stage + 5 * f, 310],
    [90, stage + 35 * f, 300],
    [100, stage + 65 * f, 315],
    [116, stage + 105 * f, 330],
    [140, stage - 90 * f, 310],
    [164, stage + 50 * f, 235],
    [188, stage + 15 * f, 365],
    [212, stage + 15 * f, 255],
    [224, stage, 290],
    [278, endX, 470],
    [306, endX, 540],
    [330, endX, 580],
    [434, endX, 580],
  ];
  const victim = track(t, keys);
  let clip = "furyFirstPunch",
    tick = 14,
    facing = f,
    hidden = false;
  let x = s.originX,
    y = 580;
  const aim = (name: string, at: number, side = f, ground = false) => {
    const target = track(at, keys),
      c = furyContacts[name] ?? furyContacts.furyAirPunch;
    return { x: target.x - c.x * side, y: ground ? 580 : target.y - 78 - c.y };
  };
  const contact = (
    name: string,
    hitTick: number,
    offset: number,
    start: number,
    previous: { x: number; y: number },
    ground = false,
  ) => {
    clip = name;
    tick = offset;
    const target = aim(name, hitTick, facing, ground),
      v = smooth(u(t, start, hitTick));
    x = mix(previous.x, target.x, v);
    y = mix(previous.y, target.y, v);
  };
  const first = { x: s.originX, y: 580 },
    second = aim("furySecondStrike", 16, f, true),
    upper = aim("furyUppercut", 34, f, true),
    punch1 = aim("furyAirPunch", 65),
    kick1 = aim("furyAirKick", 78),
    punch2 = aim("furyAirPunch", 90),
    kick2 = aim("furyAirKick", 100);
  if (t < 8) {
    clip = "furyFirstPunch";
    tick = 14 + t;
  } else if (t < 24) contact("furySecondStrike", 16, t - 8, 8, first, true);
  else if (t < 44) contact("furyUppercut", 34, t - 24, 24, second, true);
  else if (t < 60) {
    clip = "furyAirPursuit";
    tick = t - 44;
    const v = smooth(u(t, 44, 60));
    x = mix(upper.x, punch1.x, v);
    y = mix(580, punch1.y, v);
  } else if (t < 72) contact("furyAirPunch", 65, t - 60, 60, punch1);
  else if (t < 84) contact("furyAirKick", 78, t - 72, 72, punch1);
  else if (t < 96) contact("furyAirPunch", 90, t - 84, 84, kick1);
  else if (t < 104) contact("furyAirKick", 100, t - 96 + 2, 96, punch2);
  else if (t < 224) {
    const link = Math.floor((t - 104) / 24),
      q = (t - 104) % 24;
    const sides = [-f, f, -f, f, f];
    facing = sides[link];
    const attack = [
      "furyTeleportPunch",
      "furyTeleportKick",
      "furyTeleportKick",
      "furySmash",
      "furyAerialUppercut",
    ][link];
    const target = aim(attack, 116 + link * 24, facing);
    x = target.x;
    y = target.y;
    clip = attack;
    tick = Math.max(0, q - 6);
    if (q < 6) {
      clip = "furyTeleportDisappear";
      tick = q;
      const prevFacing = link ? sides[link - 1] : f,
        previous = link
          ? aim(
              [
                "furyTeleportPunch",
                "furyTeleportKick",
                "furyTeleportKick",
                "furySmash",
              ][link - 1],
              116 + (link - 1) * 24,
              prevFacing,
            )
          : kick2;
      x = previous.x;
      facing = prevFacing;
      y = previous.y;
    } else if (q < 9) {
      hidden = true;
      clip = "furyTeleportDisappear";
      tick = 5;
    } else if (q < 12) {
      clip = "furyTeleportReappear";
      tick = q - 9;
    }
  } else if (t < 278) {
    clip = t < 266 ? "furyKamehamehaPreparation" : "furyFuriousExpression";
    tick = Math.max(0, t - (t < 266 ? 233 : 266));
    x = endX - 280 * f;
    y = 300;
    if (t < 230) {
      const previous = aim("furyAerialUppercut", 212);
      x = previous.x;
      y = previous.y;
      clip = "furyTeleportDisappear";
      tick = t - 224;
      hidden = t >= 227;
    } else if (t < 233) {
      clip = "furyTeleportReappear";
      tick = t - 230;
    }
  } else if (t < 344) {
    clip = t < 292 ? "furyDownwardBeam" : "furyKamehamehaMaintain";
    tick = t - (t < 292 ? 278 : 292);
    x = endX - 280 * f;
    y = 300;
  } else if (t < 354) {
    clip = "furyKamehamehaRecovery";
    tick = t - 344;
    x = endX - 280 * f;
    y = 300;
  } else if (t < 384) {
    clip = "furyAirDescent";
    tick = t - 354;
    x = endX - 280 * f;
    y = mix(300, 580, u(t, 354, 384) ** 2);
  } else if (t < 398) {
    clip = "furyLanding";
    tick = t - 384;
    x = endX - 280 * f;
    y = 580;
  } else if (t < 410) {
    clip = "furyTransformationEnding";
    tick = t - 398;
    x = endX - 280 * f;
    y = 580;
  } else if (t < 414) {
    clip = "furyAuraFading";
    tick = t - 410;
    x = endX - 280 * f;
    y = 580;
  } else if (t < 430) {
    clip = "furyHairColorTransition";
    tick = t - 414;
    x = endX - 280 * f;
    y = 580;
  } else {
    clip = "furyRecoveryPose";
    tick = t - 430;
    x = endX - 280 * f;
    y = 580;
  }
  x = clamp(x, 42, 1238);
  let phase = "ground";
  for (const [name, start] of Object.entries(p)) if (t >= start) phase = name;
  let vc =
    t >= 330
      ? "downed"
      : t < 34
        ? "damageMedium"
        : t < 60
          ? "launched"
          : t < 224
            ? "damageAir"
            : "falling";
  const lastHit = config.hits.filter((h) => h.tick <= t).at(-1)?.tick ?? 0;
  if (t >= 278 && t < 330) vc = "damageAir";
  const top = Math.min(y - 150, victim.y - 132),
    bottom = Math.max(y, victim.y);
  const scale =
    t >= 224 || bottom - top > 220 || s.targetX < 210 || s.targetX > 1070
      ? 1
      : 2;
  // Follow the captive through the flurry. Following Goku's instantaneous
  // side switches would turn every teleport into an unwanted camera snap.
  const focusX =
    t >= 104 && t < 224
      ? mix(
          (kick2.x + track(104, keys).x) / 2,
          victim.x,
          smooth(u(t, 104, 110)),
        )
      : (x + victim.x) / 2;
  const centerX = clamp(focusX, 320, 960);
  const framedY = (top + bottom) / 2 - 20;
  const centerY =
    t >= 398 ? mix(framedY, 360, smooth(u(t, 398, 434))) : framedY;
  const shake =
    t >= 330 && t < 344 ? Math.round((344 - t) / 3) * (t % 2 ? 1 : -1) : 0;
  const release = furyRelease(clip, tick);
  return {
    phase,
    attacker: { x, y, clip, tick, facing, hidden },
    victim: {
      ...victim,
      clip: vc,
      tick: t >= 330 ? t - 330 : t - lastHit,
      facing: x >= victim.x ? 1 : -1,
    },
    beam: {
      from: { x: x + release.x * f, y: y + release.y },
      to: { x: victim.x, y: victim.y - 55 },
      active: t >= 283 && t < 350,
      age: t - 283,
    },
    camera: {
      scale,
      x: scale === 1 ? 640 : centerX,
      y: centerY,
      shakeX: shake,
      shakeY: Math.round(shake / 2),
    },
  };
}
