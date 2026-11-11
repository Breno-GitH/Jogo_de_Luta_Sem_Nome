import { benAliens } from "./engine/ben-omnitrix";
import { ben } from "./engine/ben-data";
import { characters } from "./engine/characters";
import { Match } from "./engine/combat";
import { KeyboardInput } from "./engine/input";
import { FixedLoop } from "./engine/loop";
import { neutral } from "./engine/types";
import { Renderer } from "./render/renderer";
import { Animator } from "./render/animator";
import stage6Models from "./data/ben-stage6-models.json";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector("output")!;
document.querySelector("#playlist")!.textContent = benAliens.map(form => form.name).join(" · ");
const button = document.querySelector<HTMLButtonElement>("#seat")!;
const renderer = new Renderer(canvas, undefined, Object.values(stage6Models));
const model = document.querySelector<HTMLSelectElement>("#stage6-model")!;
const clip = document.querySelector<HTMLSelectElement>("#stage6-clip")!;
const previewStatus = document.querySelector("#stage6-status")!;
let preview: Animator | undefined;
const clipLabels: Record<string, string> = {
  idle: "Idle",
  poses: "Poses de ação",
  wings: "Articulação das asas",
  containment: "Pose de contenção",
};
const input = new KeyboardInput({ dashOnDirection: true, gamepad: true, omnitrix: () => true });
let seat: 0 | 1 = 0;
let match: Match;

function reset() {
  input.clear();
  renderer.resetAnimations();
  renderer.localSeat = seat;
  renderer.online = true; // Use the local-seat label for either position.
  const [left, right] = seat === 0 ? [ben, characters.sasuke] : [characters.sasuke, ben];
  match = new Match(left, { training: true }, right);
  if (preview) {
    const alien = benAliens.find(form => form.id === (model.value === "nrgReleased" ? "nrg" : model.value));
    if (alien) match.fighters[seat].omnitrix!.selected = alien.id;
  }
  match.phase = "fight";
  match.message = "";
  renderer.tick(match, preview);
  button.textContent = seat === 0 ? "Mover Ben para a direita" : "Mover Ben para a esquerda";
}

button.addEventListener("click", () => {
  seat = seat === 0 ? 1 : 0;
  reset();
  button.blur();
});

model.addEventListener("change", () => {
  const selected = stage6Models[model.value as keyof typeof stage6Models];
  preview = selected ? new Animator(selected) : undefined;
  clip.replaceChildren(...Object.keys(selected?.clips ?? {}).map(key => new Option(clipLabels[key], key)));
  clip.disabled = !selected;
  previewStatus.textContent = selected ? "Prévia visual · combate pausado" : "";
  reset();
});
clip.addEventListener("change", () => preview?.update(clip.value, true));

reset();
renderer.preparePalette("cyan").then(() => {
  new FixedLoop(() => {
    const frame = input.sample();
    if (preview) preview.update(preview.clipName);
    else match.step(seat === 0 ? [frame, neutral()] : [neutral(), frame]);
    renderer.tick(match, preview);
  }, () => {
    renderer.chainKeys = input.activeChainKeys ?? ["J", "K", "L"];
    renderer.draw(match);
  }).start();
}).catch((error: Error) => {
  status.textContent = error.message;
});

