import { assetBase } from "./asset-base";
import { characters } from "./engine/characters";
import { Match } from "./engine/combat";
import { neutral } from "./engine/types";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { elasticGeometry } from "./engine/elastic";
import { paintElastic } from "./render/elastic";
import elastic from "./data/luffy-elastic.json";

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
    "luffy/side-model.png",
    "luffy/expressions.png",
    "samurai/base.png",
    "dio/base.png",
    "goku/base.png",
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
  for (const file of files) {
    const image = new Image();
    image.src = `${assetBase}sprites/${file}`;
    await image.decode();
    images.set(file, image);
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
    const actors = comparison ? ["samurai", "dio", "goku", "luffy"] : ["luffy"];
    actors.forEach((name, i) => {
      const scale = comparison ? 2 : zoom,
        x = comparison ? 190 + i * 300 : 640;
      const study = select("expression"),
        side = study === "side";
      const image = images.get(
        name === "luffy"
          ? side
            ? "luffy/side-model.png"
            : "luffy/expressions.png"
          : `${name}/base.png`,
      )!;
      c.save();
      c.translate(x, floor);
      c.scale(facing * scale, scale);
      c.drawImage(
        image,
        name === "luffy" && !side ? Number(study) * 256 : 0,
        0,
        256,
        256,
        -128,
        -224,
        256,
        256,
      );
      if (name === "luffy" && checked("bounds")) {
        const [x0, y0, x1, y1] = modelInfo.bounds;
        c.strokeStyle = "#65cbbc";
        c.lineWidth = 1 / scale;
        c.strokeRect(x0 - 128, y0 - 224, x1 - x0, y1 - y0);
      }
      if (name === "luffy" && checked("rig") && !side) {
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
    model.dataset.expression = select("expression");
    model.dataset.facing = select("facing");
    model.dataset.drawings = "1";
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
    "expression",
    "facing",
    "zoom",
    "rig",
    "bounds",
    "compare",
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
    ["model-contact.png", "Estudos e lateral"],
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
        `Luffy: ${f.state} · tick ${f.stateFrame} · posição ${f.x.toFixed(1)}, ${f.y.toFixed(1)} · desenho-base 0/1 · animação deste estado pendente`;
      canvas.dataset.character = f.data.id;
      canvas.dataset.state = f.state;
    },
    () => renderer.draw(match!),
  ).start();
}
void startLab().catch((error) => {
  el("status").textContent = "Falha ao carregar o laboratório de Luffy.";
  console.error(error);
});
