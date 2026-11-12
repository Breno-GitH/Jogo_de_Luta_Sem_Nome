import type { Fighter } from "./combat";
import { alienXSuper } from "./ben-omnitrix";
import type { FuryState } from "./goku-fury";
import type { Move } from "./types";

export const alienXId = alienXSuper.id;
export const alienXConfig = {
  duration: 286, minimumComboScale: .68,
  phases: { reveal: 34, dimension: 69, grasp: 120, rewrite: 210, return: 253 },
  hits: [{ tick: 214, damage: 309, kind: "ground", hold: 7 }],
} as const;
export type AlienXState = FuryState & { hold: number };

export const alienXMove: Move = {
  kind: alienXId, super: true, cost: alienXSuper.cost, startup: 23, active: 6, recovery: 39,
  damage: 26, stun: 16, blockstun: 0, push: 0, launch: 0,
  rank: 4, level: "mid", cancels: [], hitstop: 6,
  box: { x: 24, y: -99, w: 152, h: 74 },
};

export function canStartAlienX(f: Fighter) {
  return f.match?.phase === "fight" && !f.match.capture && !f.match.cinematicActive &&
    !f.omnitrix?.transition && !f.airborne && !f.knockedDown && f.meter >= alienXSuper.cost &&
    (["idle", "walk", "dash", "crouch", "landing", "jumpStart"].includes(f.state) ||
      f.hitConfirmed && f.canSuperCancel());
}

const floor = 580;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ease = (t: number, from: number, to: number) => {
  const progress = clamp((t - from) / (to - from), 0, 1);
  return progress * progress * (3 - 2 * progress);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function alienXScene(s: AlienXState) {
  const t = s.tick, f = s.facing, p = alienXConfig.phases;
  const center = clamp(s.targetX - 82 * f, 260, 1020);
  const departure = ease(t, p.dimension, p.grasp);
  const home = ease(t, 235, alienXConfig.duration - 11);
  const showSpace = ease(t, 59, 88) * (1 - ease(t, 219, 248));
  const spin = ease(t, 119, 200) * (1 - ease(t, 203, 229));
  const clipStart = t < p.reveal ? 0 : t < p.grasp ? p.reveal : t < p.rewrite ? p.grasp :
    t < p.return ? p.rewrite : p.return;
  const attacker = {
    x: Math.round(mix(mix(s.originX, center - 105 * f, departure), s.originX, home)),
    y: Math.round(floor - 95 * showSpace),
    facing: f,
    clip: t < p.reveal ? "alienXWatch" : t < p.grasp ? "alienXReveal" :
      t < p.rewrite ? "alienXGrasp" : t < p.return ? "alienXRewrite" : "alienXReturn",
    tick: t - clipStart,
  };
  const orbit = Math.sin((t - 102) * .055) * spin;
  const exit = clamp(s.targetX + 82 * f, 55, 1225);
  const victim = {
    // Quantize the authoritative positions, including the trigonometric orbit.
    x: Math.round(mix(mix(s.targetX, center + (126 + 82 * orbit) * f, departure), exit, home)),
    y: Math.round(mix(s.targetY, floor, ease(t, 0, 48)) - (189 + orbit * 39) * showSpace),
    facing: -f, clip: showSpace > .2 ? "launched" : "grabbed", tick: t,
  };
  const watchClose = ease(t, 0, 22) * (1 - ease(t, 32, 66));
  const zoom = 1 + .44 * watchClose + .22 * showSpace;
  const camera = {
    x: mix(640, mix((attacker.x + victim.x) / 2, attacker.x + 29 * f, watchClose),
      Math.max(watchClose, showSpace)),
    y: mix(360, mix(350, floor - 73, watchClose), Math.max(watchClose, showSpace)),
    scale: zoom,
    angle: orbit * .045,
    shakeX: t >= 214 && t < 226 ? Math.cos(t * 2.4) * (226 - t) : 0,
    shakeY: 0,
  };
  return { attacker, victim, camera, showSpace,
    phase: t < p.reveal ? "watch" : t < p.dimension ? "reveal" : t < p.grasp ? "dimension" :
      t < p.rewrite ? "grasp" : t < p.return ? "rewrite" : "return",
    flash: Math.max(0, 1 - Math.abs(t - p.reveal) / 8) * .71 +
      Math.max(0, 1 - Math.abs(t - 214) / 10) * .88,
  };
}

