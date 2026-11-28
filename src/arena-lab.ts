import { Match } from "./engine/combat";
import { characters, type CharacterId } from "./engine/characters";
import { arenas, type ArenaId } from "./engine/arenas";
import { arenaPlatforms, openStage } from "./engine/arena-layouts";
import { neutral, type Button, type InputFrame } from "./engine/types";
import { Renderer } from "./render/renderer";
import { Sound } from "./audio/sound";
import { drawArena, visibleWorldBounds } from "./render/arena";
import { createArena } from "./engine/arenas";
import { assetBase } from "./asset-base";
import { forceArenaEvent, eventTiming, impactAt, isArenaEvent } from "./engine/arena-events";
import { beginDojoTravel, type DojoRoom } from "./engine/arena-rooms";
import { beginBenLift, benEventOrder, benEventSpecs, type BenArea, type BenArenaEventKind } from "./engine/ben-arena";

const canvas = document.querySelector("canvas")!;
const renderer = new Renderer(canvas), sound = new Sound();
const arenaSelect = document.querySelector<HTMLSelectElement>("#arena")!;
const fighterSelect = document.querySelector<HTMLSelectElement>("#fighter")!;
const status = document.querySelector<HTMLElement>("#status")!;
arenaSelect.innerHTML = arenas.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
fighterSelect.innerHTML = Object.values(characters).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
let match: Match, running = false, held = new Set<string>(), pressed: Button[] = [];
const buttons: Record<string, Button> = { w: "jump", j: "light", k: "medium", l: "heavy", r: "ultimate" };
function reset(id: ArenaId = arenaSelect.value as ArenaId, fighter: CharacterId = fighterSelect.value as CharacterId) {
  match = new Match(characters[fighter], { training: true, arenaId: id, arenaMode: "interativo" }, characters.goku);
  match.phase = "fight"; match.message = "";
  match.fighters[0].meter = match.fighters[0].meterMaximum;
  arenaSelect.value = id; fighterSelect.value = fighter;
  document.querySelector<HTMLElement>("#ben-tools")!.hidden = id !== "undertown";
  document.querySelector<HTMLElement>("#dojo-tools")!.hidden = id !== "dojo";
  renderer.resetAnimations(); render();
}
function render() {
  renderer.tick(match); renderer.draw(match);
  const area = match.arena.ben ? match.arena.ben.lift ? "elevador" : match.arena.ben.area === "market" ? "Cidade de Baixo" : "Mr. Smoothy" : match.arena.dojo?.room ?? `nível ${match.arena.level + 1}`;
  status.textContent = `${arenas.find(a => a.id === match.arena.id)!.name} · ${area} · ${match.arena.transition ? "descida" : match.arena.hazard?.phase ?? "ambiente"} · ${match.arena.tick} ticks`;
}
function advance(ticks = 1, input?: InputFrame, drawEvery = 1) {
  for (let n = 0; n < ticks; n++) {
    match.step([input ?? neutral(), neutral()]); sound.tick(match);
    if (n % drawEvery === 0 || n === ticks - 1) render(); else renderer.tick(match);
  }
}
function event(collapse = false) {
  forceArenaEvent(match.arena, collapse ? "transformation" : "primary");
  if (collapse) match.fighters[0].x = match.arena.hazard!.x;
  advance();
}
arenaSelect.onchange = fighterSelect.onchange = () => reset();
document.querySelector<HTMLButtonElement>("#event")!.onclick = () => { void sound.unlock(); event(); };
document.querySelector<HTMLButtonElement>("#collapse")!.onclick = () => { void sound.unlock(); event(true); };
document.querySelector<HTMLButtonElement>("#pause")!.onclick = () => { running = !running; };
document.querySelector<HTMLButtonElement>("#step")!.onclick = () => { running = false; advance(); };
const benEventSelect = document.querySelector<HTMLSelectElement>("#ben-event")!;
benEventSelect.innerHTML = Object.values(benEventSpecs).map(s => `<option value="${s.kind}">${s.label}</option>`).join("");
document.querySelector<HTMLButtonElement>("#ben-force")!.onclick = () => { void sound.unlock(); lab.benEvent(benEventSelect.value as BenArenaEventKind); running = true; };
document.querySelector<HTMLButtonElement>("#ben-lift")!.onclick = () => { void sound.unlock(); lab.lift(); running = true; };
document.querySelector<HTMLButtonElement>("#dojo-travel")!.onclick = () => {
  const room = document.querySelector<HTMLSelectElement>("#dojo-room")!.value as DojoRoom;
  lab.launchRoom(room, room === "west" ? -1 : 1); running = true;
};
window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase(); if (!(key in buttons) && !["a", "s", "d"].includes(key)) return;
  if (e.target instanceof HTMLSelectElement) return;
  e.preventDefault(); if (!held.has(key) && buttons[key]) pressed.push(buttons[key]); held.add(key);
});
window.addEventListener("keyup", e => held.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => { held.clear(); pressed = []; });
const lab = {
  reset, advance, event, renderer,
  get match() { return match; },
  pause() { running = false; },
  travel(room: DojoRoom, direction: -1 | 1 = 1, depth = false) { return beginDojoTravel(match, room, direction, depth); },
  launchRoom(room: DojoRoom, direction: -1 | 1 = 1) {
    match.fighters[0].x = direction > 0 ? 1050 : 230; match.fighters[1].x = direction > 0 ? 1160 : 120;
    return beginDojoTravel(match, room, direction, false, { attacker: 0, victim: 1 });
  },
  benArea(area: BenArea) { if (!match.arena.ben) return; match.arena.ben.area = area; match.arena.hazard = undefined; match.arena.terrain = []; render(); },
  benEvent(kind: BenArenaEventKind) { if (!match.arena.ben) return; match.arena.ben.area = benEventOrder.smoothy.includes(kind) ? "smoothy" : "market"; forceArenaEvent(match.arena, "primary", kind); render(); },
  lift() { return beginBenLift(match); },
  coverageScene(camera: { x: number; y: number; scale: number; angle?: number }) {
    const proof = document.createElement("canvas"); proof.width = 1280; proof.height = 720;
    const c = proof.getContext("2d", { willReadFrequently: true })!;
    c.translate(657, 347); c.rotate(camera.angle ?? 0); c.scale(camera.scale, camera.scale); c.translate(-camera.x, -camera.y);
    renderer.paintArena(c, match.arena); const data = c.getImageData(0, 0, 1280, 720).data;
    let transparent = 0; for (let n = 3; n < data.length; n += 4) if (data[n] < 255) transparent++;
    return { transparent };
  },
  eventInfo() {
    const a = match.arena, h = a.hazard;
    return isArenaEvent(h) ? { ...h, timing: eventTiming(a, h), impactAt: impactAt(a, h) } : undefined;
  },
  async upperPreservation(id: ArenaId) {
    const upper = new Image(), lower = new Image();
    upper.src = `${assetBase}arenas/${id}-open.png`; lower.src = `${assetBase}arenas/${id}-world.png`;
    await Promise.all([upper.decode(), lower.decode()]);
    const composite = document.createElement("canvas"), original = document.createElement("canvas");
    composite.width = original.width = 1280; composite.height = original.height = 720;
    const c = composite.getContext("2d")!, reference = original.getContext("2d")!;
    c.imageSmoothingEnabled = reference.imageSmoothingEnabled = false;
    drawArena(c, createArena(id, "interativo"), upper, 0, undefined, undefined, lower);
    reference.drawImage(upper, 0, 0, 1280, 720);
    const actual = c.getImageData(0, 0, 1280, 720).data, expected = reference.getImageData(0, 0, 1280, 720).data;
    let changed = 0; for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) changed++;
    return { changed, channels: actual.length };
  },
  platform() { const p = arenaPlatforms(match.arena)[0]; if (!p) return; const f = match.fighters[0]; f.x = p.x + p.width / 2; f.y = p.y; f.setState("idle"); match.arena.supports[0] = p.id; render(); },
  async coverage(id: ArenaId, camera: { x: number; y: number; scale: number; angle?: number }, level: 0 | 1 = 0, transition?: number) {
    const proof = document.querySelector<HTMLCanvasElement>("#coverage") ?? document.createElement("canvas");
    proof.id = "coverage"; proof.width = 1280; proof.height = 720;
    if (!proof.isConnected) document.querySelector("main")!.append(proof);
    const c = proof.getContext("2d", { willReadFrequently: true })!;
    const texture = new Image(); texture.src = `${assetBase}arenas/${openStage(createArena(id, "interativo")) ? id + "-open" : id}.png`; await texture.decode();
    let lower: HTMLImageElement | undefined;
    if (["enies", "godvalley"].includes(id)) { lower = new Image(); lower.src = `${assetBase}arenas/${id}-lower.png`; await lower.decode(); }
    const arena = createArena(id, "interativo"); arena.level = level;
    let world: HTMLImageElement | undefined;
    if (openStage(arena)) { world = new Image(); world.src = `${assetBase}arenas/${id}-world.png`; await world.decode(); }
    if (transition !== undefined) arena.transition = { tick: transition, x: 640, origins: [400, 880], targets: [400, 880] };
    c.clearRect(0, 0, 1280, 720); c.save(); c.translate(657, 347);
    c.rotate(camera.angle ?? 0); c.scale(camera.scale, camera.scale); c.translate(-camera.x, -camera.y);
    const bounds = visibleWorldBounds(c); drawArena(c, arena, texture, 0, undefined, lower, world); c.restore();
    const pixels = c.getImageData(0, 0, 1280, 720).data;
    let transparent = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) transparent++;
    return { transparent, bounds };
  },
};
// This API exists only on the art inspector entry, never on the normal game page.
(window as unknown as { arenaLab: typeof lab }).arenaLab = lab;
let previous = performance.now(), accumulator = 0;
function loop(now: number) {
  accumulator += Math.min(100, now - previous); previous = now;
  while (accumulator >= 1000 / 60) {
    if (running) { advance(1, { direction: held.has("a") ? -1 : held.has("d") ? 1 : 0, down: held.has("s"), pressed }); pressed = []; }
    accumulator -= 1000 / 60;
  }
  requestAnimationFrame(loop);
}
void renderer.preparePalette("cyan").then(() => {
  reset("enies"); canvas.dataset.ready = "true";
  running = true; previous = performance.now(); requestAnimationFrame(loop);
}).catch(error => { status.textContent = `Falha ao carregar: ${String(error)}`; });
