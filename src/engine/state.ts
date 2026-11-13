import { Match, Fighter, character } from "./combat";
import type { CommandBuffer } from "./input";
import { characterById } from "./characters";
import type { StandState } from "./stand-combat";
import type { OmnitrixState } from "./ben-omnitrix";
const fighterKeys = [
  "x",
  "y",
  "vx",
  "vy",
  "facing",
  "health",
  "meter",
  "state",
  "stateFrame",
  "stun",
  "moveId",
  "connected",
  "kanekiCaptured",
  "kanekiThrowLink",
  "kanekiLimb",
  "kanekiBurrowX",
  "kanekiSpecialRecovery",
  "hitConfirmed",
  "reverseBeatUsed",
  "hitIds",
  "comboAge",
  "comboAirHits",
  "combo",
  "lightHitsInCombo",
  "knockedDown",
  "dashDirection",
  "jumpDirection",
  "airChaseTicks",
  "chill",
  "gokuTeleportLock",
  "gokuAirTeleportUsed",
  "gokuAirTeleportsUsed",
  "gokuCastSerial",
  "sasukeCurse",
  "kirinCursed",
  "domination",
  "homeX",
  "guardIntent",
  "blockCrouched",
  "hitCrouched",
  "reactionStrength",
  "hitLaunch",
  "reactionPhase",
  "reactionFrame",
  "actionClip",
  "input",
] as const;
const matchKeys = [
  "frame",
  "combatFrame",
  "timer",
  "hitstop",
  "phase",
  "phaseFrames",
  "wins",
  "round",
  "message",
  "events",
  "capture",
  "roadRoller",
  "fury",
  "pandemonium",
  "jetGigant",
  "kirin",
  "centipede",
  "alienX",
  "pandemonium",
  "hits",
  "hitSerial",
  "rules",
  "projectiles",
  "projectileSerial",
  "kiProjectiles",
  "sasukeStormUntil",
  "sasukeStormLevel",
  "beams",
] as const;
type FighterState = Pick<Fighter, (typeof fighterKeys)[number]> & {
  buffer: ReturnType<CommandBuffer["snapshot"]>;
  characterId: string;
  stand?: StandState;
  omnitrix?: OmnitrixState;
};
export type MatchState = Pick<Match, (typeof matchKeys)[number]> & {
  temporal: import("./temporal").TemporalState;
  fighters: FighterState[];
};
const clone = <T>(value: T): T => structuredClone(value);
export function snapshot(match: Match): MatchState {
  const state = Object.fromEntries(
    matchKeys.map((key) => [key, clone(match[key])]),
  ) as MatchState;
  state.fighters = match.fighters.map(
    (f) =>
      ({
        ...Object.fromEntries(fighterKeys.map((key) => [key, clone(f[key])])),
        buffer: f.buffer.snapshot(),
        characterId: f.data.id,
        ...(f.stand ? { stand: clone(f.stand.s) } : {}),
        ...(f.omnitrix ? { omnitrix: clone(f.omnitrix) } : {}),
      }) as FighterState,
  );
  state.temporal = clone(match.temporal.s);
  return state;
}
/** Restore only explicit simulation fields and rebuild prototypes; character
 * data/code never comes from a snapshot. The server never accepts this remotely. */
export function restore(state: MatchState, match = new Match()): Match {
  Object.assign(
    match,
    Object.fromEntries(matchKeys.map((key) => [key, clone(state[key])])),
  );
  if (state.temporal) match.temporal.s = clone(state.temporal);
  match.fighters = state.fighters.map((saved, id) => {
    const fighter = new Fighter(
      characterById(saved.characterId ?? "samurai"),
      id,
      saved.homeX,
    );
    Object.assign(
      fighter,
      Object.fromEntries(fighterKeys.map((key) => [key, clone(saved[key])])),
    );
    if (saved.xebec === undefined && fighter.data.id === "xebec")
      fighter.xebec = { domination: 0, credited: [], comboGain: 0, empowered: false };
    fighter.buffer.restore(saved.buffer);
    if (fighter.stand && saved.stand) fighter.stand.s = clone(saved.stand);
    if (fighter.omnitrix && saved.omnitrix) fighter.omnitrix = { ...fighter.omnitrix, ...clone(saved.omnitrix) };
    return fighter;
  }) as [Fighter, Fighter];
  match.data = match.fighters[0].data;
  match.opponentData = match.fighters[1].data;
  match.linkOpponents();
  return match;
}
export function hashState(state: MatchState) {
  const text = JSON.stringify(state);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
