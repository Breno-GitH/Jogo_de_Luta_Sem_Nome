import { assetBase } from "./asset-base";
import { characters } from "./engine/characters";
import { Match, FLOOR } from "./engine/combat";
import { luffyLimb, luffyMoves, luffyNormals } from "./engine/luffy-normals";
import {
  luffyAttackLimbs,
  luffySpecialFrame,
  luffySpecialMoves,
} from "./engine/luffy-specials";
import { paintLuffyTrails, luffyBurst } from "./render/luffy-special-fx";
import previousReach from "./data/luffy-previous-reach.json";
import { neutral } from "./engine/types";
import { Animator } from "./render/animator";
import { luffyAnimations } from "./render/luffy-animations";
import { paintElastic } from "./render/elastic";
import { drawCombatDebug } from "./render/debug";

const list = document.querySelector<HTMLSelectElement>("#normal")!;
const tickInput = document.querySelector<HTMLInputElement>("#normal-tick")!;
const boxes = document.querySelector<HTMLInputElement>("#normal-boxes")!;
const mirror = document.querySelector<HTMLInputElement>("#normal-mirror")!;
const play = document.querySelector<HTMLButtonElement>("#normal-play")!;
const preview = document.querySelector<HTMLCanvasElement>("#normal-preview")!;
const impactButton =
  document.querySelector<HTMLButtonElement>("#normal-impact")!;
const gallery = document.querySelector("#normal-gallery")!;
const readout = document.querySelector("#normal-readout")!;
const image = new Image();
const specialImage = new Image();
const base = new Image();
const rivalImage = new Image();
const stages = document.querySelector("#elastic-stages")!;
const oldReach: Record<string, number> = previousReach;
const reach = (id: string) =>
  Math.max(...luffyNormals[id].track.map(([x]) => x));
const fighter = new Match(characters.luffy).fighters[0];
const animator = new Animator(luffyAnimations);
fighter.x = 600;
fighter.y = FLOOR;

function draw(
  canvas: HTMLCanvasElement,
  id: string,
  tick: number,
  facing: number,
  debug = false,
  target?: {
    distance: number;
    height?: number;
    contact?: { x: number; y: number };
  },
) {
  fighter.setState("idle");
  fighter.y = id.startsWith("air_") ? FLOOR - 230 : FLOOR;
  if (tick >= 0) {
    fighter.attack(id);
    fighter.stateFrame = tick;
  }
  fighter.facing = facing;
  const limb = luffyLimb(fighter);
  const special = luffySpecialFrame(fighter);
  const frame = special ?? limb?.frame;
  animator.update(frame === undefined ? "base" : id);
  if (frame !== undefined) animator.seekFrame(frame);
  const sprite = animator.sprite();
  const ctx = canvas.getContext("2d")!;
  const x = facing === 1 ? 80 : canvas.width - 80;
  const y = id === "crouch_heavy" ? 196 : 174;
  const floor = Math.min(canvas.height - 20, y + FLOOR - fighter.y);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#202d39";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#4f7e7a";
  ctx.fillRect(0, floor, canvas.width, 1);
  ctx.font = "9px monospace";
  for (let i = 0; i <= (special === undefined ? 350 : 500); i += 50) {
    const mark = x + i * facing;
    ctx.fillRect(mark, floor, 1, 4);
    ctx.fillText(String(i), mark - 7, floor + 14);
  }
  if (oldReach[id] !== undefined) {
    ctx.fillStyle = "#eab263";
    ctx.fillRect(x + oldReach[id] * facing, floor - 8, 2, 8);
    ctx.fillStyle = "#74d8ce";
    ctx.fillRect(x + reach(id) * facing, floor - 8, 2, 8);
  }
  if (target) {
    ctx.save();
    ctx.translate(x + target.distance * facing, y + (target.height ?? 0));
    ctx.scale(-facing, 1);
    ctx.drawImage(rivalImage, -128, -224);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const arms = luffyAttackLimbs(fighter);
  if (fighter.move) paintLuffyTrails(ctx, arms, tick, fighter.move);
  for (const arm of arms) if (arm.rear) paintElastic(ctx, arm, arm);
  ctx.drawImage(
    special !== undefined ? specialImage : limb ? image : base,
    sprite.x,
    sprite.y,
    256,
    256,
    -128,
    -224,
    256,
    256,
  );
  for (const arm of arms) if (!arm.rear) paintElastic(ctx, arm, arm);
  ctx.restore();
  if (target?.contact) {
    luffyBurst(
      ctx,
      { x: x + target.contact.x * facing, y: y + target.contact.y },
      0,
      facing,
      0.82,
      ["#dd5542", "#ffba67", "#fff4cd"],
      limb?.foot ? "kick" : "punch",
    );
  }
  if (debug) {
    ctx.save();
    ctx.translate(x - fighter.x, y - fighter.y);
    drawCombatDebug(ctx, fighter.hurtboxes(), fighter.attackShapes());
    ctx.restore();
  }
  return frame;
}

function peak(id: string) {
  const move = luffyMoves[id];
  const spec = luffyNormals[id];
  return move.startup + move.active - spec.holds[spec.active[1] - 1];
}

function addStage(
  label: string,
  id: string,
  tick: number,
  target?: {
    distance: number;
    height?: number;
    contact?: { x: number; y: number };
  },
) {
  const panel = document.createElement("figure");
  const canvas = document.createElement("canvas");
  const caption = document.createElement("figcaption");
  canvas.width = 520;
  canvas.height = id.startsWith("air_") || id === "crouch_heavy" ? 285 : 195;
  caption.textContent = label;
  panel.append(canvas, caption);
  stages.append(panel);
  draw(canvas, id, tick, 1, false, target);
}

function addDemonstration(id: string, label: string) {
  const move = luffyMoves[id];
  const match = new Match(
    characters.luffy,
    { training: true },
    characters.samurai,
  );
  const [attacker, target] = match.fighters;
  const distance = reach(id) + 8;
  match.phase = "fight";
  attacker.x = 420;
  target.x = attacker.x + distance;
  attacker.attack(id);
  addStage(label + " · extensão parcial", id, move.startup + 1);
  addStage(label + " · extensão máxima", id, peak(id));
  for (let i = 0; i <= move.startup + move.active; i++) {
    match.step([neutral(), neutral()]);
    if (target.health < target.data.health) {
      addStage(
        label + " · contato confirmado no motor",
        id,
        attacker.stateFrame,
        { distance, contact: { x: distance, y: -86 } },
      );
      break;
    }
  }
  addStage(label + " · recolhimento", id, move.startup + move.active + 2);
}

/** Stage the rival at the leading foot or fist, then let Match resolve it. */
function contactSample(id: string) {
  const match = new Match(
    characters.luffy,
    { training: true },
    characters.samurai,
  );
  match.phase = "fight";
  const [a, b] = match.fighters;
  a.x = 480;
  a.y = id.startsWith("air_") ? FLOOR - 230 : FLOOR;
  a.attack(id);
  const move = a.move!;
  const hitTick = luffyNormals[id]
    ? peak(id)
    : move.startup +
      (move.special === "pistol" ? 5 : move.special === "gatling" ? 4 : 3);
  a.stateFrame = hitTick;
  const limb = luffyAttackLimbs(a).filter((l) => l.hitboxes.length)[0];
  if (!limb) return;
  b.x = a.x + Math.max(53, limb.terminal.b.x + 4);
  b.y = Math.min(FLOOR, a.y + limb.terminal.b.y + 79);
  if (b.y < FLOOR) b.setState("air");
  a.stateFrame--;
  match.step([neutral(), neutral()]);
  const event = match.events.find((e) => !e.blocked && e.kind === "hit");
  if (!event || !match.hits.some((h) => h.move === id && h.damage > 0)) return;
  return {
    tick: a.stateFrame,
    target: {
      distance: (b.x - a.x) * a.facing,
      height: b.y - a.y,
      contact: { x: (event.x - a.x) * a.facing, y: event.y - a.y },
    },
  };
}

let running = false;
let last = 0;
let showingContact = false;
function refresh() {
  const id = list.value;
  const tick = Number(tickInput.value);
  const sample = showingContact ? contactSample(id) : undefined;
  const height = id.startsWith("air_")
    ? sample
      ? 425
      : 285
    : id === "crouch_heavy"
      ? 285
      : 195;
  if (preview.height !== height) preview.height = height;
  const frame = draw(
    preview,
    id,
    sample?.tick ?? tick,
    mirror.checked ? -1 : 1,
    boxes.checked,
    sample?.target,
  );
  preview.dataset.contact = String(Boolean(sample));
  preview.dataset.move = id;
  readout.textContent =
    (sample
      ? "Contato confirmado · "
      : showingContact
        ? "Sem contato · "
        : "") +
    `Tick ${sample?.tick ?? tick} · pose ${(frame ?? 0) + 1} · ${fighter.attackPhase}` +
    (oldReach[id] === undefined ? "" : ` · ${oldReach[id]} → ${reach(id)} px`);
}
function configure() {
  showingContact = false;
  const m = luffyMoves[list.value] ?? luffySpecialMoves[list.value];
  tickInput.max = String(m.startup + m.active + m.recovery - 1);
  tickInput.value = "0";
  refresh();
}
image.src = `${assetBase}sprites/luffy/normals.png`;
specialImage.src = `${assetBase}sprites/luffy/specials.png`;
base.src = `${assetBase}sprites/luffy/base-polished.png`;
rivalImage.src = `${assetBase}sprites/samurai/base.png`;
Promise.all([
  image.decode(),
  specialImage.decode(),
  base.decode(),
  rivalImage.decode(),
]).then(() => {
  for (const id of Object.keys(luffyMoves)) {
    const label = id
      .replace("stand", "Em pé")
      .replace("crouch", "Agachado")
      .replace("air", "Aéreo")
      .replace("_light", " · J")
      .replace("_medium", " · K")
      .replace("_heavy", " · L");
    list.add(new Option(label, id));
    const panel = document.createElement("figure");
    const canvas = document.createElement("canvas");
    const name = document.createElement("figcaption");
    canvas.width = 460;
    canvas.height = id.startsWith("air_") || id === "crouch_heavy" ? 285 : 195;
    name.textContent = label;
    panel.append(canvas, name);
    gallery.append(panel);
    draw(canvas, id, peak(id), 1);
  }
  const specialGallery = document.querySelector("#special-gallery")!;
  for (const [id, move] of Object.entries(luffySpecialMoves)) {
    const label = id
      .replace("_light", " · J")
      .replace("_medium", " · K")
      .replace("_heavy", " · L");
    list.add(new Option(label, id));
    const panel = document.createElement("figure");
    const canvas = document.createElement("canvas");
    const caption = document.createElement("figcaption");
    canvas.width = 630;
    canvas.height = id.startsWith("air_") || id === "crouch_heavy" ? 285 : 195;
    caption.textContent = label;
    panel.append(canvas, caption);
    specialGallery.append(panel);
    draw(canvas, id, move.startup + (move.special === "pistol" ? 5 : 4), 1);
  }
  addStage("Postura neutra", "stand_heavy", -1);
  addDemonstration("stand_heavy", "Braço");
  addDemonstration("stand_medium", "Perna");
  configure();
  list.onchange = configure;
  boxes.onchange = mirror.onchange = refresh;
  tickInput.oninput = () => {
    showingContact = false;
    refresh();
  };
  impactButton.onclick = () => {
    running = false;
    play.textContent = "Reproduzir";
    showingContact = true;
    refresh();
  };
  play.onclick = () => {
    showingContact = false;
    running = !running;
    play.textContent = running ? "Pausar" : "Reproduzir";
  };
  requestAnimationFrame(function animate(now) {
    if (running && now - last >= 1000 / 20) {
      tickInput.value = String(
        (Number(tickInput.value) + 1) % (Number(tickInput.max) + 1),
      );
      refresh();
      last = now;
    }
    requestAnimationFrame(animate);
  });
});
