import { Match, FLOOR } from "./engine/combat";
import { characters } from "./engine/characters";
import { KeyboardInput } from "./engine/input";
import { neutral } from "./engine/types";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { Animator } from "./render/animator";
import animation from "./data/goku-animations.json";
import anatomy from "./data/goku-anatomy-guides.json";
import { drawCombatDebug } from "./render/debug";
import { worldRect } from "./engine/geometry";
interface Clip {
  label: string;
  sheet: string;
  count: number;
  columns?: number;
  internal?: boolean;
  externalGeometry?: string;
  sourceClip?: string;
  framesPerSource?: number;
  durations: number[];
  loop: boolean;
  poses: { hurtboxes: { x: number; y: number; w: number; h: number }[] }[];
  bounds: number[][];
  rebuildStage?: string;
}
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id),
  check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  c = canvas.getContext("2d")!,
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput({ dashOnDirection: true });
let match: Match,
  manifest: { clips: Record<string, Clip>; rebuildRevision?: number },
  previous: { clips: Record<string, Clip> },
  loaded = false,
  paused = false,
  rate = 0,
  clip = "idle",
  facing = 1,
  stripKey = "";
const inspector = new Animator(animation),
  images = new Map<string, HTMLImageElement>(),
  oldImages = new Map<string, HTMLImageElement>();
const live = () => select("mode").value === "live";
function drawAnatomy(key: string, frame: number) {
  const guide = (
    anatomy.poses as Record<string, { points: Record<string, number[]> }>
  )[`${key}/${frame}`];
  if (!check("landmarks") || !guide) return;
  c.strokeStyle = "#a4ed90";
  c.fillStyle = "#a4ed90";
  c.lineWidth = 0.5;
  for (const chain of [
    ["head", "neck", "hip"],
    ["neck", "shoulderNear", "elbowNear", "wristNear"],
    ["neck", "shoulderFar", "elbowFar", "wristFar"],
    ["hip", "kneeNear", "ankleNear", "footNear"],
    ["hip", "kneeFar", "ankleFar", "footFar"],
  ]) {
    c.beginPath();
    chain.forEach((name, i) => {
      const p = guide.points[name];
      if (i) c.lineTo(p[0] - 128, p[1] - 224);
      else c.moveTo(p[0] - 128, p[1] - 224);
    });
    c.stroke();
  }
  for (const p of Object.values(guide.points))
    c.fillRect(p[0] - 129, p[1] - 225, 2, 2);
}
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function reset() {
  match = new Match(
    characters.goku,
    { training: true, infiniteHealth: [true, true] },
    characters.samurai,
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = facing === 1 ? 440 : 840;
  b.x = facing === 1 ? 1080 : 200;
  a.facing = facing;
  b.facing = -facing;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  rate = 0;
  paused = false;
  sync();
  draw();
  canvas.focus();
}
function tick() {
  if (live()) {
    const input = keyboard.sample();
    input.pressed = input.pressed.filter(
      (button) => button === "jump" || button === "dash",
    );
    match.step([input, neutral()]);
    renderer.tick(match);
  } else {
    const total = manifest.clips[clip].durations.reduce((a, b) => a + b, 0);
    if (!check("repeat") && inspector.elapsedTicks >= total - 1) {
      paused = true;
      inspector.seekTick(total - 1);
      sync();
      return;
    }
    inspector.update(clip);
    if (check("repeat") && inspector.complete) inspector.seekTick(0);
  }
}
function seek(i: number) {
  if (live()) {
    select("mode").value = "inspect";
    clip = canvas.dataset.animation ?? "idle";
    const meta = manifest.clips[clip];
    if (meta.internal) {
      clip = meta.sourceClip ?? "idle";
      i = Math.floor(i / (meta.framesPerSource ?? 8));
    }
    select("animation").value = clip;
    inspector.update(clip, true);
  }
  inspector.seekFrame(i);
  paused = true;
  keyboard.clear();
  sync();
  draw();
}
function thumbnails() {
  const key = live() ? (canvas.dataset.animation ?? "idle") : clip;
  if (manifest.clips[key]?.internal) {
    if (stripKey !== key) {
      stripKey = key;
      el("strip").replaceChildren();
    }
    return;
  }
  if (stripKey === key) return;
  stripKey = key;
  const meta = manifest.clips[key],
    im = images.get(meta.sheet)!;
  el("strip").replaceChildren(
    ...Array.from({ length: meta.count }, (_, i) => {
      const button = document.createElement("button");
      button.setAttribute("aria-label", `Quadro ${i + 1}`);
      const tile = document.createElement("canvas");
      tile.width = tile.height = 256;
      const ctx = tile.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const columns = meta.columns ?? meta.count;
      ctx.drawImage(
        im,
        (i % columns) * 256,
        Math.floor(i / columns) * 256,
        256,
        256,
        0,
        0,
        256,
        256,
      );
      button.append(tile);
      button.onclick = () => {
        if (live()) {
          clip = key;
          select("mode").value = "inspect";
          select("animation").value = key;
          inspector.update(key, true);
        }
        seek(i);
      };
      return button;
    }),
  );
  el<HTMLAnchorElement>("sheet-download").href =
    `../sprites/goku/${meta.sheet}`;
}
function draw() {
  if (!loaded || !match) return;
  const zoom = Number(select("zoom").value);
  const a = match.fighters[0];
  c.imageSmoothingEnabled = false;
  if (live()) {
    renderer.inspectionZoom = zoom;
    renderer.inspectionTarget = 0;
    renderer.debug = check("boxes");
    renderer.draw(match);
    if (check("guides")) {
      const cx = Math.round(a.x),
        cy = Math.round(Math.min(FLOOR, a.y - 185 + 480 / zoom));
      const x = Math.round(640 + (a.x - cx) * zoom),
        y = Math.round(FLOOR + (a.y - cy) * zoom);
      c.save();
      c.strokeStyle = "#75d2cc";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - 7, y);
      c.lineTo(x + 7, y);
      c.moveTo(x, y - 7);
      c.lineTo(x, y + 7);
      c.stroke();
      c.restore();
    }
    if (check("bounds")) {
      const meta = manifest.clips[canvas.dataset.animation ?? "idle"],
        frame = Number(canvas.dataset.frame ?? 0),
        b = meta?.bounds[frame];
      if (b) {
        const cy = Math.round(Math.min(FLOOR, a.y - 185 + 480 / zoom));
        c.save();
        c.translate(640, FLOOR + (a.y - cy) * zoom);
        c.scale(zoom * a.facing, zoom);
        c.strokeStyle = "#ffbe68";
        c.lineWidth = 1 / zoom;
        c.strokeRect(b[0] - 128, b[1] - 224, b[2] - b[0], b[3] - b[1]);
        c.restore();
      }
    }
    if (check("landmarks")) {
      const cy = Math.round(Math.min(FLOOR, a.y - 185 + 480 / zoom));
      c.save();
      c.translate(640, FLOOR + (a.y - cy) * zoom);
      c.scale(zoom * a.facing, zoom);
      drawAnatomy(
        canvas.dataset.animation ?? "idle",
        Number(canvas.dataset.frame),
      );
      c.restore();
    }
  } else {
    c.fillStyle = "#152236";
    c.fillRect(0, 0, 1280, 720);
    const compare = check("compare");
    const drawPose = (
      meta: Clip,
      images: Map<string, HTMLImageElement>,
      frame: number,
      x: number,
      label: string,
    ) => {
      c.save();
      c.translate(x, 620);
      c.scale(zoom * facing, zoom);
      const columns = meta.columns ?? meta.count;
      c.drawImage(
        images.get(meta.sheet)!,
        (frame % columns) * 256,
        Math.floor(frame / columns) * 256,
        256,
        256,
        -128,
        -224,
        256,
        256,
      );
      if (check("boxes"))
        drawCombatDebug(
          c,
          meta.poses[frame].hurtboxes.map((b) => worldRect(b, 0, 0, 1)),
          [],
        );
      if (check("bounds")) {
        const b = meta.bounds[frame];
        c.strokeStyle = "#ffbe68";
        c.lineWidth = 1 / zoom;
        c.strokeRect(b[0] - 128, b[1] - 224, b[2] - b[0], b[3] - b[1]);
      }
      if (check("guides")) {
        c.strokeStyle = "#7ac9c7";
        c.lineWidth = 1 / zoom;
        c.beginPath();
        c.moveTo(-115, 0);
        c.lineTo(115, 0);
        c.moveTo(0, -7);
        c.lineTo(0, 7);
        c.moveTo(-7, 0);
        c.lineTo(7, 0);
        c.stroke();
      }
      if (meta.rebuildStage) drawAnatomy(clip, frame);
      c.restore();
      c.fillStyle = "#f3d58c";
      c.font = "20px system-ui";
      c.textAlign = "center";
      c.fillText(label, x, 46);
      c.textAlign = "start";
    };
    const current = manifest.clips[clip];
    let oldFrame = 0;
    if (compare && previous.clips[clip]) {
      const old = previous.clips[clip];
      const total = current.durations.reduce((a, b) => a + b, 0);
      const oldTotal = old.durations.reduce((a, b) => a + b, 0);
      let time =
        (Math.min(total - 1, inspector.elapsedTicks % total) / total) *
        oldTotal;
      for (let i = 0; i < old.count; i++) {
        oldFrame = i;
        if (time < old.durations[i]) break;
        time -= old.durations[i];
      }
      drawPose(
        old,
        oldImages,
        oldFrame,
        320,
        `ANTERIOR · desenho ${oldFrame + 1}/${old.count}`,
      );
    } else if (compare) {
      c.fillStyle = "#bfc9cd";
      c.font = "20px system-ui";
      c.fillText("Sem sequência equivalente na versão anterior", 90, 300);
    }
    drawPose(
      current,
      images,
      inspector.frame(),
      compare ? 960 : 640,
      `${current.rebuildStage ? "RECONSTRUÇÃO 5 / " + current.rebuildStage : clip.startsWith("walk") ? "CAMINHADA 4" : "AGUARDANDO REVISÃO"} · desenho ${inspector.frame() + 1}/${current.count}`,
    );
    Object.assign(canvas.dataset, {
      animation: clip,
      frame: String(inspector.frame()),
      physicsState: "inspection",
      oldFrame: String(oldFrame),
      animationTick: String(inspector.elapsedTicks),
    });
  }
  Object.assign(canvas.dataset, {
    loaded: "true",
    mode: live() ? "live" : "inspect",
    playerX: String(a.x),
    rootY: String(a.y),
    vx: String(a.vx),
    vy: String(a.vy),
    facing: String(live() ? a.facing : facing),
    smoothing: String(c.imageSmoothingEnabled),
    character: "goku",
    previewTick: String(match.frame),
    revision: String(manifest.rebuildRevision ?? 2),
    walkRevision: "5",
    compare: String(!live() && check("compare")),
    repeated: String(check("repeat")),
  });
  const actual = canvas.dataset.animation ?? "idle";
  const meta = manifest.clips[actual],
    frame = Number(canvas.dataset.frame ?? 0),
    elapsed = Number(canvas.dataset.animationTick ?? 0),
    total = meta.durations.reduce((a, b) => a + b, 0),
    b = meta.bounds[frame];
  Object.assign(canvas.dataset, {
    clipTicks: String(total),
    drawingTicks: String(meta.durations[frame]),
    bounds: b.join(","),
  });
  el("readout").textContent =
    `GOKU / ${live() ? a.state : "inspeção"} · ${actual} · desenho ${frame + 1}/${meta.count}\nTick da animação ${elapsed}/${total} · este desenho dura ${meta.durations[frame]} ticks · simulação ${match.frame} ticks\nRaiz (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) · velocidade (${a.vx.toFixed(2)}, ${a.vy.toFixed(2)})\nLimites do desenho [${b.join(", ")}] · pivô (128,224) · ampliação ${zoom}× · 60 Hz · suavização desativada\n${!live() && check("compare") ? "Comparação por fase normalizada: a versão anterior tem contagem e tempos diferentes.\n" : ""}Este laboratório isola a movimentação. Os normais, defesas e agarrões estão no laboratório de combate e nos modos locais. Especiais comuns disponíveis no laboratório de especiais; Fúria Saiyajin: ↓ → ↓ → + L, custa a barra completa.`;
  thumbnails();
}
async function start() {
  await renderer.preparePalette("cyan");
  const response = await fetch("../sprites/goku/movement.json");
  if (!response.ok) throw new Error("Animações de Goku não encontradas");
  manifest = await response.json();
  const external = Object.values(manifest.clips).filter(
    (meta) => meta.externalGeometry,
  );
  if (external.length) {
    const geometryResponse = await fetch(
      "../sprites/goku/walk-transitions.json",
    );
    if (!geometryResponse.ok)
      throw new Error("Transições de caminhada ausentes");
    const geometry = await geometryResponse.json();
    for (const [key, meta] of Object.entries(manifest.clips)) {
      if (meta.externalGeometry) meta.poses = geometry.clips[key].poses;
    }
  }
  const oldResponse = await fetch(
    "../sprites/goku-before-rebuild/movement.json",
  );
  if (!oldResponse.ok)
    throw new Error("Arquivo de comparação anterior ausente");
  previous = await oldResponse.json();
  await Promise.all(
    Object.values(manifest.clips).map(async (meta) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(meta.sheet));
        image.src = `../sprites/goku/${meta.sheet}`;
      });
      images.set(meta.sheet, image);
    }),
  );
  await Promise.all(
    Object.entries(previous.clips).map(async ([key, meta]) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(meta.sheet));
        image.src = `../sprites/goku-before-rebuild/${meta.sheet}`;
      });
      oldImages.set(meta.sheet, image);
    }),
  );
  select("animation").replaceChildren(
    ...Object.entries(manifest.clips)
      .filter(([, meta]) => !meta.internal)
      .map(([key, meta]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = `${meta.label} · ${meta.count} desenhos`;
        return option;
      }),
  );
  select("animation").onchange = () => {
    select("mode").value = "inspect";
    clip = select("animation").value;
    inspector.update(clip, true);
    paused = false;
    keyboard.clear();
    sync();
    draw();
  };
  select("mode").onchange = () => {
    keyboard.clear();
    draw();
  };
  el("pause").onclick = () => {
    paused = !paused;
    keyboard.clear();
    sync();
    draw();
  };
  el("step").onclick = () => {
    if (paused) {
      tick();
      draw();
    }
  };
  el("frame-next").onclick = () => {
    const key = live() ? canvas.dataset.animation! : clip;
    const frame = live() ? Number(canvas.dataset.frame) : inspector.frame();
    seek((frame + 1) % manifest.clips[key].count);
  };
  el("frame-prev").onclick = () => {
    const key = live() ? canvas.dataset.animation! : clip;
    const frame = live() ? Number(canvas.dataset.frame) : inspector.frame();
    seek((frame - 1 + manifest.clips[key].count) % manifest.clips[key].count);
  };
  el("compare").onchange = () => {
    if (live() && check("compare")) {
      clip = canvas.dataset.animation ?? "idle";
      clip = manifest.clips[clip]?.sourceClip ?? clip;
      select("mode").value = "inspect";
      select("animation").value = clip;
      inspector.update(clip, true);
      keyboard.clear();
    }
    draw();
  };
  el("repeat").onchange = draw;
  el("reset").onclick = reset;
  el("flip").onclick = () => {
    facing = -facing;
    if (live()) reset();
    else draw();
  };
  select("zoom").onchange = draw;
  el("boxes").onchange = draw;
  el("guides").onchange = draw;
  el("bounds").onchange = draw;
  el("landmarks").onchange = draw;
  loaded = true;
  reset();
  if (
    ["3", "4"].includes(new URLSearchParams(location.search).get("walk") ?? "")
  ) {
    select("mode").value = "inspect";
    select("animation").value = "walkForward";
    clip = "walkForward";
    inspector.update(clip, true);
    el<HTMLInputElement>("compare").checked = true;
    select("zoom").value = "3";
    draw();
  }
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
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}
void start().catch((e) => (el("error").textContent = String(e)));
