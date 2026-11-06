import type { Fighter } from "../engine/combat";
import {
  jetId,
  jetOpener,
  jetScene,
  type JetState,
} from "../engine/luffy-jet-gigant";
import fists from "../data/luffy-jet-fists-polished.json";
import { paintElastic } from "./elastic";
import { luffyBurst, pixelShard } from "./luffy-special-fx";
import { fillPixels } from "./pixel-contour";

export const jetFxSheets = [
  "luffy/jet/fists-polished.png",
  "luffy/jet/effects.png",
];
const second = {
  outline: "#291621",
  shadow: "#a44b55",
  base: "#ec8578",
  light: "#ffa78e",
  highlight: "#ffccb0",
};
const third = {
  outline: "#302020",
  shadow: "#a65739",
  base: "#e79660",
  light: "#ffb584",
  highlight: "#ffd7a6",
};
const heat: [string, string, string] = ["#db4848", "#ffab5b", "#fff2d1"];
const thunder: [string, string, string] = ["#a63f3a", "#ffc179", "#fff6d8"];
type Scene = ReturnType<typeof jetScene>;
type Sprites = ReadonlyMap<string, HTMLImageElement>;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (t: number, start: number, end: number) => {
  const p = unit((t - start) / (end - start));
  return p * p * (3 - 2 * p);
};
const wave = (t: number, start: number, crest: number, end: number) =>
  ramp(t, start, crest) * (1 - ramp(t, crest, end));

export function jetCamera(stage: Scene, state: JetState) {
  const t = state.tick,
    age = t - (stage.lastHit?.tick ?? 0);
  const gearClose = wave(t, 198, 236, 259) * 0.27;
  const fireClose = wave(t, 253, 270, 298) * 0.28;
  const groundClose = wave(t, 282, 299, 323) * 0.18;
  const smallClose = wave(t, 320, 341, 370) * 0.19;
  const release = ramp(t, 356, 406);
  const scale =
    stage.camera.scale + gearClose + fireClose + groundClose + smallClose;
  const focus = mix(
    stage.camera.x,
    stage.victim.x,
    (fireClose + groundClose) * 0.7,
  );
  const half = 640 / scale;
  const kick =
    stage.lastHit?.kind === "gigant"
      ? 11
      : stage.lastHit?.kind === "ground"
        ? 8
        : stage.lastHit?.kind === "bazooka"
          ? 5
          : stage.lastHit?.kind === "gatling"
            ? 2
            : 0;
  const shake = kick * unit(1 - age / 9) * (state.hold ? 1 : 0.47);
  const oscillator = (t + state.hold) % 4 < 2 ? 1 : -1;
  return {
    scale,
    x: Math.round(Math.min(1280 - half, Math.max(half, focus))),
    y: Math.round(
      mix(
        stage.camera.y -
          gearClose * 48 -
          fireClose * 92 +
          groundClose * 272 +
          smallClose * 248,
        360,
        release,
      ),
    ),
    shakeX: Math.round(shake * oscillator),
    shakeY: Math.round(shake * -0.46 * oscillator),
  };
}

/** Pose root moves a few pixels while the terminal stays on the contact track. */
export function jetBodyRecoil(stage: Scene, state: JetState) {
  const hit = stage.lastHit;
  if (!hit) return 0;
  const age = state.tick - hit.tick;
  const amount =
    hit.kind === "gigant"
      ? 6
      : hit.kind === "bazooka"
        ? 4
        : hit.kind === "gatling"
          ? 2
          : 0;
  return -Math.round(amount * unit(1 - age / 7));
}

function steam(
  c: CanvasRenderingContext2D,
  tick: number,
  power: number,
  rear: boolean,
) {
  if (power <= 0) return;
  c.save();
  const baseAlpha = c.globalAlpha;
  for (let ribbon = 0; ribbon < (rear ? 4 : 2); ribbon++) {
    for (let knot = 0; knot < 7; knot++) {
      const phase = (tick * 2 + knot * 17 + ribbon * 13) % 120;
      const bend = Math.sin(phase * 0.075 + ribbon * 0.94);
      const x = Math.round(
        (rear ? -48 : -20) + ribbon * 26 + bend * (9 + phase * 0.08),
      );
      const y = Math.round(-22 - phase * 0.96 - (ribbon % 2) * 10);
      const r = 4 + ((knot + ribbon) % 3) + Math.floor(phase / 35);
      c.globalAlpha =
        baseAlpha * power * (rear ? 0.86 : 0.43) * (1 - phase / 133);
      const cloud = (xx: number, yy: number, radius: number, color: string) =>
        fillPixels(
          c,
          [
            { x: xx - radius, y: yy - 2 },
            { x: xx - radius + 2, y: yy - radius + 1 },
            { x: xx + 1, y: yy - radius - 1 },
            { x: xx + radius, y: yy - 2 },
            { x: xx + radius, y: yy + 3 },
            { x: xx + 2, y: yy + radius },
            { x: xx - radius + 1, y: yy + radius - 2 },
          ],
          color,
        );
      cloud(x + 2, y + 2, r, "#748d98");
      cloud(x, y, r, "#dbe7de");
      cloud(x - 2, y - 2, r - 2, "#fff5df");
    }
  }
  c.restore();
}

function jetWake(
  c: CanvasRenderingContext2D,
  tick: number,
  x: number,
  y: number,
  width: number,
  thrust: number,
) {
  for (let i = 0; i < 8; i++) {
    const offset = (i % 2 ? -1 : 1) * (12 + 4 * i);
    const lead = (tick * (3 + (i % 3)) + 19 * i) % width;
    pixelShard(
      c,
      x - lead,
      y + offset,
      0.99,
      -0.13,
      19 + (i % 3) * 13 + thrust,
      i % 3 === 0 ? 2 : 1,
      i % 3 === 0 ? "#fff0c2" : i % 3 === 1 ? "#df694c" : "#9f4e4c",
    );
  }
}

function brokenRing(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  flatter: number,
  color: string,
) {
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 1) continue;
    const angle = (i * Math.PI) / 8;
    const a = angle - 0.17,
      b = angle + 0.17;
    fillPixels(
      c,
      [
        {
          x: Math.round(x + Math.cos(a) * radius),
          y: Math.round(y + Math.sin(a) * radius * flatter),
        },
        {
          x: Math.round(x + Math.cos(b) * radius),
          y: Math.round(y + Math.sin(b) * radius * flatter),
        },
        {
          x: Math.round(x + Math.cos(b) * (radius + 4)),
          y: Math.round(y + Math.sin(b) * (radius + 4) * flatter),
        },
        {
          x: Math.round(x + Math.cos(a) * (radius + 4)),
          y: Math.round(y + Math.sin(a) * (radius + 4) * flatter),
        },
      ],
      color,
    );
  }
}

/** Local layers keep steam and pressure lines away from the face and fist. */
export function drawJetActor(
  c: CanvasRenderingContext2D,
  sprites: Sprites,
  f: Fighter,
  stage: Scene | undefined,
  rear: boolean,
  effects: boolean,
  rootShift = 0,
) {
  if (!stage && (f.state !== "attack" || f.moveId !== jetId)) return;
  const tick = stage ? f.match!.jetGigant!.tick : f.stateFrame;
  const power = stage?.steam ?? ramp(tick, 9, 36) * (1 - ramp(tick, 68, 89));
  if (effects) {
    steam(c, tick, power, rear);
    if (
      rear &&
      ((!stage && tick >= 49 && tick < 68) ||
        (stage &&
          ((tick >= 67 && tick < 92) ||
            (tick >= 86 && tick < 166) ||
            (tick >= 250 && tick < 295))))
    ) {
      jetWake(
        c,
        tick,
        tick >= 250 ? 88 : 12,
        -80,
        tick >= 250 ? 142 : 95,
        tick >= 250 ? 36 : tick >= 105 ? 22 : 10,
      );
    }
    if (rear && !stage && tick >= 12 && tick < 37) {
      c.save();
      c.globalAlpha *= 0.6 * (1 - ramp(tick, 29, 37));
      brokenRing(c, 3, -10, 17 + (tick - 12) * 2.25, 0.31, "#f3b18c");
      c.restore();
    }
  }
  if (!stage) {
    const limb = jetOpener(f);
    if (!rear && limb) paintElastic(c, limb, limb, second);
    return;
  }
  for (const limb of stage.limbs) {
    if (Boolean(limb.rear) !== rear) continue;
    if (limb.giant === undefined) {
      paintElastic(c, limb.geometry, limb.geometry, second, {
        rootShift,
        recoil: Math.abs(rootShift) / 4,
      });
      continue;
    }
    paintElastic(c, limb.geometry, undefined, third, { rootShift });
    const hand = sprites.get(jetFxSheets[0]);
    if (!hand?.naturalWidth) continue;
    const {
      giant,
      geometry: { tip },
    } = limb;
    if (effects && tick >= 205 && tick < 248) {
      const expansion = (tick - 205) % 9;
      c.save();
      c.globalAlpha *= 0.52 * (1 - expansion / 10);
      brokenRing(
        c,
        tip.x + (limb.reverse ? -1 : 1) * fists[giant].width * 0.5,
        tip.y,
        fists[giant].height * 0.47 + expansion * 3,
        0.79,
        "#f5ab64",
      );
      c.restore();
    }
    const cel = fists[giant];
    c.save();
    c.translate(tip.x, tip.y);
    if (limb.reverse) c.scale(-1, 1);
    c.drawImage(
      hand,
      (giant % 4) * 256,
      Math.floor(giant / 4) * 256,
      cel.width,
      cel.height,
      -cel.pivot.x,
      -cel.pivot.y,
      cel.width,
      cel.height,
    );
    c.restore();
  }
}

function dust(
  c: CanvasRenderingContext2D,
  sprites: Sprites,
  x: number,
  y: number,
  age: number,
) {
  if (age >= 32) return;
  c.save();
  c.globalAlpha *= unit(1 - age / 33);
  const image = sprites.get(jetFxSheets[1]);
  if (image?.naturalWidth) {
    const frame = Math.min(5, Math.floor(age / 5));
    for (const side of [-1, 1]) {
      c.save();
      c.translate(Math.round(x + side * (18 + age * 1.9)), Math.round(y - 56));
      c.scale(side, 1);
      c.drawImage(image, frame * 192, 480, 192, 160, -103, -95, 206, 160);
      c.restore();
    }
  }
  brokenRing(c, x, y - 4, 15 + age * 5.4, 0.17, "#e9b684");
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? 1 : -1;
    const dx = side * (1.5 + (i % 4) * 0.7);
    const dy = (1 - age / 35) * (12 + (i % 4) * 8);
    pixelShard(
      c,
      x + dx * age * 2,
      y - dy - age * 0.5,
      side * 0.84,
      -0.54,
      6 + (i % 4) * 2,
      (i % 2) + 1,
      i % 3 ? "#b9846a" : "#f5d9ad",
    );
  }
  c.restore();
}

export function drawJetImpact(
  c: CanvasRenderingContext2D,
  sprites: Sprites,
  stage: Scene,
  tick: number,
  hold: number,
) {
  const hit = stage.lastHit;
  const { victim, attacker } = stage;
  if (!hit) {
    if (tick < 9)
      luffyBurst(
        c,
        { x: victim.x, y: victim.y - 86 },
        tick,
        attacker.facing,
        1.23,
        heat,
      );
    return;
  }
  const age = tick - hit.tick;
  const flash = age === 0 && hold ? (hit.hold - hold) * 0.42 : age;
  if (hit.kind === "ground") {
    dust(
      c,
      sprites,
      victim.x,
      victim.y,
      age + (hit.hold - Math.max(0, hold)) * 0.45,
    );
    luffyBurst(
      c,
      { x: victim.x, y: victim.y - 13 },
      flash,
      attacker.facing,
      1.95,
      thunder,
      "double",
    );
  } else {
    const power =
      hit.kind === "gigant"
        ? 2.12
        : hit.kind === "bazooka"
          ? 1.44
          : hit.kind === "gatling"
            ? 0.69
            : 1;
    const point = {
      x: victim.x,
      y: victim.y - (hit.kind === "launcher" ? 98 : 86),
    };
    luffyBurst(
      c,
      point,
      flash,
      attacker.facing,
      power,
      hit.kind === "gigant" ? thunder : heat,
      hit.kind === "gatling"
        ? "rush"
        : hit.kind === "bazooka"
          ? "double"
          : "punch",
    );
    if ((hit.kind === "gigant" || hit.kind === "bazooka") && flash < 10) {
      c.save();
      c.globalAlpha *= 0.74 * (1 - flash / 10);
      brokenRing(c, point.x, point.y, 32 + flash * 6, 0.84, "#ffe1a1");
      c.restore();
    }
  }
}

export function drawJetScreen(c: CanvasRenderingContext2D, state: JetState) {
  const t = state.tick;
  const envelope = ramp(t, 0, 10) * (1 - ramp(t, 359, 406));
  if (envelope <= 0) return;
  c.save();
  c.globalAlpha *= envelope;
  const width = c.canvas.width,
    height = c.canvas.height;
  const tint = t >= 198 ? "#431e2099" : "#33162482";
  c.fillStyle = tint;
  c.fillRect(0, 0, width, 16);
  c.fillRect(0, height - 22, width, 22);
  c.fillStyle = "#e38b6648";
  c.fillRect(0, 15, width, 1);
  c.fillRect(0, height - 23, width, 1);
  const heldFlash =
    state.hold > 9
      ? "#ffd69b34"
      : t === 299 && state.hold > 4
        ? "#ffcb8155"
        : t === 60 && state.hold > 3
          ? "#ffc28f24"
          : undefined;
  if (heldFlash) {
    c.fillStyle = heldFlash;
    c.fillRect(0, 0, width, height);
  }
  c.restore();
}
