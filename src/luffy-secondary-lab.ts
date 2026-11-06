import { Match, FLOOR } from "./engine/combat";
import { characters } from "./engine/characters";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral, type InputFrame } from "./engine/types";
import { luffyGrabLimb } from "./engine/luffy-secondary";
import { luffyAttackLimbs } from "./engine/luffy-specials";
import { Renderer } from "./render/renderer";

const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>("arena");
const scenario = element<HTMLSelectElement>("scenario");
const speed = element<HTMLSelectElement>("speed");
const zoom = element<HTMLSelectElement>("zoom");
const boxes = element<HTMLInputElement>("boxes");
const mirror = element<HTMLInputElement>("mirror");
const pause = element<HTMLButtonElement>("pause");
const advance = element<HTMLButtonElement>("step");
const renderer = new Renderer(canvas);
const keyboard = new KeyboardInput({ dashOnDirection: true });

const scenarios = {
  grab: "Agarrão em solo",
  whiff: "Agarrão fora do alcance",
  guardStand: "Defesa em pé",
  guardLow: "Defesa agachada",
  blockHigh: "Impacto alto → recuperar guarda",
  blockLow: "Impacto baixo → recuperar guarda",
  light: "Dano leve",
  medium: "Dano médio",
  heavy: "Dano forte",
  low: "Dano baixo",
  air: "Dano aéreo",
  knockback: "Recuo aéreo",
  launcher: "Lançamento → queda → chão → levantar",
  interrupt: "Especial interrompido",
  entry: "Entrada",
  taunt: "Provocação",
  victory: "Vitória",
  ko: "KO → derrota",
  free: "Combate livre",
} as const;
type Scenario = keyof typeof scenarios;

let match: Match;
let elapsed = 0;
let fraction = 0;
let stopped = false;
let seen = new Set<string>();

function setPaused(value: boolean) {
  stopped = value;
  pause.textContent = stopped ? "Reproduzir" : "Pausar";
  advance.disabled = !stopped;
  keyboard.clear();
}

function reset() {
  const mode = scenario.value as Scenario;
  const actor = structuredClone(characters.luffy);
  if (mode.startsWith("guard") || mode.startsWith("block")) {
    actor.speed = 0;
    actor.locomotion!.backSpeed = 0;
  }
  match = new Match(actor, { training: true }, characters.samurai);
  match.phase = mode === "entry" ? "intro" : "fight";
  match.message = mode === "entry" ? "ROUND 1" : "";
  const [a, b] = match.fighters;
  a.facing = mirror.checked ? -1 : 1;
  b.facing = -a.facing;
  a.x = a.homeX = 640 - a.facing * 32;
  const distance = mode === "whiff" ? 145 : mode === "grab" ? 82 : 64;
  b.x = b.homeX = a.x + a.facing * distance;
  if (mode === "blockHigh") b.y = FLOOR - 22;
  if (mode === "air" || mode === "knockback") a.y = b.y = FLOOR - 150;
  if (mode === "victory") b.health = 1;
  if (mode === "ko") a.health = 1;
  renderer.resetAnimations();
  renderer.tick(match);
  elapsed = fraction = 0;
  seen = new Set<string>();
  setPaused(false);
  draw();
  canvas.focus();
}

function step() {
  const mode = scenario.value as Scenario;
  const [a] = match.fighters;
  const forward = a.facing as 1 | -1;
  const left = -forward as 1 | -1;
  const player: InputFrame = mode === "free" ? keyboard.sample() : neutral();
  const rival = neutral();
  if (mode.startsWith("guard") || (mode.startsWith("block") && elapsed < 13)) {
    player.direction = left;
    player.down = mode.endsWith("Low");
  }
  if (elapsed === 0) {
    if (mode === "grab" || mode === "whiff") player.pressed.push("throw");
    if (mode === "taunt") player.pressed.push("taunt");
    if (mode === "victory") player.pressed.push("light");
    if (["blockHigh", "blockLow", "light", "low", "air", "ko"].includes(mode))
      rival.pressed.push("light");
    if (mode === "medium") rival.pressed.push("medium");
    if (["heavy", "knockback", "launcher"].includes(mode))
      rival.pressed.push("heavy");
    rival.down = ["blockLow", "low", "launcher"].includes(mode);
  }
  if (mode === "interrupt") {
    if (elapsed < 2) player.down = true;
    if (elapsed === 1 || elapsed === 2) player.direction = left;
    if (elapsed === 2) {
      player.pressed.push("heavy");
      rival.pressed.push("light");
    }
  }
  const frozen = match.phase === "fight" && match.hitstop > 0;
  match.step([player, rival]);
  if (!frozen) renderer.tick(match);
  elapsed++;
  if (mode !== "free" && elapsed >= 120) setPaused(true);
}

function draw() {
  if (!match) return;
  renderer.debug = boxes.checked;
  renderer.inspectionZoom = Number(zoom.value);
  renderer.draw(match);
  seen.add(canvas.dataset.animation ?? "");
  const [a, b] = match.fighters;
  const arms = luffyAttackLimbs(a).length + Number(!!luffyGrabLimb(a));
  Object.assign(canvas.dataset, {
    loaded: "true",
    elapsed: String(elapsed),
    luffyArms: String(arms),
    seen: JSON.stringify([...seen]),
  });
  element("readout").textContent =
    `Luffy ${a.state} · ${canvas.dataset.animation} · quadro ${canvas.dataset.frame} · tick ${elapsed}\n` +
    `Vida ${a.health} / ${b.health} · braços procedurais ${arms} · caixas de ataque ${a.attackShapes().length}`;
}

async function start() {
  await renderer.preparePalette("cyan");
  for (const [value, label] of Object.entries(scenarios))
    scenario.add(new Option(label, value));
  scenario.onchange = mirror.onchange = element("repeat").onclick = reset;
  pause.onclick = () => setPaused(!stopped);
  advance.onclick = () => {
    step();
    draw();
  };
  boxes.onchange = zoom.onchange = draw;
  reset();
  const loop = new FixedLoop(() => {
    if (stopped || document.hidden) return;
    fraction += Number(speed.value);
    if (fraction >= 1) {
      fraction--;
      step();
    }
  }, draw);
  loop.start();
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}

void start().catch((error) => {
  element("error").textContent = String(error);
});
