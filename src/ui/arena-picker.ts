import { assetBase } from "../asset-base";
import { arenas, arenaModes, type ArenaId, type ArenaMode } from "../engine/arenas";
import { arenaLayouts } from "../engine/arena-layouts";

const modeNames: Record<ArenaMode, string> = { classico: "Clássico · piso fixo e sem perigos", interativo: "Arena viva · interações, perigos e níveis", caotico: "Arena viva · interações, perigos e níveis" };
const structureNames = { traditional: "Tradicional", descent: "Queda para área inferior", platform: "Derrube o adversário · queda = derrota · vença 3 rounds · ↓ + salto para descer", hybrid: "Estruturas destrutíveis" };
const preview = (id: ArenaId, mode: ArenaMode) => `${id}${mode !== "classico" && arenaLayouts[id].structure === "platform" ? "-open" : ""}`;
export function arenaPicker(id: ArenaId, mode: ArenaMode, editable: boolean) {
  const selected = arenas.find(a => a.id === id)!;
  mode = mode === "caotico" ? "interativo" : mode;
  return `<section class="arena-picker" aria-label="Arena e regras ambientais"><img id="arena-preview" src="${assetBase}arenas/${preview(id, mode)}.png" alt="Prévia de ${selected.name}"><div><strong id="arena-name">${selected.name}</strong><small id="arena-description">${selected.description} · ${structureNames[arenaLayouts[id].structure]} · ${selected.hazard}</small>${editable ? `<label>Arena <select id="arena-select">${arenas.map(a => `<option value="${a.id}" ${a.id === id ? "selected" : ""}>${a.name} · ${a.origin}</option>`).join("")}</select></label><label>Regras <select id="arena-mode">${arenaModes.map(m => `<option value="${m}" ${m === mode ? "selected" : ""}>${modeNames[m]}</option>`).join("")}</select></label>` : `<span>${modeNames[mode]}</span>`}</div></section>`;
}
export function updateArenaPreview(root: ParentNode, id: ArenaId, mode: ArenaMode = "interativo") {
  const arena = arenas.find(a => a.id === id)!;
  const image = root.querySelector<HTMLImageElement>("#arena-preview");
  if (image) { image.src = `${assetBase}arenas/${preview(id, mode)}.png`; image.alt = `Prévia de ${arena.name}`; }
  const name = root.querySelector("#arena-name"), description = root.querySelector("#arena-description");
  if (name) name.textContent = arena.name;
  if (description) description.textContent = `${arena.description} · ${structureNames[arenaLayouts[id].structure]} · ${arena.hazard}`;
}
