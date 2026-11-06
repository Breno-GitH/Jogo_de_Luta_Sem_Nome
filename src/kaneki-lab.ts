import { assetBase } from "./asset-base";
import { characterPreviews } from "./engine/character-previews";
import {
  kaguneIds,
  Rinkaku,
  type KaguneId,
  type KaguneLayer,
  type KagunePose,
} from "./engine/kagune";
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
} as const;
type Mode = keyof typeof modes;
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
  sasuke = new Image();
bodyAtlas.src = new URL(`sprites/${kaneki.animations.sheet}`, assetBase).href;
sasuke.src = new URL("sprites/sasuke/base.png", assetBase).href;

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
  elapsed = 0;
}
function advance() {
  if (mode() === "cycle" && elapsed + 1 >= end) reset();
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
  for (const pose of poses)
    if (pose.layer === "behind") drawKagune(ctx, pose, side);
  body(ctx, bodyAtlas, position, side, x, y);
  for (const pose of poses)
    if (pose.layer === "front") drawKagune(ctx, pose, side);
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
) {
  ctx.fillStyle = "#1d1d2c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#282535";
  for (let i = 0; i < w; i += 32) ctx.fillRect(i, 0, 1, ground);
  ctx.fillStyle = "#181723";
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = "#6f556c";
  ctx.fillRect(0, ground, w, 1);
}

function scaleFrame(ctx: CanvasRenderingContext2D, tick = 0, side: 1 | -1 = 1) {
  background(ctx, 512, 256, floor);
  const left = { x: 152, y: floor },
    right = { x: 360, y: floor };
  figure(ctx, rinkaku, left, side, tick, false);
  body(ctx, sasuke, right, -side as 1 | -1, 0, 0);
  ctx.fillStyle = "#f9b2bc";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("KANEKI KEN", left.x, 242);
  ctx.fillText("SASUKE HEBI", right.x, 242);
  ctx.fillStyle = "#b2a6bc";
  ctx.textAlign = "left";
  for (const h of [0, 32, 64, 96, 128, 160]) {
    ctx.fillRect(25, floor - h, 6, 1);
    ctx.fillText(String(h), 5, floor - h + 3);
  }
  return left;
}

function draw() {
  const side = facing();
  let position = { x: 256, y: floor };
  let poses: KagunePose[] = [];
  if (compare.checked) position = scaleFrame(c, elapsed, side);
  else {
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
  const current = animator.frame();
  const active = poses.find((p) => p.id === limb());
  seek.value = String(elapsed % end);
  Object.assign(canvas.dataset, {
    frame: String(current),
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
    `Desenho ${current + 1}/6 · Tick ${elapsed}${active ? ` · ${phaseLabel[active.phase]} · ${Math.round(active.length)} px` : ""}`;
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

try {
  await Promise.all([bodyAtlas.decode(), sasuke.decode()]);
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
  for (const input of [compare, mirror, guides]) input.onchange = draw;
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
    const before = animator.frame();
    do {
      advance();
      animator.seekTick(elapsed);
    } while (animator.frame() === before);
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
} catch {
  el("status").textContent = "Falha ao carregar os sprites do laboratório.";
}
