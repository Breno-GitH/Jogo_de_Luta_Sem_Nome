import { Match } from "./engine/combat";
import { characters } from "./engine/characters";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral, type InputFrame } from "./engine/types";
import { roadConfig, roadScene } from "./engine/road-roller";
import { Renderer } from "./render/renderer";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id),
  check = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput();
let match: Match,
  paused = false,
  rate = 0,
  hits = 0,
  damage = 0,
  blocks = 0,
  automation = "",
  stage = 0,
  queue: number[] = [];
let seen = false,
  done = false,
  groundOrigin = 0;
function command() {
  queue = [5];
}
function reset(auto = false) {
  const enemy = select("opponent").value === "dio" ? "dio" : "samurai",
    data = structuredClone(characters[enemy]);
  data.speed = 0;
  if (data.locomotion) data.locomotion.backSpeed = 0;
  match = new Match(characters.dio, {}, data);
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters,
    edge = select("edge").value;
  let sign = check("mirror") ? -1 : 1;
  if (edge !== "center") sign = edge === "left" ? -1 : 1;
  const gap = select("scenario").value === "whiff" ? 430 : 85;
  if (edge === "center") {
    a.x = sign === 1 ? 500 : 780;
    b.x = a.x + gap * sign;
  } else {
    b.x = edge === "left" ? 40 : 1240;
    a.x = b.x - sign * gap;
  }
  a.facing = sign;
  b.facing = -sign;
  a.meter = Number(select("energy").value);
  if (select("scenario").value === "ko") b.health = 250;
  for (const f of match.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  queue = [];
  automation = auto ? select("scenario").value : "";
  stage = hits = blocks = damage = rate = 0;
  seen = done = false;
  paused = false;
  groundOrigin = a.x;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  sync();
  draw();
  if (auto && automation !== "combo") command();
}
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function tick() {
  const a = match.fighters[0],
    b = match.fighters[1];
  let input = keyboard.sample(),
    enemy = neutral();
  if (automation === "combo" && !queue.length && !match.roadRoller) {
    if (stage === 0) {
      input.pressed = ["heavy"];
      stage = 1;
    } else if (stage === 1 && a.connected) {
      command();
      stage = 2;
    }
  }
  if (queue.length) {
    const value = queue.shift()!;
    input = {
      direction: ([3, 6].includes(value) ? a.facing : 0) as -1 | 0 | 1,
      down: [2, 3].includes(value),
      pressed: queue.length ? [] : ["ultimate"],
    };
  }
  if (automation === "block") enemy.direction = -b.facing as -1 | 1;
  match.step([input, enemy]);
  renderer.tick(match);
  if (match.roadRoller) seen = true;
  for (const h of match.hits)
    if (h.attacker === 0) {
      if (h.blocked) blocks++;
      else {
        hits++;
        damage += h.damage;
      }
    }
  if (seen && !match.roadRoller) done = true;
  if (
    !seen &&
    !queue.length &&
    a.state === "idle" &&
    a.stand?.ready &&
    match.frame > 110
  )
    done = true;
}
function draw() {
  if (!match) return;
  renderer.debug = check("boxes");
  renderer.draw(match);
  const [a, b] = match.fighters,
    s = match.roadRoller,
    scene = s ? roadScene(s) : undefined;
  Object.assign(canvas.dataset, {
    loaded: "true",
    done: String(done),
    hits: String(hits),
    damage: String(damage),
    blocks: String(blocks),
    seen: String(seen),
    ownerState: a.state,
    enemyState: b.state,
    standState: a.stand?.s.mode ?? "",
    ownerY: String(a.y),
    standY: String(a.stand?.transform.y ?? 0),
    targetX: String(b.x),
    ownerX: String(a.x),
    originX: String(groundOrigin),
    queue: String(queue.length),
    revision: "5",
  });
  el("readout").textContent =
    `SUPER ${a.moveId || a.state} · ${a.attackPhase ?? "captura"} · energia ${a.meter}/200\nFASE ${scene?.phase ?? "combate normal"} · tick ${s?.tick ?? "—"}/${roadConfig.duration}\nDIO (${a.x.toFixed(1)},${a.y.toFixed(1)}) · ${canvas.dataset.animation} / desenho ${canvas.dataset.frame}\nTHE WORLD (${a.stand?.transform.x},${a.stand?.transform.y}) · ${a.stand?.s.clip} / tick ${a.stand?.s.clipTick}\nROLO (${scene?.object.x ?? "—"},${scene?.object.y.toFixed(1) ?? "—"}) · ${scene?.object.clip ?? "—"}\nCÂMERA ${scene?.camera.scale ?? 1}× · tremor ${scene?.camera.shakeX ?? 0}px · ${hits} impactos · ${damage} dano · ${blocks} bloqueios\nALVO ${b.health}/1000 · ${b.state} · round ${match.round} / ${match.phase}\nTEMPO usos ${match.temporal.s.ledger[0].uses} · cooldown ${match.temporal.s.ledger[0].cooldown} ticks · ativo ${match.temporal.s.remaining}`;
}
async function start() {
  await renderer.preparePalette("cyan");
  reset();
  el("run").onclick = () => {
    reset(true);
    canvas.focus();
  };
  el("execute").onclick = () => {
    automation = "";
    command();
    done = false;
    canvas.focus();
  };
  el("rematch").onclick = () => reset();
  for (const id of ["opponent", "mirror", "edge"])
    el(id).onchange = () => reset();
  el("charge").onclick = () => {
    match.fighters[0].meter = 200;
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
  el("time-history").onclick = () => {
    queue = [];
    automation = "";
    keyboard.clear();
    const a = match.fighters[0];
    if (a.attack("time_stop")) {
      for (let i = 0; i < 260 && (i < 30 || match.temporal.active); i++) tick();
    }
    paused = true;
    sync();
    draw();
  };
  const loop = new FixedLoop(() => {
    if (!paused && !document.hidden) {
      rate += Number(select("speed").value);
      while (rate >= 1) {
        rate--;
        tick();
      }
    }
  }, draw);
  loop.start();
  window.addEventListener("pagehide", () => loop.stop(), { once: true });
}
void start().catch((e) => (el("error").textContent = String(e)));
