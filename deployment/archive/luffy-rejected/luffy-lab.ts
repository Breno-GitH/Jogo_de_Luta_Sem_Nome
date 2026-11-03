import { assetBase } from "./asset-base";
import { characters } from "./engine/characters";
import { Match } from "./engine/combat";
import { neutral } from "./engine/types";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { elasticGeometry } from "./engine/elastic";
import { paintElastic } from "./render/elastic";
import { Animator, type AnimationData } from "./render/animator";
import elastic from "./data/luffy-elastic.json";
import movement from "./data/luffy-animations.json";

const clipLabels = {
  idle: "Guarda",
  walkForward: "Caminhada para frente",
  walkBack: "Recuo",
  dashForward: "Dash",
  backdash: "Backdash",
  crouchStart: "Início do agachamento",
  crouchIdle: "Agachado",
  crouchEnd: "Saída do agachamento",
  jumpStart: "Preparação do salto",
  jumpRise: "Subida",
  jumpApex: "Ápice",
  jumpFall: "Queda",
  landing: "Aterrissagem",
};

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id).value;
const checked = (id: string) => el<HTMLInputElement>(id).checked;
async function startLab() {
  const images = new Map<string, HTMLImageElement>();
  const files = [
    "luffy/base.png",
    "luffy/base-p2.png",
    "luffy/body.png",
    "luffy/fist.png",
    "samurai/base.png",
    "dio/base.png",
    "goku/base.png",
    "luffy/movement.png",
    "luffy/movement-p2.png",
  ];
  const rig = (await fetch(`${assetBase}sprites/luffy/rig.json`).then((r) =>
    r.json(),
  )) as {
    points: Record<string, [number, number]>;
  };
  const modelInfo = (await fetch(`${assetBase}sprites/luffy/model.json`).then(
    (r) => r.json(),
  )) as { bounds: number[] };
  const model = el<HTMLCanvasElement>("model"),
    limb = el<HTMLCanvasElement>("limb");
  const metadata: AnimationData = movement;
  const animator = new Animator(metadata);
  const animationSelect = el<HTMLSelectElement>("animation");
  for (const [name, label] of Object.entries(clipLabels))
    animationSelect.add(new Option(label, name));
  const baseOption = new Option("Sprite-base", "base");
  animationSelect.add(baseOption, 0);
  let playing = true;
  let tick = 0;
  let renderedTick = -1;
  for (const file of files) {
    const image = new Image();
    image.src = `${assetBase}sprites/${file}`;
    await image.decode();
    images.set(file, image);
  }
  const probe = document.createElement("canvas");
  probe.width = metadata.frameWidth;
  probe.height = metadata.frameHeight;
  const probeContext = probe.getContext("2d", { willReadFrequently: true })!;
  const boundsCache = new Map<number, number[]>();
  function frameBounds() {
    const frame = animator.frame();
    const saved = boundsCache.get(frame);
    if (saved) return saved;
    const { sheet, x, y, width, height } = animator.sprite();
    probeContext.clearRect(0, 0, width, height);
    probeContext.drawImage(images.get(sheet)!, x, y, width, height, 0, 0, width, height);
    const pixels = probeContext.getImageData(0, 0, width, height).data;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (!pixels[(py * width + px) * 4 + 3]) continue;
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px + 1);
        y1 = Math.max(y1, py + 1);
      }
    }
    const bounds = [x0, y0, x1, y1];
    boundsCache.set(frame, bounds);
    return bounds;
  }
  const showBase = () => select("animation") === "base" || checked("compare");
  const activeClip = () => metadata.clips[animator.clipName];
  const selectedFrame = () => activeClip().frames.indexOf(animator.frame());
  function setPlaying(value: boolean) {
    playing = value;
    const button = el<HTMLButtonElement>("play");
    button.textContent = playing ? "Pausar" : "Reproduzir";
    button.setAttribute("aria-pressed", String(playing));
    model.dataset.playing = String(playing);
  }
  const backdrop = (
    c: CanvasRenderingContext2D,
    w: number,
    h: number,
    floor: number,
  ) => {
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#192a36";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#1d303e";
    for (let x = 0; x < w; x += 32)
      for (let y = 0; y < h; y += 32)
        if ((x + y) % 64 === 0) c.fillRect(x, y, 32, 32);
    c.fillStyle = "#70cbbd";
    c.fillRect(0, floor, w, 1);
  };
  function drawModel() {
    const c = model.getContext("2d")!,
      zoom = Number(select("zoom")),
      facing = Number(select("facing"));
    const floor = 564;
    backdrop(c, 1280, 620, floor);
    const comparison = checked("compare");
    const base = showBase();
    const actors = comparison ? ["samurai", "dio", "goku", "luffy"] : ["luffy"];
    actors.forEach((name, i) => {
      const scale = comparison ? 2 : zoom,
        x = comparison ? 190 + i * 300 : 640;
      const isLuffy = name === "luffy";
      c.save();
      c.translate(x, floor);
      c.scale(facing * scale, scale);
      if (isLuffy && !base) {
        const { sheet, player2Sheet, x, y, width, height, pivot } = animator.sprite();
        const image = images.get((checked("p2") ? player2Sheet : undefined) ?? sheet)!;
        c.drawImage(image, x, y, width, height, -pivot.x, -pivot.y, width, height);
      } else {
        const file = isLuffy && checked("p2") ? "base-p2.png" : "base.png";
        c.drawImage(images.get(`${name}/${file}`)!, -128, -224);
      }
      if (isLuffy && checked("bounds")) {
        const [x0, y0, x1, y1] = base ? modelInfo.bounds : frameBounds();
        const pivot = base ? { x: 128, y: 224 } : animator.sprite().pivot;
        c.strokeStyle = "#65cbbc";
        c.lineWidth = 1 / scale;
        c.strokeRect(x0 - pivot.x, y0 - pivot.y, x1 - x0, y1 - y0);
      }
      if (isLuffy && base && checked("rig")) {
        c.fillStyle = "#ffdc75";
        for (const [x, y] of Object.values(rig.points))
          c.fillRect(x - 129, y - 225, 2, 2);
      }
      c.restore();
      if (checked("rig")) {
        c.fillStyle = "#ff6d81";
        c.fillRect(x - 5, floor, 11, 1);
        c.fillRect(x, floor - 5, 1, 11);
      }
      c.fillStyle = "#e6d4b1";
      c.font = "16px monospace";
      c.fillText(`${name.toUpperCase()} · ${scale}×`, x - 80, 602);
    });
    model.dataset.facing = select("facing");
    model.dataset.animation = base ? "base" : animator.clipName;
    model.dataset.drawings = String(base ? 1 : activeClip().frames.length);
    model.dataset.frame = String(base ? 0 : selectedFrame());
    model.dataset.tick = String(base ? 0 : animator.elapsedTicks);
    el("frame-status").textContent = base
      ? "Sprite-base · pivô (128, 224)"
      : `Quadro ${selectedFrame() + 1}/${activeClip().frames.length} · tick ${animator.elapsedTicks} · célula ${animator.frame() + 1}`;
  }
  function drawLimb() {
    const c = limb.getContext("2d")!,
      facing = Number(select("facing"));
    backdrop(c, 1280, 380, 330);
    const length = Number(el<HTMLInputElement>("length").value);
    const enabled = checked("elastic");
    const x = facing === 1 ? 180 : 1100;
    c.save();
    c.translate(x, 330);
    c.scale(facing * 2, 2);
    c.drawImage(
      images.get(enabled ? "luffy/body.png" : "luffy/base.png")!,
      -128,
      -224,
    );
    const geometry = elasticGeometry({
      root: elastic.root,
      tip: { x: elastic.root.x + length, y: elastic.root.y - 3 },
      radius: elastic.radius,
      bend: Number(el<HTMLInputElement>("bend").value),
      maximumLength: elastic.maximumLength,
      active: false,
    });
    if (enabled) {
      paintElastic(c, geometry);
      c.drawImage(
        images.get("luffy/fist.png")!,
        geometry.tip.x - elastic.hand.anchor.x,
        geometry.tip.y - elastic.hand.anchor.y,
      );
      if (checked("geometry")) {
        c.fillStyle = "#87dbce";
        for (const p of geometry.centers) c.fillRect(p.x, p.y, 1, 1);
        c.strokeStyle = "#f7c86b";
        c.lineWidth = 0.5;
        c.strokeRect(geometry.tip.x - 6, geometry.tip.y - 6, 23, 12);
      }
    }
    c.restore();
    c.fillStyle = "#e8cc8d";
    c.font = "15px monospace";
    c.fillText("BANCADA GEOMÉTRICA · SEM ATAQUE · HITBOX ATIVA: 0", 28, 32);
    c.fillText(
      `Comprimento limitado: ${Math.round(Math.hypot(geometry.tip.x - elastic.root.x, geometry.tip.y - elastic.root.y))} px`,
      28,
      56,
    );
    limb.dataset.activeHitboxes = String(geometry.hitboxes.length);
    limb.dataset.nativeLength = String(length);
  }
  for (const id of [
    "facing",
    "zoom",
    "rig",
    "bounds",
    "compare",
    "p2",
    "elastic",
    "length",
    "bend",
    "geometry",
  ])
    el(id).addEventListener("input", () => {
      drawModel();
      drawLimb();
    });
  drawModel();
  drawLimb();
  setPlaying(true);
  animationSelect.addEventListener("input", () => {
    if (animationSelect.value !== "base") animator.update(animationSelect.value, true);
    tick = 0;
    drawModel();
  });
  function stepFrame(direction: number) {
    if (showBase()) return;
    setPlaying(false);
    const length = activeClip().frames.length;
    animator.seekFrame((selectedFrame() + direction + length) % length);
    tick = animator.elapsedTicks;
    drawModel();
  }
  el("previous").onclick = () => stepFrame(-1);
  el("next").onclick = () => stepFrame(1);
  el("play").onclick = () => setPlaying(!playing);
  const palette = (await fetch(`${assetBase}sprites/luffy/palette.json`).then(
    (r) => r.json(),
  )) as Record<string, string>;
  for (const [key, color] of Object.entries(palette)) {
    const swatch = document.createElement("span");
    swatch.style.background = color;
    swatch.title = `${key} · ${color}`;
    el("palette").append(swatch);
  }
  el<HTMLAnchorElement>("home").href = assetBase;
  for (const [file, label] of [
    ["base.png", "PNG transparente"],
    ["base-p2.png", "Paleta 2"],
    ["base-preview-4x.png", "Prévia 4×"],
    ["movement.png", "Spritesheet de movimentação"],
    ["movement-p2.png", "Spritesheet · paleta 2"],
    ["movement-contact.png", "Todos os quadros"],
    ["movement-preview.gif", "Prévia animada"],
    ["silhouette-preview-4x.png", "Silhueta isolada"],
    ["rig-preview-4x.png", "Pivô e articulações"],
    ["rig.json", "Rig JSON"],
    ["model.json", "Manifesto"],
  ]) {
    const a = document.createElement("a");
    a.href = `${assetBase}sprites/luffy/${file}`;
    a.textContent = label;
    el("exports").append(a);
  }
  const canvas = el<HTMLCanvasElement>("game"),
    renderer = new Renderer(canvas);
  let match: Match;
  function reset() {
    match = new Match(characters.luffy, { training: true }, characters.samurai);
    match.phase = "fight";
    match.message = "";
    renderer.resetAnimations();
  }
  reset();
  await renderer.preparePalette("cyan");
  renderer.debug = true;
  el("reset").onclick = reset;
  el("game-debug").onchange = () => {
    renderer.debug = checked("game-debug");
  };
  const keyboard = new KeyboardInput({ dashOnDirection: true });
  canvas.onclick = () => canvas.focus();
  new FixedLoop(
    () => {
      const input = keyboard.sample();
      match!.step([
        document.activeElement === canvas ? input : neutral(),
        neutral(),
      ]);
      renderer.tick(match!);
      const f = match!.fighters[0];
      el("status").textContent =
        `Luffy: ${f.state} · ${canvas.dataset.animation ?? "idle"} · tick ${f.stateFrame} · posição ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`;
      canvas.dataset.character = f.data.id;
      canvas.dataset.state = f.state;
      canvas.dataset.facing = String(f.facing);
      if (playing && !showBase()) {
        const clip = activeClip();
        const duration = clip.frames.reduce(
          (sum, _, i) => sum + (clip.durations?.[i] ?? clip.ticks), 0,
        );
        tick = (tick + Number(select("speed"))) % duration;
        animator.seekTick(tick);
        if (renderedTick !== animator.elapsedTicks) {
          renderedTick = animator.elapsedTicks;
          drawModel();
        }
      }
    },
    () => renderer.draw(match!),
  ).start();
}
void startLab().catch((error) => {
  el("status").textContent = "Falha ao carregar o laboratório de Luffy.";
  console.error(error);
});
