import { Animator, metadata, type AnimationData } from "./render/animator";
import dioAnimation from "./data/dio-animations.json";
import worldAnimation from "./data/the-world-animations.json";
import dioData from "./data/dio-visual.json";
import worldData from "./data/the-world-visual.json";
import { LinkedEntity } from "./engine/linked-entity";
import { DioMovement } from "./engine/dio-movement";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { drawTestArena } from "./render/arena";
import { drawSpriteScene, type SpriteEntity } from "./render/sprite-scene";
import { FLOOR } from "./engine/combat";
import { DioMotionPresentation } from "./render/dio-motion";

interface Clip {
  label: string;
  sheet: string;
  count: number;
  durations: number[];
  loop: boolean;
  grounded: boolean;
  bounds: number[][];
}
interface Manifest {
  clips: Record<string, Clip>;
}
type EntityId = "dio" | "the-world";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const checked = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("preview"),
  c = canvas.getContext("2d")!;
const owner = new DioMovement(),
  stand = new LinkedEntity(worldData, owner);
const data: Record<EntityId, AnimationData> = {
  dio: dioAnimation,
  "the-world": worldAnimation,
};
const dio = new Animator(data.dio),
  world = new Animator(data["the-world"]),
  samurai = new Animator(metadata);
let motionPresentation = new DioMotionPresentation(dio);
let previousData: Record<EntityId, AnimationData>,
  previousManifests: Record<EntityId, Manifest>;
let previousActors: Record<EntityId, Animator>;
dio.update("idle", true);
world.update("standIdle", true);
samurai.update("idle", true);
const keyboard = new KeyboardInput({ dashOnDirection: true }),
  images = new Map<string, HTMLImageElement>();
let manifests: Record<EntityId, Manifest>,
  paused = false,
  loaded = false,
  rate = 0;
let inspector = new Animator(data.dio),
  inspectionClip = "idle",
  stripKey = "";
inspector.update("idle", true);
const selected = () => select("entity").value as EntityId;
const live = () => select("mode").value === "live";
const activeClip = () =>
  live()
    ? selected() === "dio"
      ? dio.clipName
      : stand.animation
    : inspectionClip;
const activeAnimator = () =>
  live() ? (selected() === "dio" ? dio : world) : inspector;

function syncActors() {
  motionPresentation.tick(owner);
  world.update(stand.animation);
  world.seekTick(stand.animationFrame);
}
function tick() {
  if (!live()) {
    inspector.update(inspectionClip);
    if (inspector.complete) {
      if (checked("repeat")) inspector.seekTick(0);
      else if (!manifests[selected()].clips[inspectionClip].loop)
        setPause(true);
    }
    return;
  }
  owner.tick(keyboard.sample());
  if (!checked("freeze-stand")) stand.tick();
  syncActors();
  samurai.update("idle");
}
function setPause(value: boolean) {
  paused = value;
  rate = 0;
  keyboard.clear();
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("next").disabled = !paused;
}
function inspect(key: string) {
  select("mode").value = "inspect";
  inspectionClip = key;
  inspector = new Animator(data[selected()]);
  inspector.update(key, true);
  keyboard.clear();
  setPause(false);
  stripKey = "";
  draw();
}
function seek(index: number) {
  if (live()) inspect(activeClip());
  inspector.seekFrame(index);
  setPause(true);
  draw();
}
function fillOptions() {
  select("animation").replaceChildren(
    ...Object.entries(manifests[selected()].clips).map(([key, clip]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${clip.label} · ${clip.count} quadros`;
      return option;
    }),
  );
  stripKey = "";
}
function thumbnails(clip: Clip, key: string) {
  const cache = `${selected()}:${key}`;
  if (cache === stripKey) return;
  stripKey = cache;
  const image = images.get(`${selected()}/${clip.sheet}`)!;
  el("strip").replaceChildren(
    ...Array.from({ length: clip.count }, (_, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Quadro ${i + 1}`);
      const tile = document.createElement("canvas");
      tile.width = tile.height = 256;
      const context = tile.getContext("2d")!;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 256 * i, 0, 256, 256, 0, 0, 256, 256);
      button.append(tile);
      button.onclick = () => seek(i);
      return button;
    }),
  );
}
function cross(
  x: number,
  y: number,
  color: string,
  label: string,
  zoom: number,
) {
  c.lineWidth = 1 / zoom;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - 5, y);
  c.lineTo(x + 5, y);
  c.moveTo(x, y - 5);
  c.lineTo(x, y + 5);
  c.stroke();
  c.font = `${10 / zoom}px monospace`;
  c.fillText(label, x + 7, y + (label === "ALVO" ? 9 : -5));
}
function draw() {
  if (!loaded) return;
  const zoom = Number(select("zoom").value),
    transform = stand.transform,
    reference = stand.reference;
  let entities: SpriteEntity[];
  if (live())
    entities = [
      {
        id: "dio",
        x: owner.x,
        y: owner.y,
        facing: owner.facing,
        depth: dioData.depth,
        animator: dio,
      },
      { id: worldData.id, ...transform, animator: world },
    ];
  else
    entities = [
      {
        id: selected(),
        x: 640,
        y: selected() === "dio" ? FLOOR : FLOOR - 18,
        facing: owner.facing,
        depth: 10,
        animator: inspector,
      },
    ];
  const comparable = entities.every(
    (e) =>
      !!previousData[e.id as EntityId].clips[
        e.animator.clipName.replace(/(Forward|Backward)$/g, (s) =>
          e.animator.clipName.startsWith("jump") ? "" : s,
        )
      ],
  );
  el<HTMLInputElement>("previous").disabled = !comparable;
  el("previous").title = comparable
    ? "Comparar movimentação aprovada"
    : "Comparação anterior disponível para a movimentação";
  const comparing = checked("previous") && comparable;
  if (comparing) {
    const old: SpriteEntity[] = [];
    for (const entity of entities) {
      const id = entity.id as EntityId,
        source = entity.animator;
      let key = source.clipName.replace(/Forward$|Backward$/g, (match) =>
        source.clipName.startsWith("jump") ? "" : match,
      );
      if (!previousData[id].clips[key])
        key = id === "dio" ? "idle" : "standIdle";
      const actor = previousActors[id],
        current = manifests[id].clips[source.clipName];
      const total = current.durations.reduce((s, v) => s + v, 0),
        prior = previousData[id].clips[key];
      const oldTotal = prior.durations!.reduce((s, v) => s + v, 0);
      actor.update(key);
      const phase =
        current.loop || (!live() && checked("repeat"))
          ? source.elapsedTicks % total
          : Math.min(source.elapsedTicks, total - 1);
      actor.seekTick(Math.floor((phase / total) * oldTotal));
      old.push({
        ...entity,
        id: "previous:" + id,
        x: entity.x - 85,
        animator: actor,
      });
      entity.x += 85;
    }
    entities.push(...old);
  }
  entities = entities.filter(
    (e) =>
      !(e.id.endsWith("dio") && checked("hide-dio")) &&
      !(e.id.endsWith("the-world") && checked("hide-world")),
  );
  // Fit the actual current PNG bounds, including the taller hovering Stand.
  // Zooming must not hide a head at the jump apex or at the arena edges.
  const bounds = entities.map((entity) => {
    const name = entity.id as EntityId,
      key = entity.id.startsWith("previous:")
        ? entity.animator.clipName
        : live()
          ? name === "dio"
            ? dio.clipName
            : stand.animation
          : inspectionClip;
    const old = entity.id.startsWith("previous:");
    const m = old
      ? previousManifests[entity.id.replace("previous:", "") as EntityId]
      : manifests[name];
    const b = m.clips[key].bounds[entity.animator.frame()];
    return {
      left: entity.x + (entity.facing === 1 ? b[0] - 128 : 128 - b[2]),
      right: entity.x + (entity.facing === 1 ? b[2] - 128 : 128 - b[0]),
      top: entity.y + b[1] - 224,
    };
  });
  if (!bounds.length)
    bounds.push({
      left: owner.x - 35,
      right: owner.x + 35,
      top: owner.y - 155,
    });
  const left = Math.min(...bounds.map((b) => b.left)),
    right = Math.max(...bounds.map((b) => b.right)),
    top = Math.min(...bounds.map((b) => b.top));
  const cameraX = Math.round(
    Math.max(right - 560 / zoom, Math.min(left + 560 / zoom, 640)),
  );
  // Reserve a stable headroom envelope. Framing every individual hair/bob
  // pixel made the floor oscillate vertically at 3x while both roots rested.
  const cameraY = Math.round(
      Math.min(
        FLOOR,
        Math.min(top, (live() ? owner.y : FLOOR) - 190) + (FLOOR - 90) / zoom,
      ),
    ),
    floorPan = (FLOOR - cameraY) * zoom;
  c.fillStyle = "#101b2b";
  c.fillRect(0, 0, 1280, 720);
  c.save();
  c.translate(0, floorPan);
  drawTestArena(c);
  c.restore();
  // Reproject the ground grid while the camera follows a moving owner.
  const floor = FLOOR + floorPan;
  if (floor < 720) {
    c.fillStyle = "#182731";
    c.fillRect(0, floor + 4, 1280, 720 - floor - 4);
    c.strokeStyle = "#30434b";
    c.lineWidth = 1;
    for (let worldX = -1000; worldX < 3000; worldX += 100) {
      const x = 640 + (worldX - cameraX) * zoom;
      c.beginPath();
      c.moveTo(640 + (x - 640) * 0.6, floor + 4);
      c.lineTo(x, 720);
      c.stroke();
    }
    for (const dy of [29, 70, 128]) {
      c.beginPath();
      c.moveTo(0, floor + dy);
      c.lineTo(1280, floor + dy);
      c.stroke();
    }
  }
  c.save();
  c.translate(640, FLOOR);
  c.scale(zoom, zoom);
  c.translate(-cameraX, -cameraY);
  if (checked("compare"))
    entities.push({
      id: "samurai",
      x: live() ? owner.x + 160 * owner.facing : 840,
      y: FLOOR,
      facing: -owner.facing,
      depth: 10,
      animator: samurai,
    });
  const order = drawSpriteScene(c, entities, images);
  if (checked("guides")) {
    if (live()) {
      c.lineWidth = 1 / zoom;
      c.setLineDash([3 / zoom, 3 / zoom]);
      c.strokeStyle = "#94bdcf";
      c.beginPath();
      c.moveTo(owner.x, owner.y);
      c.lineTo(reference.x, reference.y);
      c.lineTo(transform.x, transform.y);
      c.stroke();
      c.setLineDash([]);
      const offset = comparing ? 85 : 0;
      cross(owner.x + offset, owner.y, "#f0ce77", "DIO", zoom);
      cross(transform.x + offset, transform.y, "#89d8c6", "STAND REAL", zoom);
      cross(reference.x + offset, reference.y, "#a4bfe8", "ALVO", zoom);
      c.strokeStyle = "#697b85";
      c.beginPath();
      c.moveTo(owner.x - 50, FLOOR);
      c.lineTo(owner.x + 70, FLOOR);
      c.stroke();
    } else
      cross(
        640 + (comparing ? 85 : 0),
        selected() === "dio" ? FLOOR : FLOOR - 18,
        "#f0ce77",
        "PIVO (128,224)",
        zoom,
      );
  }
  c.restore();
  c.fillStyle = "#efe3c5";
  c.font = "14px monospace";
  c.fillText(
    comparing
      ? "ANTES (ESQUERDA) / REVISÃO 2 (DIREITA)"
      : "DIO + THE WORLD / MOVIMENTAÇÃO / REVISÃO 2",
    42,
    44,
  );
  c.fillStyle = "#a7b9be";
  c.font = "12px monospace";
  c.fillText(
    live()
      ? "A/D andar · W pular · S agachar · Shift + A/D dash · F virar"
      : "Inspeção das spritesheets reais · pausável e quadro a quadro",
    42,
    66,
  );
  const key = activeClip(),
    clip = manifests[selected()].clips[key],
    animator = activeAnimator(),
    frame = animator.frame();
  select("animation").value = key;
  thumbnails(clip, key);
  el<HTMLInputElement>("frame").max = String(clip.count - 1);
  el<HTMLInputElement>("frame").value = String(frame);
  el("frame-number").textContent =
    `${frame + 1} / ${clip.count} · ${clip.durations[frame]} ticks · ${clip.loop ? "loop" : "única"}`;
  Array.from(el("strip").children).forEach((button, i) =>
    button.setAttribute("aria-pressed", String(i === frame)),
  );
  const download = el<HTMLAnchorElement>("download");
  download.href = new URL(
    `../sprites/${selected()}/${clip.sheet}`,
    location.href,
  ).href;
  download.download = clip.sheet;
  Object.assign(canvas.dataset, {
    loaded: "true",
    ownerX: String(owner.x),
    ownerY: String(owner.y),
    facing: String(owner.facing),
    standX: String(transform.x),
    standY: String(transform.y),
    standRefX: String(reference.x),
    standRefY: String(reference.y),
    standDepth: String(transform.depth),
    standState: stand.state,
    standTick: String(stand.clock),
    dioTick: String(owner.clock),
    ownerState: owner.state,
    ownerAnimation: dio.clipName,
    revision: "2",
    comparison: String(comparing),
    visible: entities.map((e) => e.id).join(","),
    standAnimation: stand.animation,
    dioFrame: String(dio.frame()),
    standFrame: String(world.frame()),
    mode: live() ? "live" : "inspect",
    entity: selected(),
    animation: key,
    frame: String(frame),
    order: order.join(","),
    paused: String(paused),
    spriteTop: String(FLOOR + (top - cameraY) * zoom),
    spriteLeft: String(640 + (left - cameraX) * zoom),
    spriteRight: String(640 + (right - cameraX) * zoom),
  });
  el("status").textContent = live()
    ? `Dio: ${owner.state} · Stand: ${stand.animation} · ${paused ? "PAUSADO" : "60 ticks/s"}`
    : `${selected() === "dio" ? "DIO" : "THE WORLD"} · ${clip.label} · ${paused ? "PAUSADO" : "REPRODUZINDO"}`;
  el("debug-info").hidden = !checked("guides");
  el("debug-info").textContent =
    `Dio (${owner.x.toFixed(1)}, ${owner.y.toFixed(1)}) · Stand (${transform.x}, ${transform.y}) · Alvo (${reference.x.toFixed(1)}, ${reference.y.toFixed(1)}) · Δ (${(transform.x - owner.x).toFixed(1)}, ${(transform.y - owner.y).toFixed(1)}) px · camada ${transform.depth} · direção ${owner.facing}`;
  el<HTMLButtonElement>("deploy").disabled = !live() || stand.state !== "hover";
}

async function start() {
  const [a, b] = await Promise.all([
    fetch(new URL("../sprites/dio/movement.json", location.href)),
    fetch(new URL("../sprites/the-world/movement.json", location.href)),
  ]);
  if (!a.ok || !b.ok) throw new Error("Metadados de movimento não encontrados");
  manifests = { dio: await a.json(), "the-world": await b.json() };
  for (const [id, file] of [
    ["dio", "commands.json"],
    ["dio", "specials.json"],
    ["dio", "road-roller.json"],
    ["dio", "secondary.json"],
    ["the-world", "stand-actions.json"],
    ["the-world", "specials.json"],
    ["the-world", "road-roller.json"],
    ["the-world", "secondary.json"],
  ] as const) {
    const response = await fetch(
      new URL(`../sprites/${id}/${file}`, location.href),
    );
    if (!response.ok)
      throw new Error(`Animações de combate indisponíveis: ${id}`);
    Object.assign(manifests[id].clips, (await response.json()).clips);
  }
  const previous = await Promise.all(
    ["dio", "the-world"].map(async (id) => {
      const root = new URL(
        `../sprites/previous-movement/${id}/`,
        location.href,
      );
      const [animation, manifest] = await Promise.all([
        fetch(new URL("animations.json", root)).then((r) => r.json()),
        fetch(new URL("movement.json", root)).then((r) => r.json()),
      ]);
      return { id, animation, manifest };
    }),
  );
  previousData = Object.fromEntries(
    previous.map((p) => [p.id, p.animation]),
  ) as Record<EntityId, AnimationData>;
  previousManifests = Object.fromEntries(
    previous.map((p) => [p.id, p.manifest]),
  ) as Record<EntityId, Manifest>;
  previousActors = {
    dio: new Animator(previousData.dio),
    "the-world": new Animator(previousData["the-world"]),
  };
  const sheets = new Set([
    metadata.clips.idle.sheet,
    ...[...Object.values(data), ...Object.values(previousData)].flatMap((d) => [
      d.sheet,
      ...Object.values(d.clips).map((clip) => clip.sheet ?? d.sheet),
    ]),
  ]);
  await Promise.all(
    [...sheets].map(async (sheet) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Falha ao carregar ${sheet}`));
        image.src = new URL(`../sprites/${sheet}`, location.href).href;
      });
      images.set(sheet, image);
    }),
  );
  fillOptions();
  loaded = true;
  syncActors();
  select("mode").onchange = () => {
    keyboard.clear();
    setPause(false);
    if (!live()) inspect(selected() === "dio" ? owner.state : stand.animation);
    else {
      stripKey = "";
      draw();
    }
  };
  select("entity").onchange = () => {
    fillOptions();
    if (!live()) inspect(selected() === "dio" ? "idle" : "standIdle");
    else draw();
  };
  select("animation").onchange = () => inspect(select("animation").value);
  el("deploy").onclick = () => {
    stand.advance();
    canvas.focus();
  };
  el("flip").onclick = () => {
    owner.turn();
    draw();
  };
  el("pause").onclick = () => {
    if (
      paused &&
      !live() &&
      inspector.complete &&
      !manifests[selected()].clips[inspectionClip].loop
    )
      inspector.seekTick(0);
    setPause(!paused);
    draw();
  };
  el("next").onclick = () => {
    if (paused) {
      tick();
      draw();
    }
  };
  el("frame-next").onclick = () =>
    seek(
      (activeAnimator().frame() + 1) %
        manifests[selected()].clips[activeClip()].count,
    );
  el("frame-previous").onclick = () =>
    seek(
      (activeAnimator().frame() +
        manifests[selected()].clips[activeClip()].count -
        1) %
        manifests[selected()].clips[activeClip()].count,
    );
  el<HTMLInputElement>("frame").oninput = () =>
    seek(Number(el<HTMLInputElement>("frame").value));
  el("reset").onclick = () => {
    owner.reset();
    stand.reset();
    motionPresentation = new DioMotionPresentation(dio);
    keyboard.clear();
    syncActors();
    draw();
  };
  for (const id of [
    "zoom",
    "compare",
    "freeze-stand",
    "guides",
    "previous",
    "hide-dio",
    "hide-world",
    "repeat",
  ])
    el(id).onchange = draw;
  canvas.onclick = () => canvas.focus();
  window.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.repeat ||
      !live()
    )
      return;
    if (event.code === "KeyF") {
      event.preventDefault();
      owner.turn();
      draw();
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (!paused) stand.advance();
    }
  });
  const loop = new FixedLoop(() => {
    if (!paused && !document.hidden) {
      rate += Number(select("speed").value);
      while (rate >= 1 && !paused) {
        rate--;
        tick();
      }
    }
  }, draw);
  loop.start();
  draw();
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}
void start().catch((error) => {
  el("error").textContent = String(error);
});
