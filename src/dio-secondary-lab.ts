import { Match, FLOOR } from "./engine/combat";
import { characters } from "./engine/characters";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral } from "./engine/types";
import { Renderer } from "./render/renderer";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const canvas = el<HTMLCanvasElement>("arena"),
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput();
const scenarios: Record<string, string> = {
  free: "Combate livre / R e T",
  entrance: "Entrada e manifestação",
  guardStand: "Defesa em pé",
  guardCrouch: "Defesa agachada",
  guardImpactStand: "Impacto alto",
  guardImpactCrouch: "Impacto baixo",
  damageLight: "Dano leve",
  damageMedium: "Dano médio",
  damageHeavy: "Dano forte",
  damageCrouch: "Dano agachado",
  damageAir: "Dano aéreo",
  launched: "Lançado / queda / chão / levantar",
  falling: "Queda",
  downed: "Derrubado / levantar",
  getup: "Levantando",
  grabbed: "Agarrado / reaparecer",
  ko: "Nocaute / dissipar",
  defeat: "Derrota",
  taunt: "Provocação",
  victory: "Vitória dos dois",
  interrupt: "Interromper ataque do Stand com colisão real",
};
let match: Match,
  paused = false,
  rate = 0,
  elapsed = 0,
  seen: string[] = [];
function reset() {
  const scenario = select("scenario").value,
    mirror = el<HTMLInputElement>("mirror").checked;
  const data = structuredClone(characters.dio),
    enemy = structuredClone(characters.samurai);
  if (scenario !== "free") {
    data.speed = 0;
    data.locomotion!.backSpeed = 0;
  }
  match = new Match(data, { training: true }, enemy);
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = mirror ? 725 : 555;
  b.x = a.x + (mirror ? -80 : 80);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  a.meter = 200;
  for (const f of match.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  if (scenario === "entrance") {
    a.homeX = a.x;
    b.homeX = b.x;
    match.phase = "intro";
    match.phaseFrames = 100;
    match.message = "ENTRADA";
  } else if (scenario === "taunt")
    a.tick({ ...neutral(), pressed: ["taunt"] }, 0, b);
  else if (["victory", "defeat", "ko"].includes(scenario)) {
    a.setState(scenario as "victory" | "defeat" | "ko");
    if (scenario !== "victory") a.health = 0;
    match.phase = "roundEnd";
    match.phaseFrames = 150;
  } else if (scenario === "grabbed") {
    a.setState("grabbed");
    a.stun = 45;
  } else if (scenario === "getup") {
    a.knockedDown = true;
    a.setState("getup");
  } else if (scenario.startsWith("guardImpact")) {
    a.blockCrouched = scenario.endsWith("Crouch");
    a.setState("blockstun");
    a.stun = 30;
  } else if (
    scenario.startsWith("damage") ||
    ["launched", "falling", "downed"].includes(scenario)
  ) {
    a.hitCrouched = scenario === "damageCrouch";
    a.reactionStrength =
      scenario === "damageLight" ? 1 : scenario === "damageMedium" ? 2 : 3;
    a.setState("hitstun");
    a.stun = 40;
    if (["damageAir", "launched", "falling"].includes(scenario)) {
      a.y = FLOOR - 100;
      a.vy = scenario === "launched" ? -13 : scenario === "falling" ? 5 : 0;
      a.hitLaunch = scenario !== "damageAir";
      a.knockedDown = scenario !== "damageAir";
    }
    if (scenario === "downed") {
      a.knockedDown = true;
      a.stun = 25;
    }
    a.syncReactionClock(false);
  } else if (scenario === "interrupt") {
    a.attack("stand_heavy");
    b.attack("stand_light");
  }
  if (a.stand && scenario !== "interrupt") {
    a.stand.s.x = a.x - a.facing * 30;
    a.stand.s.y = a.y - 18;
  }
  elapsed = rate = 0;
  seen = [];
  paused = false;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  sync();
  draw();
  canvas.focus();
}
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function tick() {
  const a = match.fighters[0],
    scenario = select("scenario").value;
  let input = keyboard.sample();
  if (scenario === "guardStand" || scenario === "guardCrouch")
    input = {
      ...neutral(),
      direction: -a.facing as -1 | 1,
      down: scenario === "guardCrouch",
    };
  if (scenario === "grabbed" && elapsed === 45) {
    a.setState("idle");
    a.stand?.tick(a);
  }
  match.step([input, neutral()]);
  renderer.tick(match);
  elapsed++;
  const clip = a.stand?.s.clip ?? "";
  if (!seen.includes(clip)) seen.push(clip);
  if (
    ["ko", "defeat", "victory"].includes(scenario) &&
    match.phaseFrames === 1
  ) {
    paused = true;
    sync();
  }
}
function draw() {
  if (!match) return;
  renderer.debug = el<HTMLInputElement>("boxes").checked;
  renderer.inspectionZoom = Number(select("zoom").value);
  renderer.draw(match);
  const a = match.fighters[0],
    s = a.stand?.s;
  Object.assign(canvas.dataset, {
    loaded: "true",
    elapsed: String(elapsed),
    standClip: s?.clip ?? "",
    standMode: s?.mode ?? "",
    standReaction: s?.reaction?.phase ?? "",
    standBoxes: String(a.stand?.hitboxes(a).length ?? 0),
    seen: JSON.stringify(seen),
    ownerX: String(a.x),
    standX: String(s?.x),
    standFacing: String(s?.facing),
    matchPhase: match.phase,
  });
  el("readout").textContent =
    `DIO ${a.state} / tick ${a.stateFrame} / ${canvas.dataset.animation} / desenho ${canvas.dataset.frame}\nTHE WORLD ${s?.mode} / ${s?.clip} / tick ${s?.clipTick} / reação ${s?.reaction?.phase ?? "—"}\nDIO (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) · STAND (${s?.x.toFixed(1)}, ${s?.y.toFixed(1)}) · camada ${s?.depth}\nHurtboxes ${a.hurtboxes().length} · hitboxes do Stand ${a.stand?.hitboxes(a).length ?? 0} · vida apenas de Dio ${a.health}/1000\nPartida ${match.phase} · ensaio ${elapsed} ticks · R = Road Roller / duas barras`;
}
async function start() {
  await renderer.preparePalette("cyan");
  select("scenario").replaceChildren(
    ...Object.entries(scenarios).map(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      return option;
    }),
  );
  select("scenario").onchange = reset;
  el("run").onclick = reset;
  el("mirror").onchange = reset;
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
  el("boxes").onchange = draw;
  select("zoom").onchange = draw;
  reset();
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
