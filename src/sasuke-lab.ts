import { characters } from "./engine/characters";
import { FLOOR, Match } from "./engine/combat";
import { isSasukeSpecial, sasukeSpecialLabels } from "./engine/sasuke-specials";
import { sasukeCurseBalance } from "./engine/sasuke-curse";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral, type Button } from "./engine/types";
import { Renderer } from "./render/renderer";

const labels: Record<string, string> = {
  idle: "Guarda neutra",
  forward: "Avanço",
  back: "Recuo",
  dash: "Dash",
  backdash: "Backdash",
  crouch: "Agachar e levantar",
  jump: "Salto e aterrissagem",
  stand_light: "Em pé · soco",
  stand_medium: "Em pé · chute",
  stand_heavy: "Em pé · corte horizontal",
  crouch_light: "Agachado · soco baixo",
  crouch_medium: "Agachado · rasteira",
  crouch_heavy: "Agachado · corte ascendente",
  air_light: "Aéreo · soco",
  air_medium: "Aéreo · chute",
  air_heavy: "Aéreo · corte descendente",
  groundChain: "Combo J → K → L",
  airChain: "Launcher → Jump Cancel → combo aéreo",
  guard: "Defesa em pé",
  guardLow: "Defesa baixa",
  ...sasukeSpecialLabels,
  awakening: "Marca II · transformação",
  "powered:idle": "Marca II · repouso",
  "powered:forward": "Marca II · caminhada",
  "powered:wingBurst": "Marca II · avanço aéreo",
  "powered:revert": "Marca II · recolhimento das asas",
  free: "Modo livre",
};
for (const [id, title] of Object.entries(labels))
  if (id.includes("_") || isSasukeSpecial(id)) labels["powered:" + id] = "Marca II · " + title;
const specialPreviews = {
  senbon: ["forward", "light", 230],
  eiso: ["forward", "medium", 192],
  chidori: ["forward", "heavy", 139],
  gokakyu: ["back", "light", 245],
  hosenka: ["back", "medium", 175],
  goryuka: ["back", "heavy", 132],
  serpents: ["down", "light", 105],
  nagashi: ["down", "medium", 55],
} as const;
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("arena");
const scenario = el<HTMLSelectElement>("scenario");
const speed = el<HTMLSelectElement>("speed");
const mirror = el<HTMLInputElement>("mirror");
const seek = el<HTMLInputElement>("seek");
const play = el<HTMLButtonElement>("play");
const step = el<HTMLButtonElement>("step");
const renderer = new Renderer(canvas);
renderer.contextLabel = "LABORATÓRIO · SASUKE";
const keyboard = new KeyboardInput({ dashOnDirection: true });
let chain = 0;
let match: Match,
  time = 0,
  debt = 0,
  paused = false;

function pause(value: boolean) {
  paused = value;
  play.textContent = paused ? "Reproduzir" : "Pausar";
  step.disabled = !paused;
  keyboard.clear();
}
function draw() {
  renderer.debug = el<HTMLInputElement>("boxes").checked;
  renderer.draw(match);
  seek.value = String(time);
  canvas.dataset.elapsed = String(time);
  canvas.dataset.cursePhase = match.fighters[0].sasukeCurse?.phase ?? "ready";
  canvas.dataset.storm = String(match.sasukeStormUntil > match.combatFrame);
  el<HTMLOutputElement>("status").value =
    `Tick ${time} · ${canvas.dataset.animation} · pose ${canvas.dataset.frame} · ${canvas.dataset.phase}`;
}
function reset(value = false) {
  match = new Match(characters.sasuke, { training: true }, characters.samurai);
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  const side = mirror.checked ? -1 : 1;
  const mode = scenario.value.replace("powered:", "");
  a.x = 610;
  b.x = isSasukeSpecial(mode)
    ? a.x + side * specialPreviews[mode][2]
    : a.x +
      side *
        (mode.startsWith("guard")
          ? 53
          : mode.includes("_") || mode.endsWith("Chain")
            ? 57
            : 400);
  a.facing = side;
  b.facing = -side;
  if (scenario.value.startsWith("powered:")) a.sasukeCurse = {
    phase: "active", remaining: mode === "revert" ? 18 : sasukeCurseBalance.durationTicks,
    airBurstUsed: false, airBurstTick: 0,
  };
  if (mode.startsWith("air_")) {
    a.y = FLOOR - 145;
    b.y = FLOOR - (mode === "air_heavy" ? 112 : 145);
    a.setState("air");
    b.setState("air");
  }
  time = debt = chain = 0;
  seek.disabled = mode === "free";
  renderer.resetAnimations();
  renderer.tick(match);
  pause(value);
  draw();
}
function update() {
  const mode = scenario.value.replace("powered:", "");
  const side = mirror.checked ? -1 : 1;
  const a = mode === "free" ? keyboard.sample() : neutral();
  const b = neutral();
  if (mode === "awakening" && time < 3) {
    a.down = time !== 1;
    if (time === 2) a.pressed.push("heavy");
  }
  if (mode === "wingBurst") {
    a.direction = side;
    if (time === 0) a.pressed.push("jump");
    if (time === 15) a.pressed.push("dash");
  }
  if (isSasukeSpecial(mode) && time < 3) {
    const [motion, button] = specialPreviews[mode];
    a.down = time === 0 || (motion === "down" ? time === 2 : time === 1);
    if (time > 0 && motion !== "down")
      a.direction = (side * (motion === "forward" ? 1 : -1)) as 1 | -1;
    if (time === 2) a.pressed.push(button);
  }
  if (mode === "forward" || mode === "back")
    a.direction =
      time < 41 ? ((mode === "forward" ? side : -side) as 1 | -1) : 0;
  if (mode === "dash" || mode === "backdash") {
    a.direction = time < 4 ? ((mode === "dash" ? side : -side) as 1 | -1) : 0;
    if (time === 0) a.pressed.push("dash");
  }
  if (mode === "crouch") a.down = time < 28;
  if (mode === "jump" && time === 0) a.pressed.push("jump");
  if (mode.includes("_")) {
    a.down = mode.startsWith("crouch_");
    if (time === 0) a.pressed.push(mode.split("_")[1] as Button);
  }
  if (mode === "groundChain" || mode === "airChain") {
    const f = match.fighters[0];
    if (mode === "groundChain") {
      const sequence = ["light", "medium", "heavy"] as const;
      if (
        chain < sequence.length &&
        (!chain ||
          (f.moveId === `stand_${sequence[chain - 1]}` && f.hitConfirmed))
      )
        a.pressed.push(sequence[chain++]);
    } else if (!chain) {
      a.down = true;
      a.pressed.push("heavy");
      chain++;
    } else if (chain === 1 && f.moveId === "crouch_heavy" && f.hitConfirmed) {
      a.pressed.push("jump");
      chain++;
    } else if (chain === 2 && f.state === "air") {
      a.pressed.push("light");
      chain++;
    } else if (chain === 3 && f.moveId === "air_light" && f.hitConfirmed) {
      a.pressed.push("medium");
      chain++;
    } else if (chain === 4 && f.moveId === "air_medium" && f.hitConfirmed) {
      a.pressed.push("heavy");
      chain++;
    }
  }
  if (mode === "guard" || mode === "guardLow") {
    if (time > 0 && time < 23) a.direction = -side as 1 | -1;
    a.down = b.down = mode === "guardLow";
    if (time === 0) b.pressed.push("light");
  }
  const frozen = match.phase === "fight" && match.hitstop > 0;
  match.step([a, b]);
  if (!frozen) renderer.tick(match);
  time++;
  if (mode !== "free" && time >= Number(seek.max)) pause(true);
}
async function start() {
  for (const [value, name] of Object.entries(labels))
    scenario.add(new Option(name, value));
  await renderer.preparePalette("cyan");
  scenario.onchange = mirror.onchange = el("reset").onclick = () => reset();
  play.onclick = () => pause(!paused);
  step.onclick = () => {
    update();
    draw();
  };
  seek.oninput = () => {
    const target = Number(seek.value);
    reset(true);
    while (time < target) update();
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
