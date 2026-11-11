import { describe, expect, it } from "vitest";
import { characterById, characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import {
  sasukeClips,
  sasukeFrames,
  sasukeMoves,
} from "../src/engine/sasuke-data";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type Button, type InputFrame } from "../src/engine/types";
import { worldCapsule } from "../src/engine/geometry";
import { ONLINE_CHARACTERS } from "../src/net/protocol";
import { FighterPresentation } from "../src/render/presentation";
import { sasukeAnimations } from "../src/render/sasuke-animations";
import { GameSession } from "../src/game/session";
import { towerScreen } from "../src/ui/tower";

function bout(side: 1 | -1 = 1, gap = 57, opponent = "samurai") {
  const m = new Match(characters.sasuke, {}, characterById(opponent));
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 640;
  b.x = a.x + side * gap;
  a.facing = side;
  b.facing = -side;
  const tick = (
    input: Partial<InputFrame> = {},
    rival: Partial<InputFrame> = {},
  ) =>
    m.step([
      { ...neutral(), ...input },
      { ...neutral(), ...rival },
    ]);
  const run = (
    ticks: number,
    input?: Partial<InputFrame>,
    rival?: Partial<InputFrame>,
  ) => {
    for (let i = 0; i < ticks; i++) tick(input, rival);
  };
  const until = (
    predicate: () => boolean,
    ticks = 48,
    input?: Partial<InputFrame>,
  ) => {
    for (let i = 0; i < ticks && !predicate(); i++) tick(input);
    expect(predicate()).toBe(true);
  };
  return { m, a, b, tick, run, until };
}

describe("Sasuke Hebi", () => {
  it("uses the common roster, snapshots and ten-floor Arcade", () => {
    expect(ONLINE_CHARACTERS).toContain("sasuke");
    const session = new GameSession("arcade", "normal", "sasuke");
    expect(session.route).toHaveLength(10);
    expect(towerScreen(session, 0).match(/data-floor=/g)).toHaveLength(10);
    const { a, m, tick } = bout();
    a.meter = 99;
    tick({ pressed: ["ultimate"] });
    expect(a.moveId).toBe("");
    expect(Object.keys(a.data.specialMoves ?? {})).toHaveLength(8);
    expect(a.data.superMoves?.kirin_start).toBeDefined();
    expect(hashState(snapshot(restore(snapshot(m))))).toBe(
      hashState(snapshot(m)),
    );
  });

  it("has the requested 45 separate locomotion cels and follows fixed states", () => {
    const moves = Object.entries(sasukeFrames.movement);
    expect(moves.map(([, indices]) => indices.length)).toEqual([
      6, 6, 6, 5, 5, 2, 2, 2, 3, 2, 1, 2, 3,
    ]);
    expect(new Set(moves.flatMap(([, indices]) => indices)).size).toBe(45);
    for (const [name, indices] of moves)
      expect(sasukeClips[name as keyof typeof sasukeClips]).toHaveLength(
        indices.length,
      );

    const { a, tick, run } = bout(1, 320);
    const presentation = new FighterPresentation(sasukeAnimations);
    const update = () => {
      presentation.tick(a);
      return presentation.animator.clipName;
    };
    expect(update()).toBe("idle");
    tick({ direction: 1 });
    expect(update()).toBe("walkForward");
    tick({ direction: -1 });
    expect(update()).toBe("walkBack");
    tick({ direction: 1, pressed: ["dash"] });
    expect(update()).toBe("dashForward");
    run(16);
    tick({ direction: -1, pressed: ["dash"] });
    expect(update()).toBe("backdash");
    run(16);
    const low = new Set<string>();
    for (let i = 0; i < 32; i++) {
      tick({ down: i < 20 });
      low.add(update());
    }
    expect([...low]).toEqual([
      "crouchStart",
      "crouchIdle",
      "crouchEnd",
      "idle",
    ]);
    tick({ pressed: ["jump"] });
    const jump = new Set<string>([update()]);
    for (let i = 0; i < 65; i++) {
      tick();
      jump.add(update());
    }
    expect([...jump]).toEqual([
      "jumpStart",
      "jumpRise",
      "jumpApex",
      "jumpFall",
      "landing",
      "idle",
    ]);
  });

  it.each(Object.keys(sasukeMoves))(
    "%s attacks from its own poses on both sides",
    (id) => {
      for (const side of [1, -1] as const) {
        const { a, b, tick, until } = bout(side);
        const [stance, strength] = id.split("_");
        if (stance === "air") {
          a.y = FLOOR - 170;
          b.y = a.y + (strength === "heavy" ? 35 : 0);
          a.setState("air");
          b.setState("air");
        }
        tick({ down: stance === "crouch", pressed: [strength as Button] });
        expect(a.moveId).toBe(id);
        expect(a.attackShapes()).toEqual([]);
        until(() => a.hitConfirmed);
        expect(b.health).toBe(1000 - sasukeMoves[id].damage);
        expect(a.attackShapes().length).toBeGreaterThan(0);
        const blade = sasukeMoves[id].poses?.find((p) => p.blade)?.blade;
        if (strength === "heavy")
          expect(a.attackShapes()[0]).toEqual(
            worldCapsule(blade!, a.x, a.y, side),
          );
        expect(a.hurtboxes().length).toBeGreaterThan(0);
        until(() => !a.moveId, 70);
        expect(a.attackShapes()).toEqual([]);
      }
    },
  );

  it.each(["stand", "crouch"] as const)(
    "links %s J → K → L with scaling",
    (stance) => {
      const { a, b, tick, until } = bout();
      for (const strength of ["light", "medium", "heavy"] as const) {
        tick({ down: stance === "crouch", pressed: [strength] });
        until(
          () => a.moveId === `${stance}_${strength}` && a.hitConfirmed,
          48,
          { down: stance === "crouch" },
        );
      }
      expect(b.combo).toBe(3);
      expect(1000 - b.health).toBeLessThan(
        ["light", "medium", "heavy"].reduce(
          (n, key) => n + sasukeMoves[`${stance}_${key}`].damage,
          0,
        ),
      );
    },
  );

  it("jump-cancels the launcher, chains all three air hits and knocks down", () => {
    const { a, b, tick, until } = bout();
    tick({ down: true, pressed: ["heavy"] });
    until(() => a.hitConfirmed);
    tick({ pressed: ["jump"] });
    until(() => a.state === "air" && a.airborne);
    expect(b.airborne).toBe(true);
    for (const strength of ["light", "medium", "heavy"] as const) {
      tick({ pressed: [strength] });
      until(() => a.moveId === `air_${strength}` && a.hitConfirmed);
    }
    expect(b.combo).toBe(4);
    expect(b.knockedDown).toBe(true);
    until(() => !b.airborne, 60);
    until(() => b.state === "getup", 60);
  });

  it.each([false, true])(
    "blocks and renders its own guard when low=%s",
    (low) => {
      const { m, a, tick } = bout(1, 53);
      const presentation = new FighterPresentation(sasukeAnimations);
      tick({}, { down: low, pressed: ["light"] });
      let blocked = false;
      for (let i = 0; i < 13; i++) {
        tick({ direction: -1, down: low });
        presentation.tick(a);
        blocked ||= m.hits.some((hit) => hit.victim === 0 && hit.blocked);
        if (blocked) break;
      }
      expect(blocked).toBe(true);
      expect(a.health).toBe(a.data.health);
      expect(presentation.animator.clipName).toBe(
        low ? "guardImpactCrouch" : "guardImpactStand",
      );
    },
  );
});
