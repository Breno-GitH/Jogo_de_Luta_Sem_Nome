import config from "../data/luffy-jet-gigant.json";
import body from "../data/luffy-jet-poses.json";
import fists from "../data/luffy-jet-fists.json";
import type { Fighter } from "./combat";
import { elasticGeometry } from "./elastic";
import type { FuryState } from "./goku-fury";
import type { Move, Point } from "./types";

export { config as jetConfig, fists as jetFists };
export const jetId = "jet_gigant";
export interface JetState extends FuryState {
  hold: number;
  openingTip: Point;
}

type Cel = keyof typeof body;
type Cue = [Cel, number];
const initial: Cue[] = [
  ["pump", 12],
  ["ignite", 16],
  ["rise", 13],
  ["ready", 10],
  ["dash", 5],
  ["windup", 3],
  ["pistol", 5],
  ["pistol", 4],
  ["pistol", 8],
  ["ready", 8],
  ["landing", 6],
  ["base", 9],
];
export const jetMove: Move = {
  super: true,
  kind: "jetGigant",
  cost: config.cost,
  startup: config.startup,
  active: config.active,
  recovery: config.recovery,
  drive: config.dash,
  damage: config.initialDamage,
  hitstop: 8,
  stun: 27,
  blockstun: 21,
  push: 0,
  launch: 0,
  level: "mid",
  rank: 5,
  cancels: [],
  meterGain: 0,
  box: { x: 0, y: 0, w: 0, h: 0 },
  poses: initial.map(([name, ticks]) => ({
    ticks,
    phase: "pose",
    hurtboxes: body[name].hurtboxes,
  })),
};
const clip = (name: Cel) => "jet_" + name;
export const jetClips = Object.fromEntries(
  Object.entries(body).map(([name, cel]) => [
    clip(name as Cel),
    {
      sheet: "luffy/jet/body.png",
      frames: [cel.frame],
      columns: 8,
      ticks: 1,
      loop: false,
    },
  ]),
);
export const jetStartupClip = {
  sheet: "luffy/jet/body.png",
  columns: 8,
  ticks: 1,
  loop: false,
  frames: initial.map(([name]) => body[name].frame),
  durations: initial.map(([, ticks]) => ticks),
};
const clamp = (v: number, low: number, high: number) =>
  Math.max(low, Math.min(high, v));
const linear = (t: number, from: number, to: number) =>
  clamp((t - from) / (to - from), 0, 1);
const ease = (v: number) => v * v * (3 - 2 * v);
const mix = (a: number, b: number, v: number) => a + (b - a) * v;
const interp = (a: Point, b: Point, v: number) => ({
  x: mix(a.x, b.x, v),
  y: mix(a.y, b.y, v),
});
const bound = (x: number) => clamp(x, 40, 1240);

function arm(cel: Cel, tip: Point, radius = 7, bend = 0, slot = 0) {
  const joints = body[cel].joints;
  const root = joints[slot] ?? joints[0];
  return {
    ...elasticGeometry({
      root,
      tip,
      radius,
      bend,
      maximumLength: 580,
      active: false,
      profile: "arm",
    }),
    foot: false,
    palm: cel === "bazooka",
    axis: { x: 1, y: 0 },
  };
}

export function jetOpener(f: Fighter) {
  if (f.state !== "attack" || f.moveId !== jetId) return;
  const t = f.stateFrame;
  if (t < 59 || t >= 76) return;
  const active = t >= config.startup && t < config.startup + config.active;
  const root = body.pistol.joints[0];
  const reach =
    t < config.startup
      ? ease(linear(t + 1, 59, config.startup))
      : 1 - ease(linear(t, config.startup + config.active - 1, 76));
  const forward = f.facing > 0 ? 1247 - f.x : f.x - 33;
  const gap = f.opponent ? (f.opponent.x - f.x) * f.facing : 0;
  const extension = Math.min(
    144,
    forward - 8,
    gap > 0 ? Math.max(root.x + 6, gap - 8) : 144,
  );
  const x = mix(root.x + 6, extension, reach);
  const geometry = arm(
    "pistol",
    { x, y: mix(root.y + 3, -89, reach) },
    7,
    -3 * reach,
  );
  return {
    ...geometry,
    hitboxes: active
      ? [
          {
            a: geometry.tip,
            b: { x: geometry.tip.x + 9, y: geometry.tip.y },
            r: 7,
          },
        ]
      : [],
  };
}

type Key = [number, number, number];
function track(t: number, keys: Key[]) {
  const at = keys.findIndex(([tick]) => t <= tick);
  if (at <= 0) {
    const [, x, y] = keys[at === 0 ? 0 : keys.length - 1];
    return { x, y };
  }
  const [from, x, y] = keys[at - 1];
  const [to, endX, endY] = keys[at];
  return interp({ x, y }, { x: endX, y: endY }, ease(linear(t, from, to)));
}

const rushHits = config.hits.filter((hit) => hit.kind === "gatling");

/** The shared cinematic runner plays this track on simulation ticks. Only the
 * finite opening fist tests normal collisions. Scripted hits use these contacts. */
export function jetScene(s: JetState) {
  const t = s.tick,
    side = s.facing,
    floor = 580;
  const target = (offset: number) => bound(s.targetX + side * offset);
  const startGap = Math.max(62, (s.targetX - s.originX) * side);
  const back = (x: number, gap: number) => bound(x - side * gap);
  const end = target(237);
  const victim = track(t, [
    [0, s.targetX, s.targetY],
    [16, target(14), floor],
    [32, target(23), floor],
    [60, target(28), floor],
    [82, target(108), floor],
    [92, target(118), floor],
    [163, target(154), floor],
    [208, target(180), 376],
    [235, target(185), 342],
    [272, target(198), 367],
    [299, end, floor],
    [406, end, floor],
  ]);
  const attacker = track(t, [
    [0, s.originX, floor],
    [9, back(target(12), startGap), floor],
    [16, back(target(14), 88), floor],
    [32, back(target(23), 95), floor],
    [49, back(target(27), 107), floor],
    [60, back(target(28), 101), floor],
    [69, back(target(64), 136), floor],
    [88, back(target(114), 101), floor],
    [163, back(target(154), 86), floor],
    [180, back(target(160), 101), floor],
    [221, back(target(182), 174), floor],
    [243, back(target(189), 204), 519],
    [272, back(target(198), 240), 493],
    [286, back(end, 223), 511],
    [319, back(end, 162), floor],
    [406, back(end, 162), floor],
  ]);
  const phase =
    t < 9
      ? "jetPistol"
      : t < 81
        ? "jetBazooka"
        : t < 177
          ? "jetGatling"
          : t < 246
            ? "gearThird"
            : t < 305
              ? "gigantPistol"
              : "return";
  const aim = {
    x: (victim.x - attacker.x) * side - 8,
    y: victim.y - attacker.y - 86,
  };
  const limbs: {
    geometry: ReturnType<typeof arm>;
    rear?: boolean;
    giant?: number;
    reverse?: boolean;
  }[] = [];
  let cel: Cel;
  let steam = t < 177 ? 1 : 1 - linear(t, 177, 195);
  const strike = (
    name: Cel,
    reach: number,
    y = aim.y,
    slot = 0,
    rear = false,
  ) => {
    const root = body[name].joints[slot] ?? body[name].joints[0];
    const tip = interp(
      { x: root.x + 15, y: root.y + 1 },
      { x: aim.x, y },
      reach,
    );
    limbs.push({ geometry: arm(name, tip, 7, -3 * reach, slot), rear });
  };
  const pulse = (hit: number, wind: number, recovery: number) =>
    t < hit
      ? ease(linear(t, hit - wind, hit))
      : 1 - ease(linear(t, hit + 1, hit + recovery));
  if (t < 9) {
    cel = "pistol";
    const root = body.pistol.joints[0];
    limbs.push({
      geometry: arm(
        cel,
        interp(
          s.openingTip,
          { x: root.x + 14, y: root.y + 1 },
          ease(linear(t, 1, 9)),
        ),
        7,
        -3,
      ),
    });
  } else if (t < 40) {
    const hit = t < 23 ? 16 : 32;
    cel = t < hit - 5 ? "windup" : hit === 16 ? "pistol" : "cross";
    if (cel !== "windup") strike(cel, pulse(hit, 5, 8));
  } else if (t < 73) {
    cel = t < 54 ? "bazookaWindup" : "bazooka";
    if (cel === "bazooka") {
      const p = pulse(60, 6, 13);
      strike(cel, p, aim.y - 10, 1, true);
      strike(cel, p, aim.y + 7);
    }
  } else if (t < 154) {
    const index = rushHits.findIndex(
      (h, i) =>
        t <=
        (i === rushHits.length - 1
          ? 154
          : Math.floor((h.tick + rushHits[i + 1].tick) / 2)),
    );
    const hit = rushHits[index].tick;
    cel = t < 85 ? "ready" : index % 2 ? "gatlingRight" : "gatlingLeft";
    if (cel !== "ready")
      strike(
        cel,
        pulse(hit, index < 3 ? 6 : 4, index < 3 ? 7 : 5),
        aim.y + ((index % 3) - 1) * 8,
      );
  } else if (t < 177) {
    cel = "launcher";
    const p = pulse(163, 8, 13);
    const root = body[cel].joints[0];
    const end = { x: aim.x - 2, y: Math.max(-148, aim.y - 14) };
    const geometry = arm(
      cel,
      interp({ x: root.x + 9, y: root.y - 9 }, end, p),
      7,
      4,
    );
    limbs.push({ geometry: { ...geometry, axis: { x: 0.71, y: -0.71 } } });
  } else if (t < 208) {
    cel = t < 187 ? "watch" : "inflate";
  } else if (t < 305) {
    cel =
      t < 222
        ? "inflation"
        : t < 239
          ? "brace"
          : t < 258
            ? "giantWindup"
            : t < 276
              ? "giantStrike"
              : "giantFollow";
    const giant =
      t < 214
        ? 0
        : t < 222
          ? 1
          : t < 231
            ? 2
            : t < 263
              ? 3
              : t < 272
                ? 4
                : t < 280
                  ? 5
                  : t < 290
                    ? 6
                    : t < 299
                      ? 2
                      : 7;
    const root = body[cel].joints[0];
    const windup = {
      x: Math.max(5 - (side > 0 ? attacker.x : 1280 - attacker.x), root.x - 32),
      y: root.y - 13,
    };
    const contact = { x: aim.x - fists[giant].nose + 13, y: aim.y };
    const advance =
      t < 272 ? ease(linear(t, 254, 272)) : 1 - ease(linear(t, 275, 305));
    const tip = interp(windup, contact, advance);
    const geometry = arm(cel, tip, Math.min(12, 7 + giant), -10 * advance);
    geometry.radii = geometry.radii.map((radius, i, radii) =>
      mix(radius, fists[giant].wrist, ease(i / Math.max(1, radii.length - 1))),
    );
    const reverse = tip.x < root.x;
    if (geometry.centers.length >= 4) {
      const penultimate = geometry.centers.length - 2;
      const direction = reverse ? -1 : 1;
      geometry.centers[penultimate] = {
        x: geometry.tip.x - direction * 7,
        y: geometry.tip.y,
      };
      geometry.centers.push({
        x: geometry.tip.x + direction * 4,
        y: geometry.tip.y,
      });
      geometry.radii.push(geometry.radii.at(-1)!);
    }
    limbs.push({ geometry, giant, reverse, rear: t < 262 });
  } else {
    cel =
      t < 319
        ? "descent"
        : t < 328
          ? "landing"
          : t < 362
            ? "small"
            : t < 384
              ? "growing"
              : "base";
    steam = 0;
  }

  const lastHit = config.hits.filter((hit) => hit.tick <= t).at(-1);
  const victimClip =
    t >= 299
      ? "downed"
      : t >= 272
        ? "falling"
        : t >= 205
          ? "damageAir"
          : t >= 163
            ? "launched"
            : "damageHeavy";
  const release = ease(linear(t, 364, config.duration));
  const scale = mix(mix(1.48, 1.21, ease(linear(t, 219, 249))), 1, release);
  const midX = (attacker.x + victim.x) / 2;
  const visibleHalfWidth = 640 / scale;
  const shake =
    t === 272 || t === 299
      ? ((s.hold % 3) - 1) * 7
      : t > 299 && t < 313
        ? Math.round((313 - t) / 3) * (t % 2 ? 1 : -1)
        : 0;
  return {
    phase,
    cel,
    limbs,
    steam,
    attacker: { ...attacker, clip: clip(cel), tick: 0, facing: side },
    victim: {
      ...victim,
      clip: victimClip,
      tick: t - (t >= 299 ? 299 : (lastHit?.tick ?? 0)) + (t >= 299 ? 0 : 4),
      facing: -side,
    },
    camera: {
      scale,
      x: mix(
        clamp(midX, visibleHalfWidth, 1280 - visibleHalfWidth),
        640,
        release,
      ),
      y: mix(mix(432, 386, ease(linear(t, 170, 236))), 360, release),
      shakeX: shake,
      shakeY: -Math.round(shake / 2),
    },
    lastHit,
  };
}
