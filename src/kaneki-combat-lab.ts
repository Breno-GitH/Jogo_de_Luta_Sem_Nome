import { characters, type CharacterId } from "./engine/characters";
import { FLOOR, Match } from "./engine/combat";
import { kanekiNormalIds, captureWindup } from "./engine/kaneki-combat";
import { canResistChain, chainNames, resistanceButton, type ChainButton, type ChainRoute } from "./engine/kaneki-chain";
import { KeyboardInput } from "./engine/input";
import { Sound } from "./audio/sound";
import { kanekiSpecialNames, kanekiTechnique, kanekiTechniques } from "./engine/kaneki-specials";
import { FixedLoop } from "./engine/loop";
import { neutral, type Button } from "./engine/types";
import { Renderer } from "./render/renderer";

const demos = {
  embrace: ["light", "light"], pendulum: ["light", "medium"], centipede: ["light", "heavy"],
  lasso: ["heavy", "light"], spin: ["heavy", "medium"], meteor: ["heavy", "heavy"],
} satisfies Partial<Record<ChainRoute, readonly Button[]>>;
type Stage5Demo = { move: string; gap: number; first?: ChainButton; second?: ChainButton; escape?: true };
const strength = ["light","medium","heavy"] as const;
const variants = [
  ["kaguneGrab_light", 262, ["rinkakuCombo","redSpiral","centipedeDrop"]],
  ["kaguneGrab_medium", 310, ["quickSwing","doubleSwing","redCatapult"]],
  ["kaguneGrab_heavy", 365, ["aerialSnatch","rinkakuCyclone","centipedeMeteor"]],
  ["fourSwords_medium", 119, ["swordsRecall","swordsSide","swordsRise"]],
  ["rinkakuRush_light", 198, ["rushReel","rushQuickThrow","rushShortLift"]],
  ["rinkakuRush_medium", 214, ["rushCrossover","rushSpinThrow","rushAirSet"]],
  ["rinkakuRush_heavy", 246, ["rushDragStrike","rushHeavyThrow","rushSlam"]],
] as const;
const stage5: Record<string, Stage5Demo> = {
  stage5Timeout: { move: "kaguneGrab_heavy", gap: 372 },
  stage5Escape: { move: "kaguneGrab_light", gap: 267, escape: true },
};
for (const [group, [move, gap, routes]] of variants.entries()) {
  for (const [i, id] of routes.entries()) {
    stage5[id] = group < 3
      ? { move, gap, first: strength[group], second: strength[i] }
      : { move, gap, first: strength[i] };
  }
}
const centipedeDemos: Record<string, number> = { superCentipede: 122, superCentipedeGrab: 362, superCentipedeMiss: 355 };
const labels: Record<string, string> = {
  superCentipede: "Centipede · Frenesi da Kakuja (R)",
  superCentipedeGrab: "Centipede · conversão do Kagune Grab L",
  superCentipedeMiss: "Centipede · erro de alcance",
  ...Object.fromEntries(Object.keys(stage5).map(key => [key, chainNames[key as ChainRoute]])),
  stage5Timeout: "Kagune Grab L · limite de 5 segundos",
  stage5Escape: "Kagune Grab J · resistência e escape",
  ...Object.fromEntries(Object.entries(demos).map(([id, buttons]) =>
    [id, `${buttons[0] === "light" ? "J" : "L"} → ${({light:"J",medium:"K",heavy:"L"} as const)[buttons[1]]} · ${chainNames[id as ChainRoute]}`])),
  fourSwords_medium: "Four Swords K · estalo do indicador",
  pull: "Captura → J · puxar",
  throw: "Captura → K · arremessar",
  launch: "Captura → L · lançar",
  fallback: "Captura · tempo esgotado",
  airCatch: "Captura aérea condicionada",
  miss: "Captura fora do alcance",
  free: "Treino livre · especiais, U, R e J/K/L",
  stand_light: "J · soco",
  stand_medium: "K · chute giratório",
  stand_heavy: "L · chicote Rinkaku",
  crouch_light: "S + J · soco baixo",
  crouch_medium: "S + K · rasteira",
  crouch_heavy: "S + L · dois Kagunes",
  air_light: "No ar + J · soco",
  air_medium: "No ar + K · chute diagonal",
  air_heavy: "No ar + L · Kagune diagonal",
};
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>("arena");
const scene = get<HTMLSelectElement>("scenario");
const opponent = get<HTMLSelectElement>("opponent");
const mirror = get<HTMLInputElement>("mirror");
const seek = get<HTMLInputElement>("seek");
const speed = get<HTMLSelectElement>("speed");
const play = get<HTMLButtonElement>("play");
const renderer = new Renderer(canvas);
const sound = new Sound();
const input = new KeyboardInput({
  dashOnDirection: true,
  gamepad: true,
  active: () => scene.value === "free" && playing,
});
let match: Match,
  time = 0,
  debt = 0,
  playing = false;
const end = 560;

function reset() {
  match = new Match(
    characters.kaneki,
    { training: true },
    characters[opponent.value as CharacterId],
  );
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  const side = mirror.checked ? -1 : 1;
  a.x = 620;
  const scripted = stage5[scene.value];
  const technique = kanekiTechnique(scripted?.move ?? scene.value);
  const gap = centipedeDemos[scene.value] ?? scripted?.gap ?? (
    technique
      ? ({ kaguneGrab: 90, fourSwords: 107, rinkakuRush: [198, 214, 246][technique.rank] })[technique.family]
      : scene.value === "miss"
      ? 220
      : scene.value === "free"
        ? 250
        : scene.value.startsWith("air") && scene.value !== "air_light"
          ? 82
          : scene.value.includes("_")
            ? 62
            : 105);
  b.x = a.x + side * gap;
  if (centipedeDemos[scene.value] || scene.value === "free") a.meter = 100;
  a.facing = side;
  b.facing = -side;
  if (scene.value.startsWith("air")) {
    a.y = FLOOR - (scene.value === "air_medium" ? 170 : 115);
    b.y = scene.value === "air_medium" ? FLOOR - 85 : FLOOR - 115;
    a.setState("air");
    b.setState("air");
    if (scene.value === "airCatch") {
      b.setState("hitstun");
      b.stun = 26;
      b.combo = 2;
    }
  }
  renderer.opponentLabel = "ALVO DE TREINO";
  renderer.inspectionZoom = centipedeDemos[scene.value] || scripted || technique?.family === "fourSwords" || Object.hasOwn(demos, scene.value) ? 1 : 1.35;
  renderer.inspectionTarget = 0;
  time = debt = 0;
  input.clear();
  renderer.resetAnimations();
  renderer.tick(match);
}

function step(withAudio = true) {
  const mode = scene.value;
  const frame = mode === "free" ? input.sample() : neutral();
  const scripted = stage5[mode];
  const superDemo = Boolean(centipedeDemos[mode]);
  const technique = kanekiTechnique(mode === "superCentipedeGrab" ? "kaguneGrab_heavy" : scripted?.move ?? mode);
  const demo = demos[mode as keyof typeof demos];
  const chain = match.capture?.kaneki?.chain;
  if (technique && time <= 2) {
    const twice = technique.family === "rinkakuRush";
    const last = twice ? 2 : 1;
    frame.down = time === 0 || twice && time === 2;
    if (time === 1 && !twice)
      frame.direction = (match.fighters[0].facing * (technique.family === "fourSwords" ? -1 : 1)) as -1 | 1;
    if (time === last) frame.pressed = [technique.strength];
  } else if (time === 0 && mode !== "free") {
    if (superDemo) frame.pressed = ["ultimate"];
    else if (mode === "airCatch") frame.pressed = ["heavy"];
    else if (kanekiNormalIds.some((id) => id === mode)) {
      frame.down = mode.startsWith("crouch");
      frame.pressed = [mode.split("_")[1] as Button];
    } else frame.pressed = ["throw"];
  }
  if (
    !superDemo && !scripted && match.capture?.kaneki &&
    match.capture.tick === captureWindup + 8 &&
    !match.hitstop
  ) {
    const button = demo?.[0] ?? (
      mode === "pull" || mode === "airCatch" || technique?.family === "kaguneGrab"
        ? "light"
        : mode === "throw"
          ? "medium"
          : mode === "launch"
            ? "heavy"
            : undefined);
    if (button) frame.pressed.push(button);
  }
  if (demo && chain?.phase === "choice2" && match.capture!.tick - chain.since === 12 && !match.hitstop)
    frame.pressed.push(demo[1]);
  if (!scripted && technique?.family === "kaguneGrab" && chain?.phase === "choice2" &&
      match.capture!.tick - chain.since === 8 && !match.hitstop) frame.pressed.push("medium");
  if (mode === "superCentipedeGrab" && chain?.phase === "choice1" &&
      match.capture!.tick - chain.since === 8 && !match.hitstop) frame.pressed.push("ultimate");
  const defense = neutral();
  if (scripted && chain && match.capture && !match.hitstop) {
    const age = match.capture.tick - chain.since;
    if (chain.phase === "choice1" && age === 8 && scripted.first) frame.pressed.push(scripted.first);
    if (chain.phase === "choice2" && age === 8 && scripted.second) frame.pressed.push(scripted.second);
    if (scripted.escape && canResistChain(chain, match.capture.tick) && time % 16 === 0)
      defense.pressed.push(resistanceButton(chain));
  }
  match.step([frame, defense]);
  renderer.tick(match);
  if (withAudio) sound.tick(match);
  time++;
}
function draw() {
  renderer.debug = get<HTMLInputElement>("boxes").checked;
  renderer.chainKeys = input.activeChainKeys ?? ["J", "K", "L"];
  renderer.draw(match);
  seek.value = String(time);
  canvas.dataset.elapsed = String(time);
  get("status").textContent =
    `Tick ${time} · ${canvas.dataset.animation} · ${canvas.dataset.centipedePhase || canvas.dataset.chainFinish || canvas.dataset.chainPhase || canvas.dataset.captureRoute || "sem captura"}`;
}
function pause(value: boolean) {
  playing = !value;
  play.textContent = playing ? "Pausar" : "Reproduzir";
}
function go(tick: number) {
  reset();
  while (time < tick) step(false);
  draw();
}

async function start() {
  for (const t of kanekiTechniques) labels[t.id] ??= `${kanekiSpecialNames[t.family]} ${"JKL"[t.rank]}`;
  for (const [key, label] of Object.entries(labels))
    scene.add(new Option(label, key));
  for (const [id, fighter] of Object.entries(characters))
    opponent.add(new Option(fighter.name, id));
  await renderer.preparePalette("cyan");
  scene.onchange = () => {
    go(0);
    if (scene.value === "free") {
      pause(false);
      canvas.focus();
    }
  };
  opponent.onchange = mirror.onchange = () => go(0);
  get("boxes").onchange = draw;
  play.onclick = () => pause(playing);
  const audio = get<HTMLButtonElement>("audio");
  audio.onclick = async () => {
    sound.configure(.8, .85, 0, false);
    await sound.unlock();
    audio.textContent = sound.state === "running" ? "Som ativo" : "Áudio indisponível";
    audio.disabled = sound.state === "running";
  };
  get("step").onclick = () => {
    pause(true);
    if (time >= end) reset();
    else step();
    draw();
  };
  seek.oninput = () => {
    pause(true);
    go(Number(seek.value));
  };
  go(0);
  canvas.dataset.loaded = "true";
  new FixedLoop(
    () => {
      if (!playing) return;
      debt += Number(speed.value);
      if (debt < 1) return;
      debt--;
      const replayEnd = centipedeDemos[scene.value] ? end : scene.value === "stage5Timeout" ? 365 : 175;
      if (time >= replayEnd && scene.value !== "free") reset();
      else step();
      draw();
    },
    () => {},
  ).start();
}
void start().catch((error) => {
  get("status").textContent = String(error);
});
