import samurai from "../data/samurai.json";
import dio from "../data/dio.json";
import goku from "../data/goku.json";
import specialMoves from "../data/dio-special-moves.json";
import specialActions from "../data/the-world-special-actions.json";
import superMoves from "../data/dio-super-moves.json";
import superActions from "../data/the-world-super-actions.json";
import roadConfig from "../data/road-roller.json";
import secondary from "../data/dio-secondary.json";
import secondaryActions from "../data/the-world-secondary.json";
import type { CharacterData } from "./types";
export type CharacterId = "samurai" | "dio" | "goku";
export const characters: Record<CharacterId, CharacterData> = {
  samurai,
  goku,
  dio: {
    ...dio,
    ...secondary,
    specialMoves,
    superMoves,
    meterMaximum: roadConfig.meterMaximum,
    companion: {
      ...dio.companion,
      actions: {
        ...dio.companion.actions,
        ...specialActions,
        ...superActions,
        ...secondaryActions,
      },
    },
  } as CharacterData,
};
export function characterById(id: string): CharacterData {
  if (id !== "samurai" && id !== "dio" && id !== "goku")
    throw new Error(`Unknown character: ${id}`);
  return characters[id];
}
