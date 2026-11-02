import { Match } from "./engine/combat";
import { characters } from "./engine/characters";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral, type InputFrame, type Button } from "./engine/types";
import { Renderer } from "./render/renderer";

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const checked = (id: string) => el<HTMLInputElement>(id).checked;
const canvas = el<HTMLCanvasElement>("arena"),
  renderer = new Renderer(canvas),
  keyboard = new KeyboardInput();
let match: Match,
  paused = false,
  rate = 0,
  hits = 0,
  blocks = 0,
  damage = 0,
  stage = 0,
  requested = "";
let queue: { value?: number; button?: Button }[] = [];
let automation = "";
function enqueue(id: string) {
  const type = id.startsWith("knives")
    ? "knives"
    : id.startsWith("rush")
      ? "rush"
      : "time";
  const button = (type === "time" ? "heavy" : id.split("_")[1]) as Button;
  const pattern =
    type === "knives" ? [2, 3, 6] : type === "rush" ? [2, 1, 4] : [6, 3, 2];
  queue = pattern.flatMap((value, i) =>
    i === 2 ? [{ value, button }] : [{ value }, { value }],
  );
  requested = id;
}
function reset() {
  const enemy = select("opponent").value === "dio" ? "dio" : "samurai";
  const target = structuredClone(characters[enemy]);
  target.speed = 0;
  if (target.locomotion) target.locomotion.backSpeed = 0;
  match = new Match(
    characters.dio,
    { infiniteHealth: [checked("infinite"), checked("infinite")] },
    target,
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters,
    sign = checked("mirror") ? -1 : 1;
  const gap = Math.max(
    52,
    Math.min(1000, Number(el<HTMLInputElement>("gap").value) || 380),
  );
  a.x = sign === 1 ? 140 : 1140;
  b.x = a.x + gap * sign;
  a.facing = sign;
  b.facing = -sign;
  for (const f of match.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  queue = [];
  automation = "";
  requested = "";
  stage = hits = blocks = damage = rate = 0;
  paused = false;
  keyboard.clear();
  renderer.resetAnimations();
  renderer.tick(match);
  sync();
  draw();
}
function sync() {
  el("pause").textContent = paused ? "Reproduzir" : "Pausar";
  el<HTMLButtonElement>("step").disabled = !paused;
}
function tick() {
  const a = match.fighters[0],
    b = match.fighters[1];
  if (!queue.length && !match.hitstop) {
    if (automation === "normal_rush" && stage === 0 && a.state === "idle") {
      queue = [{ button: "heavy" }];
      stage = 1;
    } else if (automation === "normal_rush" && stage === 1 && a.connected) {
      enqueue("rush_heavy");
      stage = 2;
    } else if (automation === "frozen_knives" && stage === 0) {
      enqueue("knives_light");
      stage = 1;
    } else if (
      automation === "frozen_knives" &&
      stage === 1 &&
      a.state === "idle"
    ) {
      enqueue("time_stop");
      stage = 2;
    } else if (automation === "time_rush" && stage === 0) {
      enqueue("time_stop");
      stage = 1;
    } else if (
      automation === "time_rush" &&
      stage === 1 &&
      match.temporal.active &&
      a.state === "idle"
    ) {
      enqueue("rush_heavy");
      stage = 2;
    }
  }
  let input = keyboard.sample();
  if (queue.length) {
    const next = queue.shift()!;
    input = {
      direction: (next.value === 6 || next.value === 3
        ? a.facing
        : next.value === 4 || next.value === 1
          ? -a.facing
          : 0) as -1 | 0 | 1,
      down: [1, 2, 3].includes(next.value ?? 5),
      pressed: next.button ? [next.button] : [],
    };
  }
  const enemy = neutral(),
    kind = select("dummy").value;
  if (kind === "guard" || kind === "crouchGuard") {
    enemy.direction = -b.facing as -1 | 1;
    enemy.down = kind === "crouchGuard";
  }
  if (kind === "walk") {
    b.data = {
      ...b.data,
      speed: characters[b.data.id as "dio" | "samurai"].speed,
    };
    enemy.direction = b.facing as -1 | 1;
  } else if (b.data.speed !== 0) b.data = { ...b.data, speed: 0 };
  if (kind === "jump" && !b.airborne && ["idle", "walk"].includes(b.state))
    enemy.pressed = ["jump"];
  match.rules.infiniteHealth = [checked("infinite"), checked("infinite")];
  match.step([input, enemy]);
  renderer.tick(match);
  for (const h of match.hits)
    if (h.attacker === 0) {
      if (h.blocked) blocks++;
      else {
        hits++;
        damage += h.damage;
      }
    }
}
function draw() {
  if (!match) return;
  renderer.debug = checked("boxes");
  renderer.inspectionZoom = Number(select("zoom").value);
  renderer.draw(match);
  const [a, b] = match.fighters,
    t = match.temporal,
    s = t.s,
    clock = s.ledger[0];
  Object.assign(canvas.dataset, {
    loaded: "true",
    hits: String(hits),
    blocks: String(blocks),
    damage: String(damage),
    playerState: a.state,
    playerTick: String(a.stateFrame),
    enemyX: String(b.x),
    enemyY: String(b.y),
    enemyTick: String(b.stateFrame),
    enemyStandTick: String(b.stand?.s.clipTick ?? -1),
    enemyStandX: String(b.stand?.transform.x ?? 0),
    ownerStandState: a.stand?.s.mode ?? "",
    ownerStandClip: a.stand?.s.clip ?? "",
    enemy: b.data.id,
    requested,
    stage: String(stage),
    paused: String(paused),
    projectileState: JSON.stringify(
      match.projectiles.map((p) => [p.id, p.x, p.y, p.age]),
    ),
    cooldown2: String(s.ledger[1].cooldown),
    uses2: String(s.ledger[1].uses),
    revision: "4",
  });
  el("readout").textContent =
    `DIO ${a.moveId || a.state} / tick ${a.stateFrame} / ${a.attackPhase ?? "neutro"}\nTHE WORLD ${a.stand?.s.mode} / ${a.stand?.s.clip} / tick ${a.stand?.s.clipTick}\nTEMPO ${t.active ? "PARADO" : "normal"} / ${s.remaining} ticks / dono ${s.owner} / dano ${s.damage}/${t.config.maximumDamage} / acertos ${s.hits}/${t.config.maximumHits}\nRECARGA ${clock.cooldown} ticks (${(clock.cooldown / 60).toFixed(1)}s) / usos na partida ${clock.uses} / próxima recarga ${t.cooldownFor(clock.uses + 1) / 60}s\nALVO ${b.data.name} / ${b.state} / tick ${b.stateFrame} / posição ${b.x.toFixed(1)},${b.y.toFixed(1)}\nPROJÉTEIS ${match.projectiles.length}/6 por jogador / ${hits} acertos / ${blocks} bloqueios / ${damage} dano / round ${match.round} / ${match.phase}\nCOMANDO ENVIADO ${requested || "teclado"} / etapa ${stage}`;
}
async function start() {
  await renderer.preparePalette("cyan");
  reset();
  el("execute").onclick = () => {
    const name = select("scenario").value;
    automation = ["normal_rush", "frozen_knives", "time_rush"].includes(name)
      ? name
      : "";
    stage = 0;
    if (!automation) enqueue(name);
    canvas.focus();
  };
  select("scenario").onchange = () => {
    const name = select("scenario").value;
    el<HTMLInputElement>("gap").value = String(
      name.startsWith("rush") || name === "normal_rush" || name === "time_rush"
        ? 65
        : name === "frozen_knives"
          ? 1000
          : name === "time_stop"
            ? 200
            : 380,
    );
  };
  for (const id of ["opponent", "mirror"]) el(id).onchange = reset;
  el("reset").onclick = reset;
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
  el("cast").onclick = () => {
    automation = "";
    enqueue("time_stop");
    canvas.focus();
  };
  for (const button of ["light", "medium", "heavy"] as const)
    el("normal-" + button).onclick = () => {
      automation = "";
      queue = [{ button }];
      canvas.focus();
    };
  el("fast-cooldown").onclick = () => {
    paused = true;
    automation = "";
    queue = [];
    keyboard.clear();
    for (
      let i = 0;
      i < 60000 &&
      (match.temporal.active || match.temporal.s.ledger[0].cooldown > 0) &&
      match.phase !== "finished";
      i++
    )
      tick();
    sync();
    draw();
  };
  el("round").onclick = () => {
    if (match.phase === "finished") return;
    paused = true;
    automation = "";
    queue = [];
    keyboard.clear();
    match.fighters[1].health = 0;
    tick();
    for (let i = 0; i < 260; i++) {
      if (
        (match.phase as string) === "fight" ||
        (match.phase as string) === "finished"
      )
        break;
      tick();
    }
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
void start().catch((error) => (el("error").textContent = String(error)));
