import { assetBase } from "./asset-base";
import { characterPreviews } from "./engine/character-previews";
import {
  kaguneIds,
  Rinkaku,
  type KaguneId,
  type KaguneLayer,
  type KagunePose,
} from "./engine/kagune";
import { FLOOR, Match } from "./engine/combat";
import { kanekiMotion } from "./engine/kaneki-motion";
import { KeyboardInput } from "./engine/input";
import { neutral } from "./engine/types";
import { KanekiPresentation } from "./render/kaneki-presentation";
import { FixedLoop } from "./engine/loop";
import type { Point } from "./engine/types";
import { Animator } from "./render/animator";
import { drawKagune } from "./render/kagune";

const kaneki = characterPreviews.kaneki;
const animator = new Animator(kaneki.animations);
const modes = {
  idle: "Idle · quatro Kagunes",
  none: "Corpo sem Kagune",
  alternate: "Curvas em outras posições",
  partial: "Extensão parcial",
  full: "Extensão completa",
  folded: "Quatro recolhidos",
  cycle: "Estender, interromper e recolher",
  walkForward: "Caminhada para frente",
  walkBack: "Caminhada para trás",
  dashForward: "Dash ofensivo",
  backdash: "Backdash",
  crouch: "Agachar e levantar",
  jump: "Salto e aterrissagem",
  jumpForward: "Salto para frente",
  jumpBack: "Salto para trás",
  free: "Treino livre · WASD / Shift",
} as const;
type Mode = keyof typeof modes;
const motionLengths = {
  walkForward: 72,
  walkBack: 72,
  dashForward: 33,
  backdash: 33,
  crouch: 51,
  jump: 69,
  jumpForward: 69,
  jumpBack: 69,
  free: 216,
};
const labels: Record<KaguneId, string> = {
  upperRear: "1 · Superior traseiro",
  upperFront: "2 · Superior dianteiro",
  lowerRear: "3 · Inferior traseiro",
  lowerFront: "4 · Inferior dianteiro",
};
const phaseLabel = {
  folded: "recolhido",
  idle: "em guarda",
  extending: "estendendo",
  extended: "estendido",
  retracting: "recolhendo",
};
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("arena");
const c = canvas.getContext("2d")!;
c.imageSmoothingEnabled = false;
const modeInput = el<HTMLSelectElement>("scenario");
const limbInput = el<HTMLSelectElement>("limb");
const layerInput = el<HTMLSelectElement>("layer");
const compare = el<HTMLInputElement>("compare");
const mirror = el<HTMLInputElement>("mirror");
const guides = el<HTMLInputElement>("guides");
const seek = el<HTMLInputElement>("seek");
const play = el<HTMLButtonElement>("play");
const speed = el<HTMLSelectElement>("speed");
const end = 216;
const floor = 224;
const bodyAtlas = new Image(),
  movementAtlas = new Image();
const scaleFighters = ["sasuke", "goku", "samurai"].map((id) => {
  const image = new Image();
  image.src = new URL(`sprites/${id}/base.png`, assetBase).href;
  return { id, image };
});
bodyAtlas.src = new URL(`sprites/${kaneki.animations.sheet}`, assetBase).href;
movementAtlas.src = new URL("sprites/kaneki/movement.png", assetBase).href;

let practice: Match | undefined;
let motion: KanekiPresentation | undefined;
let startingX = 0;
const keyboard = new KeyboardInput({
  dashOnDirection: true,
  active: () => mode() === "free" && !paused && !compare.checked,
});

let rinkaku = new Rinkaku(),
  paused = false,
  elapsed = 0,
  debt = 0;
const mode = () => modeInput.value as Mode;
const limb = () => limbInput.value as KaguneId;
const facing = () => (mirror.checked ? (-1 as const) : (1 as const));

function setup(value: Mode, id: KaguneId) {
  const actor = new Rinkaku();
  if (value === "alternate") {
    kaguneIds.forEach((name, i) =>
      actor.move(name, [0.72, 1.38, 0.58, 1.2][i], 0),
    );
  } else if (value === "partial" || value === "full") {
    actor.move(id, value === "partial" ? 1.45 : 2, 0);
  } else if (value === "folded") actor.interrupt(0);
  return actor;
}

function stepActor() {
  if (practice && motion) {
    const scene = mode(),
      side = facing();
    const input =
      scene === "free" && !paused && !compare.checked
        ? keyboard.sample()
        : neutral();
    if (scene !== "free") {
      if (elapsed < 56 && (scene === "walkForward" || scene === "walkBack"))
        input.direction = scene === "walkForward" ? side : (-side as 1 | -1);
      if (elapsed === 0 && (scene === "dashForward" || scene === "backdash")) {
        input.direction = scene === "dashForward" ? side : (-side as 1 | -1);
        input.pressed.push("dash");
      }
      if (scene === "crouch") input.down = elapsed < 30;
      if (scene.startsWith("jump")) {
        if (scene === "jumpForward") input.direction = side;
        if (scene === "jumpBack") input.direction = -side as 1 | -1;
        if (elapsed === 0) input.pressed.push("jump");
        if (elapsed >= 46) input.direction = 0;
      }
    }
    practice.step([input, neutral()]);
    motion.step(practice.fighters[0]);
  }
  if (mode() === "cycle") {
    if (elapsed === 22) rinkaku.move(limb(), 2, 20);
    if (elapsed === 70) rinkaku.interrupt(22);
    const index = (elapsed - 105) / 8;
    if (Number.isInteger(index) && kaguneIds[index])
      rinkaku.move(kaguneIds[index], 1, 28);
  }
  rinkaku.step();
  elapsed++;
}

function reset() {
  rinkaku = setup(mode(), limb());
  rinkaku.setLayer(limb(), layerInput.value as KaguneLayer);
  practice = undefined;
  motion = undefined;
  if (Object.hasOwn(motionLengths, mode())) {
    practice = new Match(kanekiMotion, { training: true }, kanekiMotion);
    practice.phase = "fight";
    const [fighter, opponent] = practice.fighters;
    startingX = fighter.x = 620;
    fighter.facing = facing();
    opponent.x = startingX + fighter.facing * (mode() === "free" ? 226 : 470);
    opponent.facing = -fighter.facing;
    motion = new KanekiPresentation(fighter);
    motion.rinkaku.setLayer(limb(), layerInput.value as KaguneLayer);
  }
  keyboard.clear();
  elapsed = 0;
}
function advance() {
  const length = motionLengths[mode() as keyof typeof motionLengths] ?? end;
  if (
    (mode() === "cycle" || (practice && mode() !== "free")) &&
    elapsed + 1 >= length
  )
    reset();
  else stepActor();
}
function go(tick: number) {
  reset();
  while (elapsed < tick) stepActor();
  draw();
}

function body(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchor: Point,
  side: 1 | -1,
  srcX: number,
  srcY: number,
) {
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.scale(side, 1);
  const { frameWidth: w, frameHeight: h, pivot } = kaneki.animations;
  ctx.drawImage(image, srcX, srcY, w, h, -pivot.x, -pivot.y, w, h);
  ctx.restore();
}

function layered(
  ctx: CanvasRenderingContext2D,
  poses: KagunePose[],
  side: 1 | -1,
  paintBody: () => void,
) {
  for (const pose of poses)
    if (pose.layer === "behind") drawKagune(ctx, pose, side);
  paintBody();
  for (const pose of poses)
    if (pose.layer === "front") drawKagune(ctx, pose, side);
}

function figure(
  ctx: CanvasRenderingContext2D,
  actor: Rinkaku,
  position: Point,
  side: 1 | -1,
  tick: number,
  visible: boolean,
) {
  animator.seekTick(tick);
  const { x, y } = animator.sprite();
  const anchor = kaneki.lumbar[animator.frame()];
  const roots = { x: position.x + anchor.x * side, y: position.y + anchor.y };
  const poses = visible ? actor.poses(roots, side) : [];
  layered(ctx, poses, side, () => body(ctx, bodyAtlas, position, side, x, y));
  return poses;
}

function point(ctx: CanvasRenderingContext2D, p: Point, color: string, r = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p.x) - r, Math.round(p.y) - r, r * 2 + 1, r * 2 + 1);
}

function background(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ground: number,
  camera = 0,
) {
  ctx.fillStyle = "#1d1d2c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#282535";
  for (let i = -Math.round(camera) % 32; i < w; i += 32)
    ctx.fillRect(i, 0, 1, ground);
  ctx.fillStyle = "#181723";
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = "#6f556c";
  ctx.fillRect(0, ground, w, 1);
}

function scaleFrame(ctx: CanvasRenderingContext2D, tick = 0, side: 1 | -1 = 1) {
  background(ctx, 512, 256, floor);
  const left = { x: 87, y: floor };
  figure(ctx, rinkaku, left, side, tick, false);
  ctx.fillStyle = "#f9b2bc";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("KANEKI KEN", left.x, 242);
  for (const [i, { id, image }] of scaleFighters.entries()) {
    const x = 196 + i * 112;
    body(ctx, image, { x, y: floor }, side, 0, 0);
    ctx.fillText(id.toUpperCase(), x, 242);
  }
  ctx.fillStyle = "#b2a6bc";
  ctx.textAlign = "left";
  for (const h of [0, 32, 64, 96, 128, 160]) {
    ctx.fillRect(25, floor - h, 6, 1);
    ctx.fillText(String(h), 5, floor - h + 3);
  }
  return left;
}

function draw() {
  let side = facing();
  const moving = !!(practice && motion && !compare.checked);
  const ground = moving ? 349 : floor;
  const height = moving ? 384 : 256;
  if (canvas.height !== height) {
    canvas.height = height;
    c.imageSmoothingEnabled = false;
  }
  let position = { x: 256, y: ground };
  let poses: KagunePose[] = [];
  if (compare.checked) position = scaleFrame(c, elapsed, side);
  else if (practice && motion) {
    const [fighter, target] = practice.fighters;
    side = fighter.facing as 1 | -1;
    const screenX = Math.round(
      256 + Math.max(-42, Math.min(42, (fighter.x - startingX) * 0.26)),
    );
    const camera = fighter.x - screenX;
    position = {
      x: Math.round(screenX + side * motion.offset),
      y: Math.round(ground + fighter.y - FLOOR),
    };
    const anchor = motion.lumbar;
    poses = motion.rinkaku.poses(
      { x: position.x + anchor.x * side, y: position.y + anchor.y },
      side,
      ground,
    );
    const sprite = motion.animator.sprite();
    background(c, 512, height, ground, camera);
    if (mode() === "free")
      body(
        c,
        scaleFighters[0].image,
        { x: Math.round(target.x - camera), y: ground },
        target.facing as 1 | -1,
        0,
        0,
      );
    layered(c, poses, side, () =>
      body(
        c,
        sprite.sheet === kaneki.animations.sheet ? bodyAtlas : movementAtlas,
        position,
        side,
        sprite.x,
        sprite.y,
      ),
    );
  } else {
    background(c, 512, 256, floor);
    poses = figure(c, rinkaku, position, side, elapsed, mode() !== "none");
  }
  if (guides.checked) {
    point(c, position, "#99e2ed", 2);
    for (const pose of poses) {
      point(c, pose.origin, "#9eeaf2");
      point(c, pose.tip, "#ffde86");
    }
  }
  const current = moving && motion ? motion.animator.frame() : animator.frame();
  const active = poses.find((p) => p.id === limb());
  const length = motionLengths[mode() as keyof typeof motionLengths] ?? end;
  seek.max = String(length - 1);
  seek.value = String(elapsed % length);
  Object.assign(canvas.dataset, {
    frame: String(current),
    clip: moving ? motion!.clip : "idle",
    motion: active?.motion ?? "idle",
    worldX: String(practice?.fighters[0].x ?? 0),
    worldY: String(practice?.fighters[0].y ?? FLOOR),
    ground: String(ground),
    support:
      motion?.planted == null
        ? ""
        : String(
            practice!.fighters[0].x + side * (motion.offset + motion.planted),
          ),
    tick: String(elapsed),
    facing: String(side),
    count: String(poses.length),
    phase: active?.phase ?? "hidden",
    layer: active?.layer ?? "none",
    comparison: String(compare.checked),
    origins: JSON.stringify(poses.map((p) => p.origin)),
    tips: JSON.stringify(poses.map((p) => p.tip)),
  });
  el<HTMLOutputElement>("status").value =
    `${moving ? motion!.clip : "Idle"} · Desenho ${current + 1} · Tick ${elapsed}${active ? ` · ${phaseLabel[active.phase]} · ${Math.round(active.length)} px` : ""}`;
}

function pause(value: boolean) {
  paused = value;
  play.textContent = value ? "Reproduzir" : "Pausar";
}

const sheetModes = [
  "none",
  "idle",
  "alternate",
  "partial",
  "full",
  "folded",
] as const;
function download(canvas: HTMLCanvasElement, name: string) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = name;
  link.click();
}
function sheet(contact: boolean) {
  const output = document.createElement("canvas");
  const w = 400,
    h = 208;
  output.width = w * 3;
  output.height = h * (contact ? 4 : 2);
  const ctx = output.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const poseOrigin = { x: 170, y: 176 };
  const capture = (i: number, label: string, paint: () => void) => {
    ctx.save();
    ctx.translate((i % 3) * w, Math.floor(i / 3) * h);
    if (contact) background(ctx, w, h, poseOrigin.y);
    paint();
    if (contact) {
      ctx.fillStyle = "#ffc4cb";
      ctx.font = "bold 12px monospace";
      ctx.fillText(label, 12, h - 10);
    }
    ctx.restore();
  };
  for (const [i, mode] of sheetModes.entries()) {
    capture(i, modes[mode], () =>
      figure(ctx, setup(mode, "lowerFront"), poseOrigin, 1, 0, mode !== "none"),
    );
  }
  if (contact)
    for (let i = 0; i < 6; i++) {
      animator.seekFrame(i);
      const tick = animator.elapsedTicks;
      capture(i + 6, `Idle · desenho ${i + 1}`, () =>
        figure(ctx, setup("idle", "lowerFront"), poseOrigin, 1, tick, false),
      );
    }
  return output;
}

async function start() {
  await Promise.all([
    bodyAtlas.decode(),
    movementAtlas.decode(),
    ...scaleFighters.map((f) => f.image.decode()),
  ]);
  for (const [value, text] of Object.entries(modes))
    modeInput.add(new Option(text, value));
  for (const id of kaguneIds) limbInput.add(new Option(labels[id], id));
  limbInput.value = "lowerFront";
  el<HTMLAnchorElement>("body-atlas").href = bodyAtlas.src;
  el<HTMLAnchorElement>("raw-atlas").href = new URL(
    "sprites/kaneki/kagune-poses.png",
    assetBase,
  ).href;
  seek.max = String(end - 1);
  el<HTMLAnchorElement>("pose-atlas").href = new URL(
    "previews/kaneki/prancha.png",
    assetBase,
  ).href;
  el<HTMLAnchorElement>("scale-sheet").href = new URL(
    "previews/kaneki/escala.png",
    assetBase,
  ).href;
  for (const input of [modeInput, limbInput, layerInput])
    input.onchange = () => go(0);
  for (const input of [compare, guides]) input.onchange = draw;
  modeInput.onchange = () => {
    go(0);
    if (mode() === "free") {
      compare.checked = false;
      pause(false);
      canvas.focus();
      draw();
    }
  };
  mirror.onchange = () =>
    practice ? go(mode() === "free" ? 0 : elapsed) : draw();
  el<HTMLAnchorElement>("movement-atlas").href = movementAtlas.src;
  el<HTMLAnchorElement>("motion-sheet").href = new URL(
    "previews/kaneki/folha-movimento.png",
    assetBase,
  ).href;
  el<HTMLAnchorElement>("motion-preview").href = new URL(
    "previews/kaneki/movimentacao.webp",
    assetBase,
  ).href;
  play.onclick = () => pause(!paused);
  seek.oninput = () => {
    pause(true);
    go(Number(seek.value));
  };
  el("step").onclick = () => {
    pause(true);
    advance();
    draw();
  };
  el("next-frame").onclick = () => {
    pause(true);
    const key = () =>
      motion
        ? `${motion.clip}:${motion.animator.frame()}`
        : String(animator.frame());
    const before = key();
    for (let i = 0; i < end; i++) {
      advance();
      if (!motion) animator.seekTick(elapsed);
      if (key() !== before) break;
    }
    draw();
  };
  // Export the same native frames shown by the engine, without screen scaling.
  canvas.addEventListener("kaneki:export-poses", () =>
    download(sheet(false), "kagune-poses.png"),
  );
  canvas.addEventListener("kaneki:export-contact", () =>
    download(sheet(true), "prancha.png"),
  );
  canvas.addEventListener("kaneki:export-scale", () => {
    const output = document.createElement("canvas");
    output.width = 512;
    output.height = 256;
    scaleFrame(output.getContext("2d")!);
    download(output, "escala.png");
  });
  go(0);
  canvas.dataset.loaded = "true";
  new FixedLoop(
    () => {
      if (paused) return;
      debt += Number(speed.value);
      if (debt < 1) return;
      debt--;
      advance();
      draw();
    },
    () => {},
  ).start();
}
void start().catch(() => {
  el("status").textContent = "Falha ao carregar os sprites do laboratório.";
});
