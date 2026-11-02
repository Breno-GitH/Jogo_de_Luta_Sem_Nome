import { Match, FLOOR } from "./engine/combat";
import { characters } from "./engine/characters";
import { snapshot, restore, type MatchState } from "./engine/state";
import { KeyboardInput } from "./engine/input";
import { neutral, type InputFrame } from "./engine/types";
import { FixedLoop } from "./engine/loop";
import { Renderer } from "./render/renderer";
import { Training, type DummyBehavior } from "./game/training";
import { Bot } from "./engine/bot";

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  renderer = new Renderer(canvas, new URL("../sprites/", location.href).href);
const keyboard = new KeyboardInput({ dashOnDirection: true }),
  training = new Training(),
  bot = new Bot("normal");
let match: Match,
  paused = false,
  mode: "live" | "scenario" | "replay" = "live",
  stage = 0,
  ticks = 0,
  rate = 0,
  damage = 0,
  hits = 0,
  maxCombo = 0,
  scenarioName = "",
  done = false;
let history: MatchState[] = [],
  path: { x: number; active: boolean; phase: string }[] = [];
let replayCursor = 0;
function reset(scenario = "") {
  const data = structuredClone(characters.dio),
    selected = select("scenario").value;
  if (data.moves[selected]?.stand)
    data.moves[selected].stand!.front.x = Number(
      el<HTMLInputElement>("reach").value,
    );
  const enemy = select("opponent").value === "dio" ? "dio" : "samurai";
  match = new Match(data, { training: true }, characters[enemy]);
  renderer.opponentLabel =
    enemy === "dio" ? "DIO / THE WORLD / ALVO" : "SAMURAI / ALVO";
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters,
    sign = check("mirror") ? -1 : 1;
  a.x = sign === 1 ? 500 : 780;
  b.x = a.x + sign * Number(el<HTMLInputElement>("gap").value);
  a.facing = sign;
  b.facing = -sign;
  a.stand!.s.x = a.x - 30 * sign;
  a.stand!.s.y = a.y - 18;
  a.stand!.s.facing = sign;
  if (scenario.startsWith("air_") || scenario === "airChain") {
    a.y = b.y = 300;
    a.vy = b.vy = -5;
    b.setState("air");
    a.stand!.s.y = a.y - 18;
  }
  if (b.stand) {
    b.stand.s.x = b.x - 30 * b.facing;
    b.stand.s.y = b.y - 18;
    b.stand.s.facing = b.facing;
  }
  mode = scenario ? "scenario" : "live";
  scenarioName = scenario;
  stage = ticks = damage = hits = maxCombo = rate = 0;
  done = false;
  history = [];
  path = [];
  paused = false;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  syncPause();
  el<HTMLInputElement>("timeline").max = "0";
}
function inputForScenario(): InputFrame {
  const input = neutral(),
    a = match.fighters[0];
  if (match.hitstop) return input;
  const send = (
    button: "light" | "medium" | "heavy" | "jump",
    down = false,
  ) => {
    input.pressed = [button];
    input.down = down;
    stage++;
  };
  const routes: Record<string, string[]> = {
    groundCombo: ["stand_light", "stand_medium", "stand_heavy"],
    crouchCombo: ["crouch_light", "crouch_medium", "crouch_heavy"],
    airChain: ["air_light", "air_medium", "air_heavy"],
    airCombo: ["crouch_heavy", "jump", "air_light", "air_medium", "air_heavy"],
  };
  const route = routes[scenarioName];
  if (route) {
    const next = route[stage];
    if (!next) return input;
    const button =
      next === "jump"
        ? "jump"
        : (next.split("_").at(-1)! as "light" | "medium" | "heavy");
    if (stage === 0 || a.stand!.s.mode === "link" || a.canCancel(button)) {
      if (a.moveId !== "air_medium" || a.hitIds.includes(1))
        send(button, next.startsWith("crouch"));
    }
  } else if (stage === 0) {
    if (["interrupt", "whiff"].includes(scenarioName)) send("heavy");
    else
      send(
        scenarioName.split("_")[1] as "light" | "medium" | "heavy",
        scenarioName.startsWith("crouch_"),
      );
  }
  return input;
}
function tick() {
  if (mode === "replay") {
    if (replayCursor < history.length - 1) {
      match = restore(history[++replayCursor]);
      renderer.tick(match);
      el<HTMLInputElement>("timeline").value = String(replayCursor);
    } else {
      paused = true;
      syncPause();
    }
    return;
  }
  let input = mode === "scenario" ? inputForScenario() : keyboard.sample(),
    enemy = neutral();
  if (mode === "live") {
    training.infiniteHealth = check("infinite");
    training.unlimitedMeter = false;
    training.dummy = select("dummy").value as DummyBehavior;
    training.configure(match);
    enemy = training.input(match, bot);
  } else if (scenarioName === "interrupt" && ticks === 1)
    enemy.pressed = ["light"];
  match.step([input, enemy]);
  renderer.tick(match);
  ticks++;
  for (const hit of match.hits)
    if (hit.attacker === 0 && !hit.blocked) {
      damage += hit.damage;
      hits++;
      maxCombo = Math.max(maxCombo, hit.combo);
    }
  const a = match.fighters[0],
    stand = a.stand!;
  path.push({
    x: (stand.transform.x - a.x) * a.facing,
    active: stand.hitboxes(a).length > 0 && a.attackPhase === "active",
    phase: stand.s.mode,
  });
  if (path.length > 180) path.shift();
  if (mode === "scenario") {
    history.push(snapshot(match));
    el<HTMLInputElement>("timeline").max = String(history.length - 1);
    el<HTMLInputElement>("timeline").value = String(history.length - 1);
    if (
      ticks > 300 ||
      (ticks > 60 &&
        a.state === "idle" &&
        stand.ready &&
        match.fighters[1].state === "idle")
    ) {
      done = true;
      paused = true;
      syncPause();
    }
  }
}
function syncPause() {
  el("pause").textContent =
    done && mode === "scenario"
      ? "Repetir sequência"
      : paused
        ? "Reproduzir"
        : "Pausar";
  el<HTMLButtonElement>("step").disabled =
    !paused || (done && mode === "scenario");
  el<HTMLButtonElement>("next-frame").disabled =
    !paused || (done && mode === "scenario");
}
function draw() {
  if (!match) return;
  renderer.debug = check("boxes");
  renderer.inspectionZoom = Number(select("zoom").value);
  renderer.draw(match);
  const a = match.fighters[0],
    b = match.fighters[1],
    s = a.stand!,
    t = s.transform;
  el("readout").textContent =
    `DIO ${a.moveId || a.state} · tick ${a.stateFrame} · ${a.attackPhase ?? "neutro"} · origem (${a.x.toFixed(1)}, ${a.y.toFixed(1)})\nTHE WORLD ${s.s.mode} · ${s.s.clip} / tick ${s.s.clipTick} · origem (${t.x}, ${t.y}) · relativo (${(t.x - a.x).toFixed(1)}, ${(t.y - a.y).toFixed(1)})\nHitboxes do Stand: ${s.hitboxes(a).length} · janela ${a.hitWindow?.id ?? "—"} · impactos já registrados ${a.hitIds.join(",") || "—"}\nStartup/active/recovery: ${a.move ? [a.move.startup, a.move.active, a.move.recovery].join("/") : "—"} · comandos encadeados ${s.s.chainCount} · retorno ${s.s.returnFrame}/${s.s.returnDuration}\nVida Dio ${a.health} · ${b.data.name} ${b.health}`;
  el("result").textContent =
    `${mode === "replay" ? "REPLAY · " : ""}${hits} acertos · ${damage} dano · maior combo ${maxCombo}${done ? " · SEQUÊNCIA ENCERRADA" : ""}`;
  Object.assign(canvas.dataset, {
    loaded: "true",
    character: a.data.id,
    standMode: s.s.mode,
    standClip: s.s.clip,
    standX: String(t.x),
    standY: String(t.y),
    standBoxes: String(a.attackPhase === "active" ? s.hitboxes(a).length : 0),
    damage: String(damage),
    hits: String(hits),
    maxCombo: String(maxCombo),
    done: String(done),
    mode,
    paused: String(paused),
    stage: String(stage),
    enemy: b.data.id,
    chainCount: String(s.s.chainCount),
    standFrame: canvas.dataset.companionFrame ?? "0",
    hitIds: a.hitIds.join(","),
    hitWindow: String(a.hitWindow?.id ?? -1),
    replayCursor: String(replayCursor),
    revision: "3",
  });
  const plot = el<HTMLCanvasElement>("path"),
    c = plot.getContext("2d")!;
  c.fillStyle = "#15222d";
  c.fillRect(0, 0, 1280, 100);
  c.strokeStyle = "#56727b";
  c.beginPath();
  c.moveTo(0, 77);
  c.lineTo(1280, 77);
  c.stroke();
  for (let i = 1; i < path.length; i++) {
    c.strokeStyle = path[i].active ? "#ff777c" : "#e4c176";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo((i - 1) * 7, 65 - path[i - 1].x * 0.4);
    c.lineTo(i * 7, 65 - path[i].x * 0.4);
    c.stroke();
  }
  c.fillStyle = "#cbd7d9";
  c.font = "12px monospace";
  c.fillText(
    "X relativo do Stand (px) · últimas atualizações → · vermelho = hitbox ativa · linha = posição neutra",
    12,
    15,
  );
}
function syncReach() {
  const move = characters.dio.moves[select("scenario").value];
  el<HTMLInputElement>("reach").disabled = !move?.stand;
  el<HTMLInputElement>("reach").value = String(move?.stand?.front.x ?? 60);
  const presets: Record<string, number> = {
    groundCombo: 65,
    crouchCombo: 65,
    airChain: 65,
    airCombo: 75,
    interrupt: 65,
    whiff: 350,
  };
  const gap = el<HTMLInputElement>("gap");
  gap.disabled = select("scenario").value in presets;
  if (gap.disabled) gap.value = String(presets[select("scenario").value]);
}
async function start() {
  await renderer.preparePalette("cyan");
  renderer.opponentLabel = "SAMURAI / ALVO";
  syncReach();
  reset();
  select("scenario").onchange = syncReach;
  el("run").onclick = () => {
    const name = select("scenario").value;
    if (name === "airCombo") el<HTMLInputElement>("gap").value = "75";
    if (name === "whiff") el<HTMLInputElement>("gap").value = "350";
    if (name === "interrupt") el<HTMLInputElement>("gap").value = "65";
    reset(name);
    canvas.focus();
  };
  el("reset").onclick = () => {
    reset();
    canvas.focus();
  };
  el("live").onclick = () => {
    reset();
    canvas.focus();
  };
  el("pause").onclick = () => {
    if (done && mode === "scenario" && paused) {
      reset(scenarioName);
      return;
    }
    if (mode === "replay" && replayCursor >= history.length - 1) {
      replayCursor = 0;
      match = restore(history[0]);
      renderer.resetAnimations();
      renderer.tick(match);
    }
    paused = !paused;
    keyboard.clear();
    syncPause();
  };
  el("step").onclick = () => {
    if (paused) {
      tick();
      draw();
    }
  };
  el("next-frame").onclick = () => {
    if (!paused) return;
    const attr =
      select("frame-subject").value === "stand" ? "companionFrame" : "frame";
    const initial =
      (attr === "frame" ? canvas.dataset.animation : canvas.dataset.standClip) +
      ":" +
      canvas.dataset[attr];
    for (let i = 0; i < 90; i++) {
      tick();
      draw();
      const next =
        (attr === "frame"
          ? canvas.dataset.animation
          : canvas.dataset.standClip) +
        ":" +
        canvas.dataset[attr];
      if (
        next !== initial ||
        (done && mode === "scenario") ||
        (mode === "replay" && replayCursor >= history.length - 1)
      )
        break;
    }
  };
  el("swap-side").onclick = () => {
    const [a, b] = match.fighters;
    b.x = Math.max(
      40,
      Math.min(
        1240,
        a.x + (b.x > a.x ? -1 : 1) * Number(el<HTMLInputElement>("gap").value),
      ),
    );
    if (b.stand) {
      b.stand.s.x = b.x - 30 * b.facing;
      b.stand.s.y = b.y - 18;
    }
    draw();
  };
  for (const id of ["opponent", "mirror"]) el(id).onchange = () => reset();
  el<HTMLInputElement>("timeline").oninput = () => {
    const state = history[Number(el<HTMLInputElement>("timeline").value)];
    if (!state) return;
    mode = "replay";
    paused = true;
    replayCursor = Number(el<HTMLInputElement>("timeline").value);
    match = restore(state);
    renderer.resetAnimations();
    renderer.tick(match);
    syncPause();
    draw();
  };
  canvas.onclick = () => canvas.focus();
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
