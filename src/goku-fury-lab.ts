import { Match } from "./engine/combat";
import { characters, type CharacterId } from "./engine/characters";
import { neutral, type InputFrame } from "./engine/types";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { Animator, type AnimationData } from "./render/animator";
import animations from "./data/goku-fury-animations.json";
import { furyConfig, furyScene } from "./engine/goku-fury";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const sel = (id: string) => el<HTMLSelectElement>(id),
  check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  ctx = canvas.getContext("2d")!,
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput({ dashOnDirection: true });
const animator = new Animator(animations as AnimationData),
  images = new Map<string, HTMLImageElement>();
type Meta = {
  sheet: string;
  columns: number;
  count: number;
  durations: number[];
  bounds: number[][];
};
let manifest: { clips: Record<string, Meta> },
  match: Match,
  loaded = false,
  paused = false,
  facing = 1,
  t = 0,
  acc = 0,
  clip = "furySuperActivationStart",
  strip = "",
  queue: InputFrame[] = [],
  history: Match["hits"] = [],
  started = false,
  comboStarted = false,
  peak = 0;
const scenarios = {
  hit: "Super confirmada",
  block: "Primeiro soco defendido",
  whiff: "Erro por distância",
  noMeter: "Sem energia",
  ko: "Super causando K.O.",
  interrupt: "Preparação interrompida",
  wall: "Super no canto",
  combo: "Normal → R (confirmação de combo)",
};
const inspecting = () => sel("mode").value === "inspect";
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function command() {
  queue = [{ ...neutral(), pressed: ["ultimate"] }];
}
function reset() {
  const scene = sel("scenario").value;
  match = new Match(
    characters.goku,
    {
      infiniteHealth: [check("infinite"), check("infinite") && scene !== "ko"],
    },
    characters[sel("opponent").value as CharacterId],
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = facing === 1 ? 380 : 900;
  b.x = a.x + facing * 240;
  a.facing = facing;
  b.facing = -facing;
  a.meter = scene === "noMeter" ? 0 : furyConfig.cost;
  if (scene === "block" || scene === "wall") {
    b.x = facing === 1 ? 1240 : 40;
    a.x = b.x - facing * 240;
  }
  if (scene === "whiff") b.x = a.x + facing * 600;
  if (scene === "interrupt" || scene === "combo") b.x = a.x + facing * 70;
  if (scene === "ko") b.health = 100;
  t = acc = peak = 0;
  queue = [];
  history = [];
  started = comboStarted = false;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  paused = false;
  sync();
  draw();
  canvas.focus();
}
function programmed(): [InputFrame, InputFrame] {
  const scene = sel("scenario").value,
    b = neutral();
  if (scene === "block") b.direction = -match.fighters[1].facing as -1 | 1;
  if (scene === "interrupt" && t === 15) b.pressed = ["light"];
  if (!started) {
    started = true;
    if (scene === "combo") {
      comboStarted = true;
      return [{ ...neutral(), pressed: ["light"] }, b];
    }
    command();
  }
  if (comboStarted && match.fighters[0].canSuperCancel()) {
    command();
    comboStarted = false;
  }
  return [queue.shift() ?? neutral(), b];
}
function tick() {
  if (inspecting()) {
    const total = manifest.clips[clip].durations.reduce((s, v) => s + v, 0);
    if (animator.elapsedTicks >= total - 1) {
      if (check("repeat")) animator.seekTick(0);
      else {
        paused = true;
        sync();
      }
    } else animator.update(clip);
    return;
  }
  match.step(
    sel("mode").value === "live"
      ? [keyboard.sample(), neutral()]
      : programmed(),
  );
  history.push(...match.hits);
  peak = Math.max(peak, match.fighters[1].combo);
  renderer.tick(match);
  t++;
  if (check("repeat") && sel("mode").value === "scenario" && t >= 640) reset();
}
function seek(key: string, index: number) {
  if (!manifest.clips[key]) return;
  clip = key;
  sel("mode").value = "inspect";
  sel("animation").value = key;
  animator.update(key, true);
  animator.seekFrame(index);
  paused = true;
  keyboard.clear();
  sync();
  draw();
}
function thumbnails(key: string) {
  if (strip === key) return;
  strip = key;
  const m = manifest.clips[key];
  if (!m) {
    el("strip").replaceChildren();
    el("download").hidden = true;
    return;
  }
  el("strip").replaceChildren(
    ...Array.from({ length: m.count }, (_, i) => {
      const b = document.createElement("button"),
        c = document.createElement("canvas");
      b.setAttribute("aria-label", `Inspecionar ${key} desenho ${i + 1}`);
      c.width = 384;
      c.height = 256;
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.drawImage(
        images.get(m.sheet)!,
        (i % m.columns) * 384,
        Math.floor(i / m.columns) * 256,
        384,
        256,
        0,
        0,
        384,
        256,
      );
      b.append(c);
      b.onclick = () => seek(key, i);
      return b;
    }),
  );
  el("download").hidden = false;
  el<HTMLAnchorElement>("download").href = `../sprites/goku/fury/${m.sheet}`;
}
function draw() {
  if (!loaded) return;
  ctx.imageSmoothingEnabled = false;
  const zoom = Number(sel("zoom").value),
    a = match.fighters[0],
    b = match.fighters[1];
  let key = clip,
    frame = 0,
    time = 0;
  if (inspecting()) {
    const m = manifest.clips[key];
    frame = animator.frame();
    time = animator.elapsedTicks;
    ctx.fillStyle = "#182637";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.translate(640, 610);
    ctx.scale(zoom * facing, zoom);
    ctx.drawImage(
      images.get(m.sheet)!,
      (frame % m.columns) * 384,
      Math.floor(frame / m.columns) * 256,
      384,
      256,
      -192,
      -224,
      384,
      256,
    );
    if (check("bounds")) {
      const r = m.bounds[frame];
      ctx.strokeStyle = "#ffca75";
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(r[0] - 192, r[1] - 224, r[2] - r[0], r[3] - r[1]);
    }
    if (check("guides")) {
      ctx.strokeStyle = "#7acfc9";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(-185, 0);
      ctx.lineTo(185, 0);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 8);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    renderer.inspectionZoom = zoom;
    renderer.inspectionTarget = undefined;
    renderer.debug = check("boxes");
    renderer.draw(match);
    key = canvas.dataset.animation!;
    frame = Number(canvas.dataset.frame);
    time = Number(canvas.dataset.animationTick);
  }
  const m = manifest.clips[key],
    hits = history.filter((h) => h.attacker === 0),
    phase = match.fury
      ? furyScene(match.fury).phase
      : (a.attackPhase ?? a.state);
  Object.assign(canvas.dataset, {
    loaded: "true",
    animation: key,
    frame: String(frame),
    animationTick: String(time),
    facing: String(inspecting() ? facing : a.facing),
    sceneTick: String(t),
    hitCount: String(hits.filter((h) => !h.blocked).length),
    blockedHits: String(hits.filter((h) => h.blocked).length),
    damage: String(hits.reduce((s, h) => s + h.damage, 0)),
    peakCombo: String(peak),
    smoothing: String(ctx.imageSmoothingEnabled),
    mode: sel("mode").value,
  });
  el("readout").textContent =
    `FÚRIA SAIYAJIN / ${phase}\n${key} · desenho ${frame + 1}${m ? "/" + m.count : ""} · tick visual ${time} · simulação ${match.frame}\nEnergia ${a.meter.toFixed(1)}/${a.meterMaximum} · acertos ${canvas.dataset.hitCount} · dano ${canvas.dataset.damage} · bloqueios ${canvas.dataset.blockedHits}\nGoku (${a.x.toFixed(1)},${a.y.toFixed(1)}) · alvo (${b.x.toFixed(1)},${b.y.toFixed(1)}) · câmera ${canvas.dataset.cameraZoom ?? 1}×\nSSJ1 existe somente na Super. Energia é preenchida ao reiniciar este laboratório, sem recarga automática durante a execução.\nR é universal. Em neutro, a preparação pode ser interrompida. Um cancelamento confirmado de normal prolonga o hitstun até o primeiro golpe, que continua usando colisão real.`;
  thumbnails(key);
}
async function start() {
  await renderer.preparePalette("cyan");
  manifest = await (await fetch("../sprites/goku/fury/manifest.json")).json();
  await Promise.all(
    Object.values(manifest.clips).map(async (m) => {
      const i = new Image();
      await new Promise<void>((res, rej) => {
        i.onload = () => res();
        i.onerror = () => rej(Error(m.sheet));
        i.src = "../sprites/goku/fury/" + m.sheet;
      });
      images.set(m.sheet, i);
    }),
  );
  sel("scenario").replaceChildren(
    ...Object.entries(scenarios).map(([k, v]) => new Option(v, k)),
  );
  sel("animation").replaceChildren(
    ...Object.entries(manifest.clips).map(
      ([k, v]) => new Option(`${k} · ${v.count} desenhos`, k),
    ),
  );
  sel("scenario").onchange = sel("opponent").onchange = () => {
    sel("mode").value = "scenario";
    reset();
  };
  sel("mode").onchange = () => {
    keyboard.clear();
    if (!inspecting()) reset();
    else draw();
  };
  el("execute").onclick = () => {
    sel("mode").value = "scenario";
    reset();
  };
  sel("animation").onchange = () => {
    clip = sel("animation").value;
    sel("mode").value = "inspect";
    animator.update(clip, true);
    paused = false;
    sync();
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
  el("flip").onclick = () => {
    facing = -facing;
    if (inspecting()) draw();
    else reset();
  };
  for (const id of ["next", "previous"])
    el(id).onclick = () => {
      const key = inspecting() ? clip : canvas.dataset.animation!,
        m = manifest.clips[key];
      if (m)
        seek(
          key,
          (Number(canvas.dataset.frame) + (id === "next" ? 1 : -1) + m.count) %
            m.count,
        );
    };
  for (const id of ["boxes", "guides", "bounds", "repeat"])
    el(id).onchange = draw;
  el("infinite").onchange = reset;
  sel("zoom").onchange = draw;
  animator.update(clip, true);
  loaded = true;
  reset();
  const loop = new FixedLoop(() => {
    if (!paused && !document.hidden) {
      acc += Number(sel("speed").value);
      while (acc >= 1 && !paused) {
        acc--;
        tick();
      }
    }
  }, draw);
  loop.start();
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}
void start().catch((e) => (el("error").textContent = String(e)));
