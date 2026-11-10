import type { InputFrame, State } from "./types";
import { benForms } from "./ben-forms";
import type { BenObject } from "./ben-moves";
import type { EchoClone } from "./ben-stage7";

export const benId = "ben";
export const alienXSuper = { id: "alienX", name: "Alien X", command: "ultimate", cost: 100 } as const;
export const benAliens = [
  { id: "xlr8", name: "XLR8" },
  { id: "fourArms", name: "Quatro Braços" },
  { id: "feedback", name: "Feedback" },
  { id: "gravattack", name: "Gravattack" },
  { id: "ghostfreak", name: "Fantasmático" },
  { id: "bigChill", name: "Friagem" },
  { id: "nrg", name: "NRG" },
  { id: "diamondhead", name: "Diamante" },
  { id: "echoEcho", name: "Eco Eco" },
  { id: "heatblast", name: "Chama" },
  { id: "humungousaur", name: "Enormossauro" },
] as const;
export type BenAlien = (typeof benAliens)[number]["id"];


export interface OmnitrixInput {
  held: boolean;
}
export interface OmnitrixState {
  active: "human" | BenAlien;
  selected: BenAlien;
  holdTicks: number;
  dialTicks: number;
  crouchExit: number;
  noSpace: number;
  usedSpecials: string[];
  comboSwap: boolean;
  objects: BenObject[];
  growth?: { rank: 1 | 2; ticks: number };
  growthCooldown: number;
  charge: number;
  chargeTicks: number;
  absorbFlash: number;
  chargeCue?: { kind: "absorb" | "contact" | "spend"; amount: number; ticks: number };
  transition?: { to: BenAlien; ticks: number };
  flightUsed?: boolean;
  diveUsed?: boolean;
  ghostCooldown?: number;
  nrgReleased?: boolean;
  nrgTicks?: number;
  nrgCooldown?: number;
  flightTicks?: number;
  flightVX?: number;
  flightVY?: number;
  maneuverX?: number;
  landingStrike?: boolean;
  absorbWindow?: number;
  absorbCooldown?: number;
  guardHeld?: boolean;
  echoClones?: EchoClone[];
  echoCooldown?: number;
}
export const omnitrixHoldTicks = 15;
export const omnitrixSwapTicks = 9;
export const omnitrixDialTicks = 8;

export const newOmnitrix = (): OmnitrixState => ({
  active: "human", selected: benAliens[0].id, holdTicks: 0, dialTicks: 0, crouchExit: 0, noSpace: 0,
  usedSpecials: [], comboSwap: false, objects: [], growthCooldown: 0, charge: 0, chargeTicks: 0, absorbFlash: 0
});

export const omnitrixCanBrowse = (state: State) =>
  state === "idle" || state === "walk" || state === "crouch" || state === "air" ||
  state === "jumpStart" || state === "landing" || state === "dash" || state === "attack";

export function cancelOmnitrix(state: OmnitrixState) {
  state.holdTicks = 0;
  state.dialTicks = 0;
  state.crouchExit = 0;
  delete state.transition;
}

function advanceDial(state: OmnitrixState) {
  const current = benAliens.findIndex(form => form.id === state.selected);
  state.selected = benAliens[(current + 1) % benAliens.length].id;
  state.dialTicks = omnitrixDialTicks;
}

/** Release resolves a tap. The threshold resolves a hold once, even when
 * the swap is denied. The same match clock decides both for all clients. */
export function tickOmnitrix(
  state: OmnitrixState, input: InputFrame, canConfirm: boolean,
  place: (to: BenAlien) => boolean,
) {
  if (state.dialTicks > 0) state.dialTicks--;
  if (state.crouchExit > 0) state.crouchExit--;
  if (state.noSpace > 0) state.noSpace--;
  if (state.transition && --state.transition.ticks === 0) {
    if (canConfirm) {
      if (place(state.transition.to)) {
        state.active = state.transition.to;
        delete state.growth;
        state.noSpace = 0;
      } else state.noSpace = 35;
    }
    delete state.transition;
  }

  // Absence cancels the gesture, for example on focus or gamepad loss.
  if (!input.omnitrix) {
    state.holdTicks = 0;
    return;
  }
  const edge = input.pressed.includes("heavy");
  // The adapter emits only real keydown edges. A new edge can follow a keyup
  // between samples, including when the new tap has already been released.
  if (edge && state.holdTicks) {
    if (state.holdTicks < omnitrixHoldTicks) advanceDial(state);
    state.holdTicks = 0;
  }
  if (!input.omnitrix.held) {
    if (state.holdTicks < omnitrixHoldTicks && (state.holdTicks || edge))
      advanceDial(state);
    state.holdTicks = 0;
    return;
  }
  if (!state.holdTicks && !edge) return;
  if (state.holdTicks === omnitrixHoldTicks) return;
  if (++state.holdTicks === omnitrixHoldTicks &&
      canConfirm && benForms[state.selected] && !state.transition && state.active !== state.selected)
    state.transition = { to: state.selected, ticks: omnitrixSwapTicks };
}
