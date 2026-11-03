import config from "../data/combat-pace.json";
import type { CharacterData, Move } from "./types";
export { config as combatPace };
const cache = new WeakMap<CharacterData, CharacterData>();
/** A piecewise clock maps gameplay to the existing authored drawings. Contact
 * poses keep their original duration: only preparation/recovery are retimed. */
export function animationTick(move: Move, tick: number) {
  const old = move.visualTiming;
  if (!old) return tick;
  if (tick < move.startup) return (tick * old.startup) / move.startup;
  if (tick < move.startup + move.active)
    return old.startup + ((tick - move.startup) * old.active) / move.active;
  return (
    old.startup +
    old.active +
    ((tick - move.startup - move.active) * old.recovery) / move.recovery
  );
}
export function retime(
  move: Move,
  startup: number,
  active: number,
  recovery: number,
): Move {
  const out: Move = {
    ...move,
    startup,
    active,
    recovery,
    visualTiming: {
      startup: move.startup,
      active: move.active,
      recovery: move.recovery,
    },
  };
  const tick = (t: number) =>
    Math.round(
      t < move.startup
        ? (t * startup) / move.startup
        : t < move.startup + move.active
          ? startup + ((t - move.startup) * active) / move.active
          : startup +
            active +
            ((t - move.startup - move.active) * recovery) / move.recovery,
    );
  if (move.hitWindows)
    out.hitWindows = move.hitWindows.map((w) => ({
      ...w,
      fromTick: tick(w.fromTick),
      toTick: Math.max(tick(w.fromTick) + 1, tick(w.toTick)),
    }));
  if (move.drive)
    out.drive = {
      ...move.drive,
      from: tick(move.drive.from),
      to: tick(move.drive.to),
    };
  if (move.hopAt !== undefined) out.hopAt = tick(move.hopAt);
  if (move.invulnerable)
    out.invulnerable = {
      ...move.invulnerable,
      from: tick(move.invulnerable.from),
      to: tick(move.invulnerable.to),
    };
  return out;
}
/** Source PNGs and JSONs remain immutable. This configurable gameplay overlay
 * is shared by Node and browsers, and included in the network fingerprint. */
export function pacedCharacter(source: CharacterData): CharacterData {
  const cached = cache.get(source);
  if (cached) return cached;
  const id = source.id as keyof typeof config.mobility,
    mobility = config.mobility[id];
  if (!mobility) return source;
  const tuning = config.normals[id];
  const moves = Object.fromEntries(
    Object.entries(source.moves).map(([key, m]) => {
      if (!/^(stand|crouch|air)_(light|medium|heavy)$/.test(key))
        return [key, m];
      const rank = Math.min(2, m.rank - 1),
        air = key.startsWith("air_");
      const n = retime(
        m,
        Math.max(2, m.startup - tuning.startupReduction[rank]),
        m.active,
        Math.max(5, m.recovery - tuning.recoveryReduction[rank]),
      );
      n.stun += config.normals.stunBonus[rank];
      n.push *= config.normals.pushScale[rank];
      n.hitstop = config.normals.hitstop[rank];
      if (
        air &&
        !n.knockdown &&
        n.launch < 0 &&
        config.normals.followAirLaunchVelocity.includes(id)
      )
        n.airHold = Math.min(n.airHold ?? 0, n.launch);
      n.cancelWindow = {
        fromTick: n.startup + 1,
        toTick:
          n.startup + n.active + n.recovery - config.cancel.hitRecoveryTail,
      };
      n.cancels = [
        ...new Set([
          ...m.cancels,
          ...(!air || (id === "goku" && !m.knockdown) ? ["special"] : []),
        ]),
      ];
      n.cancelMoves = air
        ? ["air_medium", "air_heavy"]
        : ["stand_medium", "crouch_medium", "stand_heavy", "crouch_heavy"];
      return [key, n];
    }),
  );
  const locomotion = source.locomotion;
  const scale = (values: number[]) =>
    values.map((v) => Math.round(v * mobility.dashScale * 100) / 100);
  const result: CharacterData = {
    ...source,
    speed: mobility.speed,
    moves,
    combatLimits: config.combo,
    airChaseSpeed: mobility.chaseSpeed,
    airChaseTicks: mobility.chaseTicks,
    locomotion: {
      backSpeed: mobility.backSpeed,
      airSpeed: mobility.airSpeed,
      jumpStartup: mobility.jumpStartup,
      landingTicks: mobility.landingTicks,
      dashForward: scale(
        locomotion?.dashForward ?? [
          14, 16, 17, 17, 16, 15, 14, 13, 11, 8, 5, 2, 0,
        ],
      ),
      backdash: scale(
        locomotion?.backdash ?? [11, 13, 14, 14, 13, 12, 11, 10, 8, 6, 4, 2, 0],
      ),
    },
  };
  cache.set(source, result);
  cache.set(result, result);
  return result;
}
