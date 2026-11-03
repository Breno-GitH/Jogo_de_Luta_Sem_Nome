import { Match, FLOOR } from "./engine/combat";
import { characters, type CharacterId } from "./engine/characters";
import { neutral, type InputFrame, type Button } from "./engine/types";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { Animator, type AnimationData } from "./render/animator";
import animations from "./data/goku-special-animations.json";
import balance from "./data/goku-specials.json";
import { drawCombatDebug } from "./render/debug";
import { worldRect } from "./engine/geometry";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T,
  sel = (id: string) => el<HTMLSelectElement>(id),
  check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  ctx = canvas.getContext("2d")!,
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput({ dashOnDirection: true }),
  animator = new Animator(animations as AnimationData),
  images = new Map<string, HTMLImageElement>();
type Meta = {
  sheet: string;
  count: number;
  columns: number;
  durations: number[];
  bounds: number[][];
  poses: {
    phase: string;
    hurtboxes: { x: number; y: number; w: number; h: number }[];
  }[];
};
let manifest: { clips: Record<string, Meta> },
  match: Match,
  loaded = false,
  paused = false,
  facing = 1,
  t = 0,
  acc = 0,
  stage = 0,
  clip = "ki_light",
  strip = "",
  queue: InputFrame[] = [],
  history: Match["hits"] = [],
  seenMoves = new Set<string>();
const scenarios: Record<string, string> = Object.fromEntries(
  Object.keys(animations.clips).map((k) => [k, k]),
);
Object.assign(scenarios, {
  lightMediumKi: "J → K → Rajada de Ki",
  mediumHeavyBeam: "K → L → Kamehameha",
  crouchKi: "Crouch Medium → Ki",
  blockKi: "Defesa contra Ki",
  blockBeam: "Defesa contra Kamehameha",
  interrupt: "Interromper preparação",
  wallTeleport: "Teletransporte no canto",
  airTeleportLight: "No ar: ↓ ↓ + J · avanço",
  airTeleportBehind: "No ar: ↓ ↓ + K · atrás do alvo",
  airChaseCombo: "Launcher → J → K → ↓ ↓ + L → J → K → L",
});
const inspecting = () => sel("mode").value === "inspect";
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function reset() {
  const scene = sel("scenario").value;
  match = new Match(
    characters.goku,
    { training: true, infiniteHealth: [check("infinite"), check("infinite")] },
    characters[sel("opponent").value as CharacterId],
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  const close = [
    "lightMediumKi",
    "mediumHeavyBeam",
    "crouchKi",
    "interrupt",
    "airChaseCombo",
  ].includes(scene);
  a.x = facing === 1 ? 350 : 930;
  b.x = a.x + facing * (close ? 70 : 330);
  a.facing = facing;
  b.facing = -facing;
  if (scene.startsWith("block")) {
    b.x = facing === 1 ? 1240 : 40;
    a.x = b.x - facing * 320;
  }
  if (scene === "wallTeleport") {
    a.x = facing === 1 ? 1150 : 130;
    b.x = facing === 1 ? 1210 : 70;
  }
  if (scene === "airTeleportLight" || scene === "airTeleportBehind") {
    a.y = 380;
    a.vy = -1;
    a.setState("air");
    b.y = 380;
    b.vy = -1;
    b.setState("air");
  }
  if (scene === "teleport_air") {
    b.y = 350;
    b.vy = -1;
    b.setState("hitstun");
    b.stun = 90;
    b.combo = 1;
  }
  t = stage = acc = 0;
  queue = [];
  history = [];
  seenMoves.clear();
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  paused = false;
  sync();
  draw();
  canvas.focus();
}
function command(family: string, strength = "light") {
  const f = match.fighters[0],
    pattern =
      family === "ki"
        ? [2, 3, 6]
        : family === "kamehameha"
          ? [2, 1, 4]
          : [2, 5, 2];
  queue = pattern.map((v, i) => ({
    direction: (v === 3 || v === 6
      ? f.facing
      : v === 1 || v === 4
        ? -f.facing
        : 0) as -1 | 0 | 1,
    down: [1, 2, 3].includes(v),
    pressed: i === pattern.length - 1 ? [strength as Button] : [],
  }));
}
function programmed(): [InputFrame, InputFrame] {
  const scene = sel("scenario").value,
    a = match.fighters[0],
    b = match.fighters[1],
    other = neutral();
  if (scene.startsWith("block")) other.direction = -b.facing as -1 | 1;
  if (scene === "interrupt" && t === 12) other.pressed = ["light"];
  if (scene === "airTeleportLight" || scene === "airTeleportBehind") {
    if (stage === 0) {
      command("teleport", scene === "airTeleportLight" ? "light" : "medium");
      stage = 1;
    }
    return [queue.shift() ?? neutral(), other];
  }
  if (scene === "airChaseCombo") {
    if (stage === 0) {
      stage++;
      return [{ ...neutral(), down: true, pressed: ["heavy"] }, other];
    }
    if (stage === 1 && a.canCancel("jump")) {
      stage++;
      return [{ ...neutral(), pressed: ["jump"] }, other];
    }
    if (stage === 2 && a.state === "air") {
      stage++;
      return [{ ...neutral(), pressed: ["light"] }, other];
    }
    if (stage === 3 && a.canCancel("medium")) {
      stage++;
      return [{ ...neutral(), pressed: ["medium"] }, other];
    }
    if (
      stage === 4 &&
      a.hitConfirmed &&
      a.moveId === "air_medium" &&
      match.hitstop === 0
    ) {
      stage++;
      command("teleport", "heavy");
    }
    if (stage === 5 && a.state === "air" && a.gokuAirTeleportsUsed === 1) {
      stage++;
      return [{ ...neutral(), pressed: ["light"] }, other];
    }
    if (stage === 6 && a.canCancel("medium")) {
      stage++;
      return [{ ...neutral(), pressed: ["medium"] }, other];
    }
    if (stage === 7 && a.canCancel("heavy")) {
      stage++;
      return [{ ...neutral(), pressed: ["heavy"] }, other];
    }
    return [queue.shift() ?? neutral(), other];
  }
  if (scene === "teleport_air" && t === 0)
    return [{ ...neutral(), pressed: ["jump"] }, other];
  if (stage === 0 && (scene !== "teleport_air" || t >= 12)) {
    stage = 1;
    if (scene === "lightMediumKi")
      return [{ ...neutral(), pressed: ["light"] }, other];
    if (scene === "mediumHeavyBeam")
      return [{ ...neutral(), pressed: ["medium"] }, other];
    if (scene === "crouchKi")
      return [{ ...neutral(), down: true, pressed: ["medium"] }, other];
    if (scene === "interrupt") command("kamehameha", "heavy");
    else if (scene === "blockKi") command("ki", "medium");
    else if (scene === "blockBeam") command("kamehameha", "heavy");
    else if (scene === "wallTeleport") command("teleport", "medium");
    else if (scene === "teleport_air") command("teleport", "heavy");
    else {
      const [family, strength] = scene.split("_");
      command(family, strength);
    }
  }
  if (
    stage === 1 &&
    scene === "lightMediumKi" &&
    a.moveId === "stand_light" &&
    a.canCancel("medium")
  ) {
    stage = 2;
    return [{ ...neutral(), pressed: ["medium"] }, other];
  }
  if (
    stage === 1 &&
    scene === "mediumHeavyBeam" &&
    a.moveId === "stand_medium" &&
    a.canCancel("heavy")
  ) {
    stage = 2;
    return [{ ...neutral(), pressed: ["heavy"] }, other];
  }
  if (
    ((stage === 2 && ["lightMediumKi", "mediumHeavyBeam"].includes(scene)) ||
      (stage === 1 && scene === "crouchKi")) &&
    a.canSpecialCancel()
  ) {
    command(scene === "mediumHeavyBeam" ? "kamehameha" : "ki");
    stage = 3;
  }
  return [queue.shift() ?? neutral(), other];
}
function tick() {
  if (inspecting()) {
    const m = manifest.clips[clip],
      total = m.durations.reduce((a, b) => a + b, 0);
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
  for (const f of match.fighters) if (f.moveId) seenMoves.add(f.moveId);
  renderer.tick(match);
  t++;
  if (check("repeat") && sel("mode").value === "scenario" && t >= 230) reset();
}
function seek(key: string, index: number) {
  sel("mode").value = "inspect";
  sel("animation").value = clip = key;
  animator.update(key, true);
  animator.seekFrame(index);
  paused = true;
  keyboard.clear();
  sync();
  draw();
}
function thumbnails(key: string) {
  if (strip === key || !manifest.clips[key]) return;
  strip = key;
  const m = manifest.clips[key],
    image = images.get(m.sheet)!;
  el("strip").replaceChildren(
    ...Array.from({ length: m.count }, (_, i) => {
      const b = document.createElement("button");
      b.setAttribute("aria-label", `Quadro ${i + 1}`);
      const c = document.createElement("canvas");
      c.width = 384;
      c.height = 256;
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.drawImage(
        image,
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
  el<HTMLAnchorElement>("download").href =
    `../sprites/goku/specials/${m.sheet}`;
}
function draw() {
  if (!loaded) return;
  ctx.imageSmoothingEnabled = false;
  let key = clip,
    frame = 0,
    time = 0;
  const zoom = Number(sel("zoom").value),
    a = match.fighters[0],
    b = match.fighters[1];
  if (inspecting()) {
    frame = animator.frame();
    time = animator.elapsedTicks;
    const m = manifest.clips[key];
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
    if (check("boxes"))
      drawCombatDebug(
        ctx,
        m.poses[frame].hurtboxes.map((r) => worldRect(r, 0, 0, 1)),
        [],
      );
    if (check("bounds")) {
      const r = m.bounds[frame];
      ctx.strokeStyle = "#ffc276";
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
    ctx.fillStyle = "#ffe2ad";
    ctx.font = "20px system-ui";
    ctx.fillText(
      `${key} · desenho ${frame + 1}/${m.count} · corpo sem efeitos`,
      32,
      42,
    );
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
    selfHits = history.filter((h) => h.attacker === 0);
  Object.assign(canvas.dataset, {
    loaded: "true",
    animation: key,
    frame: String(frame),
    animationTick: String(time),
    phase: inspecting() ? m.poses[frame].phase : (a.attackPhase ?? a.state),
    physicsState: a.state,
    rootX: String(a.x),
    rootY: String(a.y),
    facing: String(inspecting() ? facing : a.facing),
    hitCount: String(selfHits.filter((h) => !h.blocked).length),
    blockedHits: String(selfHits.filter((h) => h.blocked).length),
    damage: String(selfHits.reduce((s, h) => s + h.damage, 0)),
    moves: [...seenMoves].join(","),
    sceneTick: String(t),
    kiProjectiles: String(
      match.kiProjectiles.filter((p) => p.state === "flight").length,
    ),
    beams: String(match.beams.filter((p) => p.state === "active").length),
    teleportLock: String(a.gokuTeleportLock),
    smoothing: String(ctx.imageSmoothingEnabled),
  });
  el("readout").textContent =
    `GOKU ${a.state} · ${key} · ${canvas.dataset.phase}\nDesenho ${frame + 1}${m ? "/" + m.count : ""} · tick ${time} · simulação ${match.frame}\nKi em voo ${canvas.dataset.kiProjectiles} · feixes ${canvas.dataset.beams} · recarga de teletransporte ${a.gokuTeleportLock} ticks\nAcertos ${canvas.dataset.hitCount} · dano ${canvas.dataset.damage} · defesas ${canvas.dataset.blockedHits}\nPosição (${a.x.toFixed(1)},${a.y.toFixed(1)}) · alvo (${b.x.toFixed(1)},${b.y.toFixed(1)}) · pivô (192,224)\nNenhum especial consome Super. O corpo e os efeitos são recursos independentes.`;
  if (m) thumbnails(key);
}
async function start() {
  await renderer.preparePalette("cyan");
  manifest = await (
    await fetch("../sprites/goku/specials/manifest.json")
  ).json();
  await Promise.all(
    Object.values(manifest.clips).map(async (m) => {
      const i = new Image();
      await new Promise<void>((resolve, reject) => {
        i.onload = () => resolve();
        i.onerror = () => reject(Error(m.sheet));
        i.src = "../sprites/goku/specials/" + m.sheet;
      });
      images.set(m.sheet, i);
    }),
  );
  sel("scenario").replaceChildren(
    ...Object.entries(scenarios).map(([k, l]) => new Option(l, k)),
  );
  sel("animation").replaceChildren(
    ...Object.entries(manifest.clips).map(
      ([k, m]) => new Option(`${k} · ${m.count} desenhos`, k),
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
