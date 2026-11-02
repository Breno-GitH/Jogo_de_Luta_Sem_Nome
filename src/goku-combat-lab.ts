import { Match, FLOOR } from "./engine/combat";
import { characters, type CharacterId } from "./engine/characters";
import {
  neutral,
  type InputFrame,
  type Button,
  type CombatPose,
} from "./engine/types";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { Animator, type AnimationData } from "./render/animator";
import animations from "./data/goku-combat-animations.json";
import { drawCombatDebug } from "./render/debug";
import { worldRect, worldCapsule } from "./engine/geometry";
type Meta = {
  sheet: string;
  label: string;
  count: number;
  columns: number;
  durations: number[];
  loop: boolean;
  bounds: number[][];
  poses: CombatPose[];
  kind: string;
};
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id),
  check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  ctx = canvas.getContext("2d")!,
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput({ dashOnDirection: true }),
  inspector = new Animator(animations as AnimationData);
const images = new Map<string, HTMLImageElement>();
let manifest: { clips: Record<string, Meta> },
  match: Match,
  loaded = false,
  paused = false,
  accumulator = 0,
  facing = 1,
  sceneTick = 0,
  stage = 0,
  clip = "stand_light",
  inspectedKey = "",
  notice = "",
  history: Match["hits"] = [];
const normals = [
  "stand_light",
  "stand_medium",
  "stand_heavy",
  "crouch_light",
  "crouch_medium",
  "crouch_heavy",
  "air_light",
  "air_medium",
  "air_heavy",
];
const scenarios: Record<string, string> = {
  ...Object.fromEntries(normals.map((k) => [k, k])),
  groundCombo: "Combo J → K → L",
  crouchCombo: "Combo S+J → S+K → S+L",
  airCombo: "Combo aéreo J → K → L",
  launcherCombo: "Launcher → W → J → K → L",
  guardHigh: "Goku defendendo em pé",
  guardLow: "Goku defendendo agachado",
  hitLight: "Goku recebe dano leve",
  hitMedium: "Goku recebe dano médio",
  hitHeavy: "Goku recebe dano forte",
  hitCrouch: "Goku recebe dano agachado",
  hitAir: "Goku recebe dano aéreo",
  launched: "Goku lançado / queda / levantar",
  throw: "Agarrão de Goku",
  grabbed: "Goku sendo agarrado",
  ko: "Nocaute de Goku",
};
const inspecting = () => select("mode").value === "inspect";
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function reset() {
  const enemy = select("opponent").value as CharacterId,
    scene = select("scenario").value;
  match = new Match(
    characters.goku,
    {
      training: true,
      infiniteHealth: [check("infinite") && scene !== "ko", check("infinite")],
    },
    characters[enemy],
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = 600;
  b.x = 600 + facing * 68;
  a.facing = facing;
  b.facing = -facing;
  if (scene.startsWith("guard")) {
    a.x = facing === 1 ? 40 : 1240;
    b.x = a.x + facing * 68;
  }
  if (scene === "ko") a.health = 1;
  notice =
    scene === "grabbed" && !b.data.moves.throw
      ? "O adversário selecionado ainda não possui agarrão. Escolha Samurai ou Goku."
      : "";
  sceneTick = stage = accumulator = 0;
  history = [];
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  paused = false;
  sync();
  draw();
  canvas.focus();
}
function programmed(): [InputFrame, InputFrame] {
  const a = match.fighters[0],
    b = match.fighters[1],
    self = neutral(),
    enemy = neutral(),
    scene = select("scenario").value;
  // The opponents have different jump anticipation/velocity. This scripted
  // air-to-air exercise gives Dio a four-tick head start, rather than changing
  // either fighter's physics or pretending a fist above his head connects.
  const jumpDelay = b.data.id === "dio" ? 4 : 0;
  if (notice) return [self, enemy];
  if (normals.includes(scene)) {
    const [context, button] = scene.split("_");
    if (context === "air") {
      // The descending kick is tested against a slightly lower target.
      const targetJumpDelay =
        scene === "air_heavy" && b.data.id === "goku" ? 3 : 0;
      if (sceneTick === targetJumpDelay) {
        enemy.pressed = ["jump"];
      }
      if (sceneTick === jumpDelay) self.pressed = ["jump"];
      if (sceneTick === 10 + jumpDelay) self.pressed = [button as Button];
    } else {
      self.down = context === "crouch";
      if (sceneTick === 0) self.pressed = [button as Button];
    }
  } else if (
    ["groundCombo", "crouchCombo", "airCombo", "launcherCombo"].includes(scene)
  ) {
    const low = scene === "crouchCombo";
    self.down = low;
    if (scene === "airCombo" && sceneTick === 0) {
      enemy.pressed = ["jump"];
    }
    if (scene === "airCombo" && sceneTick === jumpDelay)
      self.pressed = ["jump"];
    if (stage === 0 && (scene !== "airCombo" || sceneTick >= 10 + jumpDelay)) {
      self.down = low || scene === "launcherCombo";
      self.pressed = [scene === "launcherCombo" ? "heavy" : "light"];
      stage = 1;
    } else if (
      scene === "launcherCombo" &&
      stage === 1 &&
      a.canCancel("jump")
    ) {
      self.pressed = ["jump"];
      stage = 2;
    } else if (scene === "launcherCombo" && stage === 2 && a.state === "air") {
      self.pressed = ["light"];
      stage = 3;
    } else if (
      a.moveId.endsWith("_light") &&
      a.canCancel("medium") &&
      stage === (scene === "launcherCombo" ? 3 : 1)
    ) {
      self.pressed = ["medium"];
      stage++;
    } else if (
      a.moveId.endsWith("_medium") &&
      a.canCancel("heavy") &&
      stage === (scene === "launcherCombo" ? 4 : 2)
    ) {
      self.pressed = ["heavy"];
      stage++;
    }
  } else if (scene === "throw") {
    if (sceneTick === 0) self.pressed = ["throw"];
  } else if (scene === "grabbed") {
    if (sceneTick === 0) enemy.pressed = ["throw"];
  } else {
    if (scene === "guardHigh" || scene === "guardLow") {
      self.direction = -a.facing as -1 | 1;
      self.down = scene === "guardLow";
      if (sceneTick === 8) {
        enemy.down = self.down;
        enemy.pressed = [self.down ? "medium" : "light"];
      }
    } else if (scene === "hitAir") {
      if (sceneTick === 0) {
        self.pressed = ["jump"];
        enemy.pressed = ["jump"];
      }
      if (sceneTick === 10) enemy.pressed = ["light"];
    } else {
      self.down = scene === "hitCrouch";
      if (sceneTick === 8) {
        enemy.down = scene === "launched";
        enemy.pressed = [
          scene === "hitLight"
            ? "light"
            : scene === "hitMedium" || scene === "hitCrouch"
              ? "medium"
              : "heavy",
        ];
      }
    }
  }
  return [self, enemy];
}
function tick() {
  if (inspecting()) {
    const meta = manifest.clips[clip],
      total = meta.durations.reduce((a, b) => a + b, 0);
    if (inspector.elapsedTicks >= total - 1) {
      if (check("repeat")) inspector.seekTick(0);
      else {
        paused = true;
        sync();
      }
      return;
    }
    inspector.update(clip);
    return;
  }
  const inputs =
    select("mode").value === "live"
      ? ([keyboard.sample(), neutral()] as [InputFrame, InputFrame])
      : programmed();
  match.step(inputs);
  history.push(...match.hits);
  renderer.tick(match);
  sceneTick++;
  if (
    select("mode").value === "scenario" &&
    check("repeat") &&
    sceneTick >= 210
  )
    reset();
}
function thumbnails(key: string) {
  if (key === inspectedKey || !manifest.clips[key]) return;
  inspectedKey = key;
  const meta = manifest.clips[key],
    image = images.get(meta.sheet)!;
  el("strip").replaceChildren(
    ...Array.from({ length: meta.count }, (_, i) => {
      const button = document.createElement("button");
      button.setAttribute("aria-label", `Quadro ${i + 1}`);
      const c = document.createElement("canvas");
      c.width = 384;
      c.height = 256;
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.drawImage(
        image,
        (i % meta.columns) * 384,
        Math.floor(i / meta.columns) * 256,
        384,
        256,
        0,
        0,
        384,
        256,
      );
      button.append(c);
      button.onclick = () => seek(key, i);
      return button;
    }),
  );
  el<HTMLAnchorElement>("download").href =
    `../sprites/goku/combat/${meta.sheet}`;
}
function seek(key: string, frame: number) {
  if (!manifest.clips[key]) return;
  select("mode").value = "inspect";
  select("animation").value = clip = key;
  inspector.update(clip, true);
  inspector.seekFrame(frame);
  paused = true;
  keyboard.clear();
  sync();
  draw();
}
function draw() {
  if (!loaded || !match) return;
  const zoom = Number(select("zoom").value),
    a = match.fighters[0],
    b = match.fighters[1];
  ctx.imageSmoothingEnabled = false;
  let key = clip,
    frame = 0,
    time = 0;
  if (!inspecting()) {
    renderer.inspectionTarget = 0;
    renderer.inspectionZoom = zoom;
    renderer.debug = check("boxes");
    renderer.draw(match);
    key = canvas.dataset.animation ?? "idle";
    frame = Number(canvas.dataset.frame);
    time = Number(canvas.dataset.animationTick);
    if (check("guides")) {
      const cy = Math.round(Math.min(FLOOR, a.y - 185 + 480 / zoom)),
        y = FLOOR + (a.y - cy) * zoom;
      ctx.strokeStyle = "#7acfc9";
      ctx.beginPath();
      ctx.moveTo(632, y);
      ctx.lineTo(648, y);
      ctx.moveTo(640, y - 8);
      ctx.lineTo(640, y + 8);
      ctx.stroke();
    }
  } else {
    frame = inspector.frame();
    time = inspector.elapsedTicks;
    const meta = manifest.clips[key];
    ctx.fillStyle = "#182637";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.translate(640, 610);
    ctx.scale(zoom * facing, zoom);
    ctx.drawImage(
      images.get(meta.sheet)!,
      (frame % meta.columns) * 384,
      Math.floor(frame / meta.columns) * 256,
      384,
      256,
      -192,
      -224,
      384,
      256,
    );
    const pose = meta.poses[frame];
    if (check("boxes"))
      drawCombatDebug(
        ctx,
        pose.hurtboxes.map((r) => worldRect(r, 0, 0, 1)),
        (pose.hitboxes ?? []).map((s) =>
          "a" in s ? worldCapsule(s, 0, 0, 1) : worldRect(s, 0, 0, 1),
        ),
      );
    if (check("bounds")) {
      const r = meta.bounds[frame];
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
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#ffe2b4";
    ctx.font = "21px system-ui";
    ctx.fillText(`${key} / desenho ${frame + 1} de ${meta.count}`, 32, 46);
  }
  const meta = manifest.clips[key],
    phase = inspecting() ? meta.poses[frame].phase : (a.attackPhase ?? a.state);
  Object.assign(canvas.dataset, {
    loaded: "true",
    mode: select("mode").value,
    animation: key,
    frame: String(frame),
    animationTick: String(time),
    physicsState: a.state,
    targetState: b.state,
    phase,
    playerHealth: String(a.health),
    targetHealth: String(b.health),
    damage: String(
      history
        .filter((h) => h.attacker === 0 && !h.blocked)
        .reduce((s, h) => s + h.damage, 0),
    ),
    hitCount: String(
      history.filter((h) => h.attacker === 0 && !h.blocked).length,
    ),
    blockedHits: String(history.filter((h) => h.blocked).length),
    moves: history
      .filter((h) => h.attacker === 0)
      .map((h) => h.move)
      .join(","),
    capture: match.capture?.kind ?? "none",
    facing: String(facing),
    rootX: String(a.x),
    rootY: String(a.y),
    targetX: String(b.x),
    targetY: String(b.y),
    smoothing: String(ctx.imageSmoothingEnabled),
    sceneTick: String(sceneTick),
  });
  el("readout").textContent =
    `GOKU ${a.state} / adversário ${b.state} · ${key} · ${phase}\nDesenho ${frame + 1}${meta ? "/" + meta.count : ""} · tick ${time}${meta ? "/" + meta.durations.reduce((s, t) => s + t, 0) : ""} · simulação ${match.frame}\nRaiz (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) · alvo (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) · pivô de combate (192,224) · ampliação ${zoom}×\nAcertos ${canvas.dataset.hitCount} · dano ${canvas.dataset.damage} · defesas ${canvas.dataset.blockedHits}\n${notice || "Verde: hurtboxes · vermelho: hitboxes · a física continua independente do número de desenhos."}`;
  if (meta) thumbnails(key);
}
async function start() {
  await renderer.preparePalette("cyan");
  const r = await fetch("../sprites/goku/combat/manifest.json");
  if (!r.ok) throw Error("Pacote de combate ausente");
  manifest = await r.json();
  await Promise.all(
    Object.values(manifest.clips).map(async (m) => {
      const im = new Image();
      await new Promise<void>((resolve, reject) => {
        im.onload = () => resolve();
        im.onerror = () => reject(Error(m.sheet));
        im.src = `../sprites/goku/combat/${m.sheet}`;
      });
      images.set(m.sheet, im);
    }),
  );
  select("scenario").replaceChildren(
    ...Object.entries(scenarios).map(([key, label]) => new Option(label, key)),
  );
  select("animation").replaceChildren(
    ...Object.entries(manifest.clips).map(
      ([key, m]) => new Option(`${m.label} · ${m.count} desenhos`, key),
    ),
  );
  select("animation").onchange = () => {
    clip = select("animation").value;
    select("mode").value = "inspect";
    inspector.update(clip, true);
    paused = false;
    keyboard.clear();
    sync();
    draw();
  };
  select("mode").onchange = () => {
    keyboard.clear();
    if (!inspecting()) reset();
    else draw();
  };
  for (const id of ["scenario", "opponent"])
    select(id).onchange = () => {
      select("mode").value = "scenario";
      reset();
    };
  el("execute").onclick = () => {
    select("mode").value = "scenario";
    reset();
  };
  el("flip").onclick = () => {
    facing = -facing;
    if (inspecting()) draw();
    else reset();
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
  el("next").onclick = () => {
    const key = inspecting() ? clip : canvas.dataset.animation!;
    if (manifest.clips[key])
      seek(key, (Number(canvas.dataset.frame) + 1) % manifest.clips[key].count);
  };
  el("previous").onclick = () => {
    const key = inspecting() ? clip : canvas.dataset.animation!;
    if (manifest.clips[key])
      seek(
        key,
        (Number(canvas.dataset.frame) - 1 + manifest.clips[key].count) %
          manifest.clips[key].count,
      );
  };
  for (const id of ["boxes", "guides", "bounds", "repeat"])
    el(id).onchange = draw;
  el("infinite").onchange = () => {
    if (!inspecting()) reset();
  };
  select("zoom").onchange = draw;
  loaded = true;
  inspector.update(clip, true);
  reset();
  const loop = new FixedLoop(() => {
    if (!paused && !document.hidden) {
      accumulator += Number(select("speed").value);
      while (accumulator >= 1 && !paused) {
        accumulator--;
        tick();
      }
    }
  }, draw);
  loop.start();
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}
void start().catch((e) => (el("error").textContent = String(e)));
