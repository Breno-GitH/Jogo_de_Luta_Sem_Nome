import { characterById, characters } from "./engine/characters";
import { Match } from "./engine/combat";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral } from "./engine/types";
import { Renderer } from "./render/renderer";

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("arena");
const scenario = el<HTMLSelectElement>("scenario");
const rival = el<HTMLSelectElement>("rival");
const speed = el<HTMLSelectElement>("speed");
const mirror = el<HTMLInputElement>("mirror");
const seek = el<HTMLInputElement>("seek");
const play = el<HTMLButtonElement>("play");
const step = el<HTMLButtonElement>("step");
const keyboard = new KeyboardInput();
const renderer = new Renderer(canvas);
renderer.contextLabel = "LABORATÓRIO · JET GIGANT";
let match: Match,
  elapsed = 0,
  debt = 0,
  paused = false;

function pause(value: boolean) {
  paused = value;
  play.textContent = paused ? "Reproduzir" : "Pausar";
  step.disabled = !paused;
  keyboard.clear();
}
function draw() {
  renderer.debug = el<HTMLInputElement>("debug").checked;
  renderer.draw(match);
  seek.value = String(elapsed);
  canvas.dataset.elapsed = String(elapsed);
  const { jetPhase, jetTick, jetFist, animation } = canvas.dataset;
  const phase = jetPhase === "none" ? animation : jetPhase;
  el<HTMLOutputElement>("status").value =
    `Tick ${elapsed} · ${phase} · cena ${jetTick} · punho ${jetFist}`;
}
function reset(value = false) {
  const mode = scenario.value,
    direction = mirror.checked ? -1 : 1;
  match = new Match(characters.luffy, {}, characterById(rival.value));
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = 640 - direction * (mode === "whiff" ? 255 : 96);
  b.x = 640 + direction * (mode === "whiff" ? 255 : 96);
  a.facing = direction;
  b.facing = -direction;
  if (mode !== "empty") a.meter = a.meterMaximum;
  if (mode === "ko") b.health = 90;
  elapsed = debt = 0;
  seek.disabled = mode === "free";
  renderer.resetAnimations();
  renderer.tick(match);
  pause(value);
  draw();
}
function update() {
  const mode = scenario.value;
  const a = mode === "free" ? keyboard.sample() : neutral();
  const b = neutral();
  if (mode !== "free" && elapsed === 0) a.pressed.push("ultimate");
  if (mode === "guard" && elapsed >= 53 && elapsed < 105)
    b.direction = mirror.checked ? -1 : 1;
  const frozen = match.phase === "fight" && match.hitstop > 0;
  match.step([a, b]);
  if (!frozen) renderer.tick(match);
  elapsed++;
  if (mode !== "free" && elapsed >= Number(seek.max)) pause(true);
}
async function start() {
  await renderer.preparePalette("cyan");
  scenario.onchange =
    rival.onchange =
    mirror.onchange =
    el("reset").onclick =
      () => reset();
  play.onclick = () => pause(!paused);
  step.onclick = () => {
    update();
    draw();
  };
  seek.oninput = () => {
    const at = Number(seek.value);
    reset(true);
    while (elapsed < at) update();
    draw();
  };
  reset();
  canvas.dataset.loaded = "true";
  new FixedLoop(() => {
    if (paused) return;
    debt += Number(speed.value);
    while (debt >= 1) {
      debt--;
      update();
    }
  }, draw).start();
}
void start().catch((error: unknown) => {
  el<HTMLOutputElement>("status").value = String(error);
});
