import movement from "../data/goku.json";
import normals from "../data/goku-normals.json";
import secondaryJson from "../data/goku-combat.json";
import specialMoves from "../data/goku-special-moves.json";
import { furyMove } from "./goku-fury-move";
import fury from "../data/goku-fury.json";
import type { CharacterData, Move } from "./types";
const secondary = secondaryJson as Partial<CharacterData>;
/** Additive data, leaving the approved movement source byte-identical. */
export const goku: CharacterData = {
  ...movement,
  ...secondary,
  moves: normals,
  specialMoves: specialMoves as Record<string, Move>,
  superMoves: { ssj1_fury: furyMove },
  meterMaximum: fury.meterMaximum,
  meterGainScale: fury.meterGainScale,
  reactions: { ...movement.reactions, ...secondary.reactions },
  reactionClips: { ...movement.reactionClips, ...secondary.reactionClips },
};
