import { describe, expect, it } from "vitest";
import { characters, characterById } from "../src/engine/characters";
import { Match, type CombatHit } from "../src/engine/combat";
import {
  sasukeSpecialIds,
  sasukeTechniques,
  type SasukeSpecialId,
} from "../src/engine/sasuke-specials";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";

const commands = {
  senbon: [6, "light", 155],
  eiso: [6, "medium", 161],
  chidori: [6, "heavy", 132],
  gokakyu: [4, "light", 166],
  hosenka: [4, "medium", 135],
  goryuka: [4, "heavy", 125],
  serpents: [2, "light", 95],
  nagashi: [2, "medium", 54],
} as const;

function bout(opponent: string, facing: 1 | -1, range: number) {
  const m = new Match(characters.sasuke, {}, characterById(opponent));
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 620;
  b.x = a.x + facing * range;
  a.facing = facing;
  b.facing = facing === 1 ? -1 : 1;
  const hits: CombatHit[] = [];
  const tick = (input?: Partial<InputFrame>, target?: Partial<InputFrame>) => {
    m.step([
      { ...neutral(), ...input },
      { ...neutral(), ...target },
    ]);
    hits.push(...m.hits);
  };
  const run = (frames: number, target?: Partial<InputFrame>) => {
    for (let i = 0; i < frames; i++) tick(undefined, target);
  };
  const motion = (
    end: 2 | 4 | 6,
    button: "light" | "medium" | "heavy",
    target?: Partial<InputFrame>,
  ) => {
    const dir = (end === 4 ? -facing : facing) as 1 | -1;
    tick({ down: true }, target);
    tick(end === 2 ? {} : { down: true, direction: dir }, target);
    tick(
      { down: end === 2, direction: end === 2 ? 0 : dir, pressed: [button] },
      target,
    );
  };
  const special = (id: SasukeSpecialId, target?: Partial<InputFrame>) =>
    motion(commands[id][0], commands[id][1], target);
  return { m, a, b, tick, run, motion, special, hits };
}

const matchups = ["samurai", "dio", "goku", "luffy"].flatMap((opponent) =>
  ([1, -1] as const).flatMap((facing) =>
    sasukeSpecialIds.map((id) => ({ opponent, facing, id })),
  ),
);

describe("Sasuke Hebi specials", () => {
  it.each(matchups)(
    "$id vs $opponent facing $facing",
    ({ id, opponent, facing }) => {
      const {
        m,
        a,
        b,
        special,
        hits: log,
        tick,
      } = bout(opponent, facing, commands[id][2]);
      const initialHealth = b.health;
      a.meter = 24;
      special(id);
      expect(a.moveId).toBe(id);
      expect(a.meter).toBe(24);
      expect(a.attackShapes()).toEqual([]);
      const emitted = new Set<number>();
      for (let i = 0; i < 115; i++) {
        tick();
        for (const shot of m.kiProjectiles) emitted.add(shot.id);
      }
      expect(emitted.size).toBe(sasukeTechniques[id].shots?.length ?? 0);
      const hits = log.filter((h) => h.move === id);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.length).toBeLessThanOrEqual(
        sasukeTechniques[id].shots?.length ?? 1,
      );
      expect(b.health).toBe(
        initialHealth - hits.reduce((sum, h) => sum + h.damage, 0),
      );
      expect(a.moveId).toBe("");
      expect(a.attackShapes()).toEqual([]);
      expect(m.kiProjectiles).toHaveLength(0);
    },
  );

  it.each(sasukeSpecialIds)("%s can be guarded", (id) => {
    const {
      a,
      b,
      special,
      run,
      hits: log,
    } = bout("samurai", 1, commands[id][2]);
    a.x += 1240 - b.x;
    b.x = 1240;
    const guard = { direction: 1, down: id !== "goryuka" } as const;
    special(id, guard);
    run(105, guard);
    const hits = log.filter((h) => h.move === id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.blocked && h.damage === 0)).toBe(true);
  });

  it.each(sasukeSpecialIds)(
    "%s interrupted in preparation produces no late hit",
    (id) => {
      const { m, a, special, run, hits } = bout("samurai", 1, commands[id][2]);
      special(id);
      expect(a.attackShapes()).toEqual([]);
      a.setState("hitstun");
      a.stun = 18;
      run(90);
      expect(hits).toHaveLength(0);
      expect(m.kiProjectiles).toHaveLength(0);
      expect(m.sasukeStormUntil).toBe(0);
    },
  );

  it("requires a real double tap and sends its heavy version to Curse Mark", () => {
    const { a, motion, tick, run } = bout("samurai", -1, 64);
    motion(2, "heavy");
    expect(a.moveId).toBe("curse_awaken");
    run(45);
    run(5, { down: true });
    tick({ down: true, pressed: ["heavy"] });
    expect(a.moveId).toBe("crouch_heavy");
    run(95);
    tick({ down: true });
    tick({ down: true, pressed: ["medium"] });
    expect(a.moveId).toBe("crouch_medium");
  });

  it("creates visual storm state on the dragon release and serializes its trajectory", () => {
    const { m, a, special, run } = bout("samurai", 1, 570);
    special("goryuka");
    run(a.move!.startup - 1);
    expect(m.sasukeStormUntil).toBe(0);
    const before = m.timer;
    run(3);
    expect(m.timer).toBe(before - 3);
    expect(m.sasukeStormUntil).toBeGreaterThan(m.combatFrame);
    const p = m.kiProjectiles[0];
    expect(p.y).toBeLessThan(p.previousY);
    const replica = restore(snapshot(m));
    for (let i = 0; i < 270; i++) {
      replica.step([neutral(), neutral()]);
      run(1);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(m)));
    }
    expect(m.combatFrame).toBeGreaterThan(m.sasukeStormUntil);
  });

  it.each([
    ["light", "medium", "chidori"],
    ["medium", "heavy", "eiso"],
    ["light", "medium", "gokakyu"],
  ] as const)(
    "%s → %s → %s stays in one confirmed combo",
    (first, second, id) => {
      const { m, a, special, tick, run, hits } = bout("samurai", 1, 56);
      const waitForHit = (move: string) => {
        for (let i = 0; i < 28 && !(a.moveId === move && a.hitConfirmed); i++)
          tick();
        expect(a.moveId).toBe(move);
        expect(a.hitConfirmed).toBe(true);
        run(m.hitstop);
      };
      tick({ pressed: [first] });
      waitForHit("stand_" + first);
      tick({ pressed: [second] });
      waitForHit("stand_" + second);
      special(id);
      expect(a.moveId).toBe(id);
      run(58);
      expect(
        hits.filter((h) => h.attacker === a.id).map((h) => [h.move, h.combo]),
      ).toEqual([
        ["stand_" + first, 1],
        ["stand_" + second, 2],
        [id, 3],
      ]);
    },
  );

  it("rejects whiff cancels and clears contact on taking a hit", () => {
    const { a, tick, run, special, hits } = bout("samurai", 1, 630);
    tick({ pressed: ["medium"] });
    run(a.move!.startup);
    special("chidori");
    expect(a.moveId).toBe("stand_medium");
    run(70);
    expect(hits).toHaveLength(0);
    expect(a.moveId).toBe("");
    special("eiso");
    run(a.move!.startup);
    expect(a.attackShapes()).toHaveLength(1);
    a.setState("hitstun");
    expect(a.attackShapes()).toEqual([]);
  });

  it.each(["serpents", "nagashi"] as const)(
    "%s leaves time to link a normal on close hit",
    (id) => {
      const { a, hits, tick, special } = bout("samurai", 1, 52);
      special(id);
      for (let i = 0; i < 80 && a.state === "attack"; i++) tick();
      tick({ pressed: ["light"] });
      for (let i = 0; i < 16; i++) tick();
      expect(hits.map((hit) => [hit.move, hit.combo])).toEqual([
        [id, 1],
        ["stand_light", 2],
      ]);
    },
  );
});
