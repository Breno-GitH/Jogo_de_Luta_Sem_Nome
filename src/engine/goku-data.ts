import movement from "../data/goku.json";
import normals from "../data/goku-normals.json";
import secondaryJson from "../data/goku-combat.json";
import specialMoves from "../data/goku-special-moves.json";
import { furyMove } from "./goku-fury-move";
import fury from "../data/goku-fury.json";
import type { CharacterData, Move } from "./types";
import { combatPace, retime } from "./pace";
const airTeleports = Object.fromEntries(
  (["light", "medium", "heavy"] as const).map((strength) => {
    const c = combatPace.airTeleport[strength],
      source = specialMoves.teleport_air as Move;
    return [
      strength === "heavy" ? "teleport_air" : `teleport_air_${strength}`,
      {
        ...retime(source, c.startup, c.vanishTicks, c.recovery),
        gokuStrength: strength,
        airTeleport: true,
        commandClip: "teleport_air",
      } as Move,
    ];
  }),
);
const secondary = secondaryJson as Partial<CharacterData>;
/** Additive data, leaving the approved movement source byte-identical. */
export const goku: CharacterData = {
  ...movement,
  ...secondary,
  moves: normals,
  specialMoves: { ...(specialMoves as Record<string, Move>), ...airTeleports },
  superMoves: { ssj1_fury: furyMove },
  meterMaximum: fury.meterMaximum,
  meterGainScale: fury.meterGainScale,
  reactions: { ...movement.reactions, ...secondary.reactions },
  reactionClips: { ...movement.reactionClips, ...secondary.reactionClips },
};
