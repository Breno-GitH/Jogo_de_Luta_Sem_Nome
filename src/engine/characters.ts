import { kaneki } from "./kaneki-combat";
import { ben } from "./ben-data";
import samurai from "../data/samurai.json";
import dio from "../data/dio.json";
import { goku } from "./goku-data";
import { sasuke } from "./sasuke-data";
import luffy from "../data/luffy.json";
import { luffyMoves } from "./luffy-normals";
import { luffySpecialMoves } from "./luffy-specials";
import { luffySecondary, luffyThrow } from "./luffy-secondary";
import { jetConfig, jetId, jetMove } from "./luffy-jet-gigant";
import specialMoves from "../data/dio-special-moves.json";
import specialActions from "../data/the-world-special-actions.json";
import superMoves from "../data/dio-super-moves.json";
import superActions from "../data/the-world-super-actions.json";
import roadConfig from "../data/road-roller.json";
import secondary from "../data/dio-secondary.json";
import secondaryActions from "../data/the-world-secondary.json";
import type { CharacterData } from "./types";
import { pacedCharacter } from "./pace";
export type CharacterId = "samurai" | "dio" | "goku" | "luffy" | "sasuke" | "kaneki" | "ben";
export const characters: Record<CharacterId, CharacterData> = {
  samurai: pacedCharacter(samurai),
  goku: pacedCharacter(goku),
  sasuke,
  kaneki,
  ben,
  luffy: {
    ...luffy,
    ...luffySecondary,
    moves: { ...luffyMoves, throw: luffyThrow },
    specialMoves: luffySpecialMoves,
    superMoves: { [jetId]: jetMove },
    meterMaximum: jetConfig.cost,
    meterGainScale: jetConfig.meterGainScale,
  },
  dio: pacedCharacter({
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
  } as CharacterData),
};
export function characterById(id: string): CharacterData {
  if (!(id in characters) || !Object.hasOwn(characters, id))
    throw new Error(`Unknown character: ${id}`);
  return characters[id as CharacterId];
}
