import type { Match } from "../engine/combat";
import {
  kirinArt,
  kirinConfig,
  kirinScene,
  type KirinState,
} from "../engine/sasuke-kirin";
import { sasukePolishArt } from "../engine/sasuke-polish";
import { fillPixels } from "./pixel-contour";
import { sasukeBolt } from "./sasuke-special-fx";

const dragonSheet = "sasuke/kirin-dragon.png";
const stormSheet = "sasuke/kirin-sky.png";
const blackDragonSheet = "sasuke/kirin-dragon-black.png";
const blackStormSheet = "sasuke/kirin-sky-black.png";
export const kirinEffectsSheets = [
  dragonSheet,
  stormSheet,
  blackDragonSheet,
  blackStormSheet,
];
type Stage = ReturnType<typeof kirinScene>;
type Sprites = ReadonlyMap<string, HTMLImageElement>;

function cel(
  c: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  i: number,
  x: number,
  y: number,
  scale: number,
  pivot: { x: number; y: number },
  facing = 1,
) {
  if (!image) return;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(facing, 1);
  c.drawImage(
    image,
    (i % 2) * 512,
    Math.floor(i / 2) * 352,
    512,
    352,
    -Math.round(pivot.x * scale),
    -Math.round(pivot.y * scale),
    Math.round(512 * scale),
    Math.round(352 * scale),
  );
  c.restore();
}

export function drawKirinStorm(
  c: CanvasRenderingContext2D,
  m: Match,
  sprites: Sprites,
  scene?: Stage,
) {
  const left = m.sasukeStormUntil - m.combatFrame;
  if (!scene && left <= 0) return;
  const tick = m.kirin?.tick ?? m.combatFrame;
  const level = m.sasukeStormLevel / kirinConfig.weather.maximum;
  const strength =
    scene?.clouds ?? Math.min(1, left / 39) * (0.2 + level * 0.36);
  if (strength <= 0) return;
  const cursed = !!m.kirin?.cursed;
  const image = sprites.get(cursed ? blackStormSheet : stormSheet);
  const sky = cursed ? sasukePolishArt.blackSky : kirinArt.sky;
  c.save();
  c.fillStyle = cursed ? "#13091b" : "#070b1c";
  c.globalAlpha = strength * (scene ? 0.58 : 0.35);
  c.fillRect(0, 0, 1280, 720);
  c.globalAlpha = strength * 0.98;
  const drift = Math.round(Math.sin(tick * 0.025) * 87);
  const gap = scene
    ? Math.min(1, Math.max(0, (tick - kirinConfig.phases.reveal + 8) / 24))
    : 0;
  cel(
    c,
    image,
    0,
    316 + drift - gap * 85,
    scene ? 86 - gap * 34 : 22,
    1.95,
    sky[0],
  );
  cel(
    c,
    image,
    0,
    932 - drift + gap * 85,
    scene ? 112 - gap * 28 : 46,
    1.95,
    sky[0],
    -1,
  );
  const flicker = scene ? tick % 29 < 6 : level >= 0.5 && tick % 71 < 3;
  c.globalAlpha = strength * (flicker ? 0.9 : 0.44);
  cel(c, image, 1, 680 - drift / 2, scene ? 147 - gap * 22 : 57, 2.56, sky[1]);
  if (flicker) {
    c.globalAlpha = strength * 0.76;
    for (let i = 0; i < 3; i++) {
      const x = 173 + i * 410 + drift;
      sasukeBolt(
        c,
        { x, y: 76 + i * 7 },
        { x: x + 142, y: 137 + i * 17 },
        tick + i,
        1,
        12,
        cursed,
      );
    }
  }
  if (scene) {
    c.globalAlpha = strength * 0.64;
    for (let i = 0; i < 28; i++) {
      const x = 1300 - ((i * 179 + tick * (6 + (i % 5))) % 1320);
      const y = 236 + ((i * 53 + tick * (1 + (i % 3))) % 336);
      const length = 8 + (i % 7) * 5;
      fillPixels(
        c,
        [
          { x, y },
          { x: x + length, y: y - 5 },
          { x: x + length - 10, y: y - 2 },
        ],
        cursed
          ? i % 4
            ? "#9872c4"
            : "#d9a8f6"
          : i % 4
            ? "#8099bd"
            : "#c0d4e4",
      );
    }
  }
  c.restore();
}

export function drawKirinWorld(
  c: CanvasRenderingContext2D,
  s: KirinState,
  scene: Stage,
  sprites: Sprites,
) {
  const tick = s.tick,
    d = scene.dragon;
  const age = tick - kirinConfig.phases.impact;
  const cursed = s.cursed;
  const boss = cursed ? sasukePolishArt.blackDragon : kirinArt.dragon;
  const sky = cursed ? sasukePolishArt.blackSky : kirinArt.sky;
  const storm = sprites.get(cursed ? blackStormSheet : stormSheet);
  const hold = kirinConfig.hits[0].hold;
  c.save();
  if (d.visible) {
    c.globalAlpha = d.alpha * (age === 0 ? Math.max(0.2, s.hold / hold) : 1);
    if (scene.phase === "dive" || age === 0) {
      for (let i = 0; i < 5; i++) {
        const x = d.x - d.facing * (55 + i * 32);
        const y = d.y - (75 + i * 29);
        sasukeBolt(
          c,
          { x: x - d.facing * 104, y: y - 88 },
          { x, y },
          tick + i,
          i % 2 ? 1 : 2,
          10,
          cursed,
        );
      }
    }
    cel(
      c,
      sprites.get(cursed ? blackDragonSheet : dragonSheet),
      d.cel,
      d.x,
      d.y,
      d.scale,
      boss[d.cel],
      d.facing,
    );
  }
  if (scene.phase === "command") {
    const x = scene.attacker.x + s.facing * 12;
    const y = s.cursed
      ? 408
      : tick < kirinConfig.phases.command + 8
        ? 434
        : 421;
    c.globalAlpha = 0.62 + (tick % 5) * 0.07;
    sasukeBolt(
      c,
      { x, y: 407 },
      { x: x - s.facing * 22, y: 232 },
      tick,
      2,
      13,
      cursed,
    );
    sasukeBolt(
      c,
      { x, y: 407 },
      { x: x + s.facing * 53, y: 320 },
      tick + 1,
      1,
      9,
      cursed,
    );
  }
  if (age >= 0 && age < 64) {
    const x = s.targetX;
    const floor = 580;
    c.globalAlpha = Math.max(0, 1 - age / 22);
    cel(c, storm, 2, x, floor, 1.25 + age * 0.01, sky[2]);
    c.globalAlpha = Math.min(1, (age + 4) / 11) * Math.max(0, 1 - age / 65);
    cel(c, storm, 3, x, floor + 8, 1.04 + age * 0.01, sky[3], s.facing);
    for (let i = 0; i < 19; i++) {
      const dx = (i % 2 ? 1 : -1) * (34 + (age + 3) * (2 + (i % 4)));
      const y =
        floor -
        Math.max(2, (age + 2) * (2 + ((i * 11) % 9)) - age * age * 0.15);
      const px = Math.round(x + dx);
      const py = Math.round(y);
      fillPixels(
        c,
        [
          { x: px - 4, y: py - 3 },
          { x: px + 4, y: py - 1 },
          { x: px + 1, y: py + 4 },
        ],
        cursed
          ? i % 2
            ? "#b189d3"
            : "#4a2c64"
          : i % 2
            ? "#929ab2"
            : "#414b66",
      );
    }
    if (age < 13) {
      const spread = 42 + age * 14;
      for (const side of [-1, 1]) {
        sasukeBolt(
          c,
          { x, y: floor - 5 },
          { x: x + side * spread, y: floor + 4 },
          tick + side,
          2,
          7,
          cursed,
        );
      }
    }
  }
  c.restore();
}

export function drawKirinFlash(c: CanvasRenderingContext2D, s: KirinState) {
  const age = s.tick - kirinConfig.phases.impact;
  if (age < 0 || age > 6) return;
  c.save();
  c.globalAlpha =
    age === 0
      ? 0.09 + 0.55 * (s.hold / kirinConfig.hits[0].hold)
      : 0.17 * (1 - age / 7);
  c.fillStyle = s.cursed ? "#e9c1ff" : "#e2f9ff";
  c.fillRect(0, 0, 1280, 720);
  c.restore();
}
